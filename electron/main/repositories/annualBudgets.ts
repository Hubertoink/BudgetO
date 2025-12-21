import Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'

type DB = InstanceType<typeof Database>

export interface AnnualBudget {
  id: number
  year: number
  amount: number
  costCenterId: number | null
  description: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Get the annual budget for a specific year and optional cost center
 */
export function getAnnualBudget(params: { year: number; costCenterId?: number | null }): AnnualBudget | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, year, amount, cost_center_id as costCenterId, description,
           created_at as createdAt, updated_at as updatedAt
    FROM annual_budgets
    WHERE year = ? AND IFNULL(cost_center_id, -1) = IFNULL(?, -1)
  `).get(params.year, params.costCenterId ?? null) as AnnualBudget | undefined
  return row || null
}

/**
 * List all annual budgets, optionally filtered by year
 */
export function listAnnualBudgets(params: { year?: number }): AnnualBudget[] {
  const db = getDb()
  const where: string[] = []
  const vals: any[] = []
  
  if (params.year != null) {
    where.push('year = ?')
    vals.push(params.year)
  }
  
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : ''
  
  return db.prepare(`
    SELECT id, year, amount, cost_center_id as costCenterId, description,
           created_at as createdAt, updated_at as updatedAt
    FROM annual_budgets
    ${whereSql}
    ORDER BY year DESC
  `).all(...vals) as AnnualBudget[]
}

/**
 * Create or update an annual budget (upsert by year + cost_center_id)
 */
export function upsertAnnualBudget(input: {
  year: number
  amount: number
  costCenterId?: number | null
  description?: string | null
}): { id: number; created: boolean } {
  return withTransaction((db: DB) => {
    // Check if exists
    const existing = db.prepare(`
      SELECT id FROM annual_budgets
      WHERE year = ? AND IFNULL(cost_center_id, -1) = IFNULL(?, -1)
    `).get(input.year, input.costCenterId ?? null) as { id: number } | undefined
    
    if (existing) {
      db.prepare(`
        UPDATE annual_budgets
        SET amount = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(input.amount, input.description ?? null, existing.id)
      return { id: existing.id, created: false }
    } else {
      const info = db.prepare(`
        INSERT INTO annual_budgets (year, amount, cost_center_id, description)
        VALUES (?, ?, ?, ?)
      `).run(input.year, input.amount, input.costCenterId ?? null, input.description ?? null)
      return { id: Number(info.lastInsertRowid), created: true }
    }
  })
}

/**
 * Delete an annual budget by ID
 */
export function deleteAnnualBudget(id: number): { id: number } {
  const db = getDb()
  db.prepare('DELETE FROM annual_budgets WHERE id = ?').run(id)
  return { id }
}

/**
 * Get budget usage for a specific year.
 *
 * BudgetO semantics: budget is reduced by net spending (OUT − IN).
 * This means income increases remaining budget.
 */
export function getAnnualBudgetUsage(params: { year: number; costCenterId?: number | null }): {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
} {
  const db = getDb()
  
  // Get budget amount
  const budget = getAnnualBudget(params)
  const budgeted = budget?.amount ?? 0
  
  // Calculate spent/income from vouchers for the year
  const yearStart = `${params.year}-01-01`
  const yearEnd = `${params.year}-12-31`
  
  const row = db.prepare(`
    SELECT
      IFNULL(SUM(CASE WHEN type = 'OUT' THEN gross_amount ELSE 0 END), 0) as spent,
      IFNULL(SUM(CASE WHEN type = 'IN' THEN gross_amount ELSE 0 END), 0) as income
    FROM vouchers
    WHERE date >= ? AND date <= ?
  `).get(yearStart, yearEnd) as { spent: number; income: number }
  
  const spent = Number(row.spent || 0)
  const income = Number(row.income || 0)

  // Net spending reduces remaining; income increases it.
  const netSpent = spent - income
  const remaining = budgeted - netSpent

  // Show usage based on net spending; never go below 0%.
  const percentage = budgeted > 0 ? Math.min(100, Math.max(0, (netSpent / budgeted) * 100)) : 0
  
  return { budgeted, spent, income, remaining, percentage }
}
