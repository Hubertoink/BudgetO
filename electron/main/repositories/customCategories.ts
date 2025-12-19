import Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'

type DB = InstanceType<typeof Database>

export interface CustomCategory {
  id: number
  name: string
  color: string | null
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  usageCount?: number
}

/**
 * List all custom categories with optional usage count
 */
export function listCustomCategories(params: { 
  includeInactive?: boolean 
  includeUsage?: boolean 
}): CustomCategory[] {
  const db = getDb()
  const where = params.includeInactive ? '' : 'WHERE c.is_active = 1'
  
  if (params.includeUsage) {
    try {
      return db.prepare(`
        SELECT 
          c.id, c.name, c.color, c.description, 
          c.sort_order as sortOrder, c.is_active as isActive,
          c.created_at as createdAt, c.updated_at as updatedAt,
          COUNT(v.id) as usageCount
        FROM custom_categories c
        LEFT JOIN vouchers v ON v.category_id = c.id
        ${where}
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `).all() as CustomCategory[]
    } catch (e) {
      // Fallback if table doesn't exist yet
      console.error('Custom categories query failed:', e)
      return []
    }
  }
  
  try {
    return db.prepare(`
      SELECT 
        id, name, color, description, 
        sort_order as sortOrder, is_active as isActive,
        created_at as createdAt, updated_at as updatedAt
      FROM custom_categories
      ${params.includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY sort_order ASC, name ASC
    `).all() as CustomCategory[]
  } catch (e) {
    console.error('Custom categories query failed:', e)
    return []
  }
}

/**
 * Get a single category by ID with usage count
 */
export function getCustomCategory(id: number): (CustomCategory & { usageCount: number }) | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT 
      c.id, c.name, c.color, c.description, 
      c.sort_order as sortOrder, c.is_active as isActive,
      c.created_at as createdAt, c.updated_at as updatedAt,
      COUNT(v.id) as usageCount
    FROM custom_categories c
    LEFT JOIN vouchers v ON v.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id) as (CustomCategory & { usageCount: number }) | undefined
  return row || null
}

/**
 * Create a new custom category
 */
export function createCustomCategory(input: {
  name: string
  color?: string | null
  description?: string | null
  sortOrder?: number
}): { id: number } {
  const db = getDb()
  
  // Get next sort order if not specified
  const sortOrder = input.sortOrder ?? (() => {
    const max = db.prepare('SELECT MAX(sort_order) as m FROM custom_categories').get() as { m: number | null }
    return (max?.m ?? 0) + 1
  })()
  
  const info = db.prepare(`
    INSERT INTO custom_categories (name, color, description, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(input.name, input.color ?? null, input.description ?? null, sortOrder)
  
  return { id: Number(info.lastInsertRowid) }
}

/**
 * Update a custom category
 */
export function updateCustomCategory(input: {
  id: number
  name?: string
  color?: string | null
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}): { id: number } {
  const db = getDb()
  const sets: string[] = ['updated_at = datetime(\'now\')']
  const vals: any[] = []
  
  if (input.name !== undefined) { sets.push('name = ?'); vals.push(input.name) }
  if (input.color !== undefined) { sets.push('color = ?'); vals.push(input.color) }
  if (input.description !== undefined) { sets.push('description = ?'); vals.push(input.description) }
  if (input.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(input.sortOrder) }
  if (input.isActive !== undefined) { sets.push('is_active = ?'); vals.push(input.isActive ? 1 : 0) }
  
  vals.push(input.id)
  db.prepare(`UPDATE custom_categories SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  
  return { id: input.id }
}

/**
 * Delete a custom category. 
 * Returns the number of vouchers that were affected (category_id set to null).
 */
export function deleteCustomCategory(id: number): { id: number; affectedVouchers: number } {
  return withTransaction((db: DB) => {
    // Count affected vouchers
    const countRow = db.prepare('SELECT COUNT(*) as c FROM vouchers WHERE category_id = ?').get(id) as { c: number }
    const affectedVouchers = countRow.c
    
    // Set category_id to null for affected vouchers
    db.prepare('UPDATE vouchers SET category_id = NULL WHERE category_id = ?').run(id)
    
    // Delete the category
    db.prepare('DELETE FROM custom_categories WHERE id = ?').run(id)
    
    return { id, affectedVouchers }
  })
}

/**
 * Reorder categories
 */
export function reorderCustomCategories(orderedIds: number[]): { ok: boolean } {
  return withTransaction((db: DB) => {
    const stmt = db.prepare('UPDATE custom_categories SET sort_order = ? WHERE id = ?')
    orderedIds.forEach((id, idx) => {
      stmt.run(idx, id)
    })
    return { ok: true }
  })
}

/**
 * Get usage count for a specific category (for delete confirmation)
 */
export function getCategoryUsageCount(id: number): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as c FROM vouchers WHERE category_id = ?').get(id) as { c: number }
  return row.c
}
