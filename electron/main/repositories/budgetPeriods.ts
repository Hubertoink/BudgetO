import Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'
import { getBudgetPeriodBounds, nextCarryover, normalizeBudgetCadence, type BudgetCadence } from '../services/budgetPeriod'
import { nextOccurrenceDate, type RecurrenceFrequency } from '../services/recurrence'

type DB = InstanceType<typeof Database>

export interface BudgetPeriod {
  id: number
  cadence: BudgetCadence
  year: number
  month: number | null
  startDate: string
  endDate: string
  amount: number
  description: string | null
  createdAt: string
  updatedAt: string | null
}

export interface BudgetUsage {
  cadence: BudgetCadence
  year: number
  month: number | null
  startDate: string
  endDate: string
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
  configuredPeriods: number
  baseBudgeted: number
  carryover: number
  projectedIncome: number
  projectedSpent: number
  projectedRemaining: number
}

function mapPeriod(row: any): BudgetPeriod {
  return {
    id: Number(row.id),
    cadence: normalizeBudgetCadence(row.cadence),
    year: Number(row.year),
    month: row.month == null ? null : Number(row.month),
    startDate: String(row.startDate),
    endDate: String(row.endDate),
    amount: Number(row.amount || 0),
    description: row.description == null ? null : String(row.description),
    createdAt: String(row.createdAt),
    updatedAt: row.updatedAt == null ? null : String(row.updatedAt)
  }
}

export interface BudgetPeriodConfig {
  cadence: BudgetCadence
  carrySurplus: boolean
  carryDeficit: boolean
}

export function getBudgetPeriodConfig(): BudgetPeriodConfig {
  const row = getDb().prepare('SELECT cadence, carry_surplus AS carrySurplus, carry_deficit AS carryDeficit FROM budget_period_config WHERE id=1').get() as any
  return { cadence: normalizeBudgetCadence(row?.cadence), carrySurplus: Boolean(row?.carrySurplus), carryDeficit: Boolean(row?.carryDeficit) }
}

export function getBudgetCadence(): BudgetCadence {
  return getBudgetPeriodConfig().cadence
}

export function setBudgetCadence(cadence: BudgetCadence): { cadence: BudgetCadence } {
  return setBudgetPeriodConfig({ cadence })
}

export function setBudgetPeriodConfig(input: Partial<BudgetPeriodConfig>): BudgetPeriodConfig {
  const current = getBudgetPeriodConfig()
  const normalized = normalizeBudgetCadence(input.cadence ?? current.cadence)
  const carrySurplus = input.carrySurplus ?? current.carrySurplus
  const carryDeficit = input.carryDeficit ?? current.carryDeficit
  getDb().prepare(`
    INSERT INTO budget_period_config(id, cadence, carry_surplus, carry_deficit, updated_at) VALUES(1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET cadence=excluded.cadence, carry_surplus=excluded.carry_surplus,
      carry_deficit=excluded.carry_deficit, updated_at=datetime('now')
  `).run(normalized, carrySurplus ? 1 : 0, carryDeficit ? 1 : 0)
  return { cadence: normalized, carrySurplus, carryDeficit }
}

export function getBudgetPeriod(input: { cadence?: BudgetCadence; year: number; month?: number | null }): BudgetPeriod | null {
  const cadence = input.cadence ? normalizeBudgetCadence(input.cadence) : getBudgetCadence()
  const bounds = getBudgetPeriodBounds({ cadence, year: input.year, month: input.month })
  const row = getDb().prepare(`
    SELECT id, cadence, year, month, start_date AS startDate, end_date AS endDate,
           amount, description, created_at AS createdAt, updated_at AS updatedAt
    FROM budget_periods WHERE cadence=? AND start_date=?
  `).get(cadence, bounds.startDate)
  return row ? mapPeriod(row) : null
}

export function listBudgetPeriods(input: { year?: number; cadence?: BudgetCadence } = {}): BudgetPeriod[] {
  const where: string[] = []
  const values: unknown[] = []
  if (input.year != null) { where.push('year=?'); values.push(Math.trunc(input.year)) }
  if (input.cadence) { where.push('cadence=?'); values.push(normalizeBudgetCadence(input.cadence)) }
  const rows = getDb().prepare(`
    SELECT id, cadence, year, month, start_date AS startDate, end_date AS endDate,
           amount, description, created_at AS createdAt, updated_at AS updatedAt
    FROM budget_periods ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY start_date DESC
  `).all(...values)
  return rows.map(mapPeriod)
}

export function upsertBudgetPeriod(input: {
  cadence?: BudgetCadence
  year: number
  month?: number | null
  amount: number
  description?: string | null
}): { id: number; created: boolean } {
  const cadence = input.cadence ? normalizeBudgetCadence(input.cadence) : getBudgetCadence()
  const bounds = getBudgetPeriodBounds({ cadence, year: input.year, month: input.month })
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Das Budget muss eine positive Zahl oder 0 sein')

  return withTransaction((db: DB) => {
    const existing = db.prepare('SELECT id FROM budget_periods WHERE cadence=? AND start_date=?')
      .get(cadence, bounds.startDate) as { id: number } | undefined
    if (existing) {
      db.prepare(`UPDATE budget_periods SET amount=?, description=?, updated_at=datetime('now') WHERE id=?`)
        .run(amount, input.description?.trim() || null, existing.id)
      return { id: existing.id, created: false }
    }
    const result = db.prepare(`
      INSERT INTO budget_periods(cadence, year, month, start_date, end_date, amount, description)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(cadence, bounds.year, bounds.month, bounds.startDate, bounds.endDate, amount, input.description?.trim() || null)
    return { id: Number(result.lastInsertRowid), created: true }
  })
}

export function upsertMonthlyBudgetYear(input: {
  year: number
  amount: number
  description?: string | null
  overwrite?: boolean
}): { updated: number } {
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Das Budget muss eine positive Zahl oder 0 sein')
  return withTransaction((db: DB) => {
    let updated = 0
    for (let month = 1; month <= 12; month += 1) {
      const bounds = getBudgetPeriodBounds({ cadence: 'MONTHLY', year: input.year, month })
      const existing = db.prepare(`SELECT id FROM budget_periods WHERE cadence='MONTHLY' AND start_date=?`)
        .get(bounds.startDate) as { id: number } | undefined
      if (existing && !input.overwrite) continue
      if (existing) {
        db.prepare(`UPDATE budget_periods SET amount=?, description=?, updated_at=datetime('now') WHERE id=?`)
          .run(amount, input.description?.trim() || null, existing.id)
      } else {
        db.prepare(`INSERT INTO budget_periods(cadence, year, month, start_date, end_date, amount, description) VALUES('MONTHLY', ?, ?, ?, ?, ?, ?)`)
          .run(input.year, month, bounds.startDate, bounds.endDate, amount, input.description?.trim() || null)
      }
      updated += 1
    }
    return { updated }
  })
}

export function deleteBudgetPeriod(id: number): { id: number } {
  getDb().prepare('DELETE FROM budget_periods WHERE id=?').run(id)
  return { id }
}

function voucherTotals(db: DB, startDate: string, endDate: string): { spent: number; income: number } {
  const row = db.prepare(`
    SELECT
      IFNULL(SUM(CASE WHEN type='OUT' THEN gross_amount ELSE 0 END), 0) AS spent,
      IFNULL(SUM(CASE WHEN type='IN' THEN gross_amount ELSE 0 END), 0) AS income
    FROM vouchers WHERE date>=? AND date<=?
  `).get(startDate, endDate) as { spent: number; income: number }
  return { spent: Number(row.spent || 0), income: Number(row.income || 0) }
}

function recurringForecast(db: DB, startDate: string, endDate: string): { projectedIncome: number; projectedSpent: number } {
  try {
    const rows = db.prepare(`
      SELECT frequency, interval_count AS intervalCount, anchor_day AS anchorDay,
             next_due_date AS nextDueDate, end_date AS endDate, template_json AS templateJson
      FROM recurring_booking_templates
      WHERE is_active=1 AND next_due_date<=? AND (end_date IS NULL OR end_date>=?)
    `).all(endDate, startDate) as Array<any>
    let projectedIncome = 0
    let projectedSpent = 0
    for (const row of rows) {
      let dueDate = String(row.nextDueDate)
      const template = JSON.parse(String(row.templateJson || '{}'))
      const amount = Math.max(0, Number(template.grossAmount || 0))
      let guard = 0
      while (dueDate <= endDate && (!row.endDate || dueDate <= String(row.endDate)) && guard < 1000) {
        if (dueDate >= startDate) {
          if (template.type === 'IN') projectedIncome += amount
          else if (template.type === 'OUT') projectedSpent += amount
        }
        dueDate = nextOccurrenceDate(dueDate, row.frequency as RecurrenceFrequency, Number(row.intervalCount || 1), Number(row.anchorDay || 1))
        guard += 1
      }
    }
    return { projectedIncome, projectedSpent }
  } catch {
    return { projectedIncome: 0, projectedSpent: 0 }
  }
}

function buildUsage(input: { cadence: BudgetCadence; year: number; month: number | null; startDate: string; endDate: string; budgeted: number; configuredPeriods: number; baseBudgeted?: number; carryover?: number }): BudgetUsage {
  const totals = voucherTotals(getDb(), input.startDate, input.endDate)
  const forecast = recurringForecast(getDb(), input.startDate, input.endDate)
  const netSpent = totals.spent - totals.income
  const remaining = input.budgeted - netSpent
  const percentage = input.budgeted > 0 ? Math.max(0, (netSpent / input.budgeted) * 100) : 0
  return {
    ...input,
    baseBudgeted: input.baseBudgeted ?? input.budgeted,
    carryover: input.carryover ?? 0,
    spent: totals.spent,
    income: totals.income,
    remaining,
    percentage,
    ...forecast,
    projectedRemaining: remaining - forecast.projectedSpent + forecast.projectedIncome
  }
}

export function getBudgetPeriodUsage(input: { cadence?: BudgetCadence; year: number; month?: number | null }): BudgetUsage {
  const cadence = input.cadence ? normalizeBudgetCadence(input.cadence) : getBudgetCadence()
  const bounds = getBudgetPeriodBounds({ cadence, year: input.year, month: input.month })
  const period = getBudgetPeriod({ cadence, year: input.year, month: input.month })
  if (cadence === 'ANNUAL') return buildUsage({ ...bounds, budgeted: period?.amount ?? 0, configuredPeriods: period ? 1 : 0 })

  const config = getBudgetPeriodConfig()
  let carryover = 0
  const targetMonth = bounds.month || 1
  for (let month = 1; month < targetMonth; month += 1) {
    const previousBounds = getBudgetPeriodBounds({ cadence: 'MONTHLY', year: input.year, month })
    const previous = getBudgetPeriod({ cadence: 'MONTHLY', year: input.year, month })
    const totals = voucherTotals(getDb(), previousBounds.startDate, previousBounds.endDate)
    const effectiveBudget = Number(previous?.amount || 0) + carryover
    const remaining = effectiveBudget - (totals.spent - totals.income)
    carryover = nextCarryover(remaining, config)
  }
  const baseBudgeted = period?.amount ?? 0
  return buildUsage({ ...bounds, budgeted: baseBudgeted + carryover, baseBudgeted, carryover, configuredPeriods: period ? 1 : 0 })
}

export function getBudgetYearUsage(year: number): BudgetUsage {
  const cadence = getBudgetCadence()
  const bounds = getBudgetPeriodBounds({ cadence: 'ANNUAL', year })
  if (cadence === 'ANNUAL') return getBudgetPeriodUsage({ cadence, year })
  const row = getDb().prepare(`
    SELECT IFNULL(SUM(amount), 0) AS budgeted, COUNT(*) AS configuredPeriods
    FROM budget_periods WHERE cadence='MONTHLY' AND year=?
  `).get(year) as { budgeted: number; configuredPeriods: number }
  return buildUsage({
    ...bounds,
    cadence: 'MONTHLY',
    budgeted: Number(row.budgeted || 0),
    configuredPeriods: Number(row.configuredPeriods || 0)
  })
}
