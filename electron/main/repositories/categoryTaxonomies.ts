import Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'
import { writeAudit } from '../services/audit'

type DB = InstanceType<typeof Database>

export interface CategoryTaxonomy {
  id: number
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  termCount?: number
  usageCount?: number
}

export interface CategoryTerm {
  id: number
  taxonomyId: number
  name: string
  color: string | null
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  usageCount?: number
}

function normalizeBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === '1' || s === 'true' || s === 'yes') return true
    if (s === '0' || s === 'false' || s === 'no') return false
  }
  return Boolean(v)
}

function normalizeTaxonomyRow(r: any): CategoryTaxonomy {
  return {
    ...r,
    id: Number(r.id),
    sortOrder: Number(r.sortOrder ?? 0),
    isActive: normalizeBoolean(r.isActive),
    termCount: r.termCount == null ? undefined : Number(r.termCount),
    usageCount: r.usageCount == null ? undefined : Number(r.usageCount)
  }
}

function normalizeTermRow(r: any): CategoryTerm {
  return {
    ...r,
    id: Number(r.id),
    taxonomyId: Number(r.taxonomyId),
    sortOrder: Number(r.sortOrder ?? 0),
    isActive: normalizeBoolean(r.isActive),
    usageCount: r.usageCount == null ? undefined : Number(r.usageCount)
  }
}

export function listCategoryTaxonomies(params: { includeInactive?: boolean; includeCounts?: boolean } = {}): CategoryTaxonomy[] {
  const db = getDb()
  const where = params.includeInactive ? '' : 'WHERE tx.is_active = 1'

  if (params.includeCounts) {
    const rows = db
      .prepare(
        `
        SELECT
          tx.id,
          tx.name,
          tx.description,
          tx.sort_order as sortOrder,
          tx.is_active as isActive,
          tx.created_at as createdAt,
          tx.updated_at as updatedAt,
          COUNT(DISTINCT t.id) as termCount,
          COUNT(DISTINCT vtt.voucher_id) as usageCount
        FROM category_taxonomies tx
        LEFT JOIN category_terms t ON t.taxonomy_id = tx.id
        LEFT JOIN voucher_taxonomy_terms vtt ON vtt.taxonomy_id = tx.id
        ${where}
        GROUP BY tx.id
        ORDER BY tx.sort_order ASC, tx.name COLLATE NOCASE ASC
      `
      )
      .all() as any[]

    return rows.map(normalizeTaxonomyRow)
  }

  const rows = db
    .prepare(
      `
      SELECT
        id,
        name,
        description,
        sort_order as sortOrder,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM category_taxonomies
      ${params.includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `
    )
    .all() as any[]

  return rows.map(normalizeTaxonomyRow)
}

export function createCategoryTaxonomy(input: {
  name: string
  description?: string | null
  sortOrder?: number
}): { id: number } {
  const db = getDb()
  const sortOrder = input.sortOrder ?? (() => {
    const max = db.prepare('SELECT MAX(sort_order) as m FROM category_taxonomies').get() as { m: number | null }
    return (max?.m ?? 0) + 1
  })()

  const info = db
    .prepare(
      `
      INSERT INTO category_taxonomies(name, description, sort_order)
      VALUES (?, ?, ?)
    `
    )
    .run(input.name, input.description ?? null, sortOrder)

  return { id: Number(info.lastInsertRowid) }
}

export function updateCategoryTaxonomy(input: {
  id: number
  name?: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}): { id: number } {
  const db = getDb()
  const sets: string[] = ["updated_at = datetime('now')"]
  const vals: any[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    vals.push(input.name)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    vals.push(input.description)
  }
  if (input.sortOrder !== undefined) {
    sets.push('sort_order = ?')
    vals.push(input.sortOrder)
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?')
    vals.push(input.isActive ? 1 : 0)
  }

  vals.push(input.id)
  db.prepare(`UPDATE category_taxonomies SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return { id: input.id }
}

export function deleteCategoryTaxonomy(id: number): { id: number; affectedVouchers: number } {
  return withTransaction((db: DB) => {
    const cnt = db
      .prepare('SELECT COUNT(DISTINCT voucher_id) as c FROM voucher_taxonomy_terms WHERE taxonomy_id = ?')
      .get(id) as { c: number }
    const affectedVouchers = Number(cnt?.c ?? 0)

    db.prepare('DELETE FROM category_taxonomies WHERE id = ?').run(id)
    return { id, affectedVouchers }
  })
}

export function listCategoryTerms(params: {
  taxonomyId: number
  includeInactive?: boolean
  includeUsage?: boolean
}): CategoryTerm[] {
  const db = getDb()
  const wh: string[] = []
  const args: any[] = []
  if (!params.includeInactive) wh.push('t.is_active = 1')
  wh.push('t.taxonomy_id = ?')
  args.push(params.taxonomyId)
  const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : ''

  if (params.includeUsage) {
    const rows = db
      .prepare(
        `
        SELECT
          t.id,
          t.taxonomy_id as taxonomyId,
          t.name,
          t.color,
          t.description,
          t.sort_order as sortOrder,
          t.is_active as isActive,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          COUNT(vtt.voucher_id) as usageCount
        FROM category_terms t
        LEFT JOIN voucher_taxonomy_terms vtt ON vtt.term_id = t.id
        ${whereSql}
        GROUP BY t.id
        ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC
      `
      )
      .all(...args) as any[]

    return rows.map(normalizeTermRow)
  }

  const rows = db
    .prepare(
      `
      SELECT
        id,
        taxonomy_id as taxonomyId,
        name,
        color,
        description,
        sort_order as sortOrder,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM category_terms t
      ${whereSql}
      ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC
    `
    )
    .all(...args) as any[]

  return rows.map(normalizeTermRow)
}

export function createCategoryTerm(input: {
  taxonomyId: number
  name: string
  color?: string | null
  description?: string | null
  sortOrder?: number
}): { id: number } {
  const db = getDb()
  const sortOrder = input.sortOrder ?? (() => {
    const max = db
      .prepare('SELECT MAX(sort_order) as m FROM category_terms WHERE taxonomy_id = ?')
      .get(input.taxonomyId) as { m: number | null }
    return (max?.m ?? 0) + 1
  })()

  const info = db
    .prepare(
      `
      INSERT INTO category_terms(taxonomy_id, name, color, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(input.taxonomyId, input.name, input.color ?? null, input.description ?? null, sortOrder)

  return { id: Number(info.lastInsertRowid) }
}

export function updateCategoryTerm(input: {
  id: number
  name?: string
  color?: string | null
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}): { id: number } {
  const db = getDb()
  const sets: string[] = ["updated_at = datetime('now')"]
  const vals: any[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    vals.push(input.name)
  }
  if (input.color !== undefined) {
    sets.push('color = ?')
    vals.push(input.color)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    vals.push(input.description)
  }
  if (input.sortOrder !== undefined) {
    sets.push('sort_order = ?')
    vals.push(input.sortOrder)
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?')
    vals.push(input.isActive ? 1 : 0)
  }

  vals.push(input.id)
  db.prepare(`UPDATE category_terms SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return { id: input.id }
}

export function deleteCategoryTerm(id: number): { id: number; affectedVouchers: number } {
  return withTransaction((db: DB) => {
    const cnt = db
      .prepare('SELECT COUNT(*) as c FROM voucher_taxonomy_terms WHERE term_id = ?')
      .get(id) as { c: number }
    const affectedVouchers = Number(cnt?.c ?? 0)

    db.prepare('DELETE FROM category_terms WHERE id = ?').run(id)
    return { id, affectedVouchers }
  })
}

export function batchAssignCategoryTaxonomyTerm(params: {
  taxonomyId: number
  termId: number
  paymentMethod?: 'BAR' | 'BANK'
  sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  categoryId?: number
  type?: 'IN' | 'OUT' | 'TRANSFER'
  from?: string
  to?: string
  q?: string
  onlyWithout?: boolean
}): { updated: number } {
  const db = getDb()

  // Validate term belongs to taxonomy
  const termRow = db
    .prepare('SELECT id, taxonomy_id as taxonomyId, is_active as isActive FROM category_terms WHERE id = ?')
    .get(params.termId) as { id: number; taxonomyId: number; isActive: number } | undefined

  if (!termRow) throw new Error('Begriff nicht gefunden')
  if (termRow.taxonomyId !== params.taxonomyId) throw new Error('Begriff gehört nicht zur ausgewählten Taxonomie')
  if (!termRow.isActive) throw new Error('Begriff ist inaktiv und kann nicht verwendet werden')

  const taxRow = db
    .prepare('SELECT id, is_active as isActive FROM category_taxonomies WHERE id = ?')
    .get(params.taxonomyId) as { id: number; isActive: number } | undefined
  if (!taxRow) throw new Error('Taxonomie nicht gefunden')
  if (!taxRow.isActive) throw new Error('Taxonomie ist inaktiv und kann nicht verwendet werden')

  const wh: string[] = []
  const args: any[] = []
  if (params.paymentMethod) {
    wh.push('payment_method = ?')
    args.push(params.paymentMethod)
  }
  if (params.sphere) {
    wh.push('sphere = ?')
    args.push(params.sphere)
  }
  if (typeof params.categoryId === 'number') {
    wh.push('category_id = ?')
    args.push(params.categoryId)
  }
  if (params.type) {
    wh.push('type = ?')
    args.push(params.type)
  }
  if (params.from) {
    wh.push('date >= ?')
    args.push(params.from)
  }
  if (params.to) {
    wh.push('date <= ?')
    args.push(params.to)
  }
  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`
    wh.push('(voucher_no LIKE ? OR description LIKE ? OR counterparty LIKE ? OR date LIKE ?)')
    args.push(like, like, like, like)
  }

  // onlyWithout: exclude vouchers that already have an assignment for this taxonomy
  if (params.onlyWithout) {
    wh.push(
      'NOT EXISTS (SELECT 1 FROM voucher_taxonomy_terms vtt WHERE vtt.voucher_id = vouchers.id AND vtt.taxonomy_id = ?)'
    )
    args.push(params.taxonomyId)
  }

  const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

  // Determine affected vouchers count (for a stable return value)
  const cnt = db.prepare(`SELECT COUNT(*) as c FROM vouchers${whereSql}`).get(...args) as { c: number }
  const updated = Number(cnt?.c ?? 0)
  if (updated === 0) return { updated: 0 }

  // Upsert assignments for all matching vouchers
  db.prepare(
    `
    INSERT INTO voucher_taxonomy_terms(voucher_id, taxonomy_id, term_id)
    SELECT id, ?, ? FROM vouchers${whereSql}
    ON CONFLICT(voucher_id, taxonomy_id) DO UPDATE SET
      term_id = excluded.term_id,
      updated_at = datetime('now')
  `
  ).run(params.taxonomyId, params.termId, ...args)

  // Audit log
  try {
    const info = db
      .prepare(
        `
        SELECT
          tx.name as taxonomyName,
          t.name as termName
        FROM category_taxonomies tx
        JOIN category_terms t ON t.id = ?
        WHERE tx.id = ?
      `
      )
      .get(params.termId, params.taxonomyId) as any

    writeAudit(db, null, 'VOUCHER', 0, 'BATCH_ASSIGN_TAXONOMY', {
      taxonomyId: params.taxonomyId,
      taxonomyName: info?.taxonomyName,
      termId: params.termId,
      termName: info?.termName,
      count: updated,
      filters: params
    })
  } catch {
    // ignore audit lookup errors
  }

  return { updated }
}

export function listVoucherTaxonomyAssignments(voucherId: number): Array<{ taxonomyId: number; termId: number }> {
  const db = getDb()
  const rows = db
    .prepare(
      `
      SELECT taxonomy_id as taxonomyId, term_id as termId
      FROM voucher_taxonomy_terms
      WHERE voucher_id = ?
    `
    )
    .all(voucherId) as any[]

  return rows.map((r) => ({ taxonomyId: Number(r.taxonomyId), termId: Number(r.termId) }))
}

export function setVoucherTaxonomyAssignment(params: {
  voucherId: number
  taxonomyId: number
  termId: number | null
}): { ok: true } {
  const db = getDb()

  // Validate taxonomy exists
  const tax = db
    .prepare('SELECT id, is_active as isActive FROM category_taxonomies WHERE id = ?')
    .get(params.taxonomyId) as any
  if (!tax) throw new Error('Taxonomie nicht gefunden')
  if (!tax.isActive) throw new Error('Taxonomie ist inaktiv und kann nicht verwendet werden')

  if (params.termId == null) {
    db.prepare('DELETE FROM voucher_taxonomy_terms WHERE voucher_id = ? AND taxonomy_id = ?').run(
      params.voucherId,
      params.taxonomyId
    )
    return { ok: true }
  }

  // Validate term belongs to taxonomy and active
  const term = db
    .prepare('SELECT id, taxonomy_id as taxonomyId, is_active as isActive FROM category_terms WHERE id = ?')
    .get(params.termId) as any
  if (!term) throw new Error('Begriff nicht gefunden')
  if (Number(term.taxonomyId) !== Number(params.taxonomyId)) throw new Error('Begriff gehört nicht zur ausgewählten Taxonomie')
  if (!term.isActive) throw new Error('Begriff ist inaktiv und kann nicht verwendet werden')

  db.prepare(
    `
    INSERT INTO voucher_taxonomy_terms(voucher_id, taxonomy_id, term_id)
    VALUES (?, ?, ?)
    ON CONFLICT(voucher_id, taxonomy_id) DO UPDATE SET
      term_id = excluded.term_id,
      updated_at = datetime('now')
  `
  ).run(params.voucherId, params.taxonomyId, params.termId)

  return { ok: true }
}
