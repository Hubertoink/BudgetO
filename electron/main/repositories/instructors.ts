import { getDb, getAppDataDir } from '../db/database'
import fs from 'node:fs'
import path from 'node:path'

/**
 * BudgetO Phase 3: Übungsleiter (Instructors) Repository
 * Manages instructors, their contracts, and invoices
 */

export type InstructorStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface Instructor {
  id: number
  name: string
  status: InstructorStatus
  yearlyCap: number | null
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export interface InstructorContract {
  id: number
  instructorId: number
  title: string | null
  startDate: string | null
  endDate: string | null
  fileName: string
  filePath: string
  mimeType: string | null
  size: number | null
  createdAt: string
}

export interface InstructorInvoice {
  id: number
  instructorId: number
  date: string
  description: string | null
  amount: number
  voucherId: number | null
  fileName: string | null
  filePath: string | null
  mimeType: string | null
  fileSize: number | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructors CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function listInstructors(opts?: {
  status?: InstructorStatus
  q?: string
  limit?: number
  offset?: number
}): { rows: Instructor[]; total: number } {
  const d = getDb()
  const { status, q, limit = 50, offset = 0 } = opts || {}

  const wh: string[] = []
  const params: any[] = []

  if (status) {
    wh.push('status = ?')
    params.push(status)
  }
  if (q && q.trim()) {
    wh.push('(name LIKE ? OR notes LIKE ?)')
    const like = `%${q.trim()}%`
    params.push(like, like)
  }

  const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

  const countRow = d.prepare(`SELECT COUNT(*) as cnt FROM instructors ${whereSql}`).get(...params) as { cnt: number }
  const total = countRow?.cnt || 0

  const rows = d.prepare(`
    SELECT id, name, status, yearly_cap as yearlyCap, notes, created_at as createdAt, updated_at as updatedAt
    FROM instructors
    ${whereSql}
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[]

  return {
    rows: rows.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status as InstructorStatus,
      yearlyCap: r.yearlyCap ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt ?? null
    })),
    total
  }
}

export function getInstructorById(id: number): Instructor & { contracts: InstructorContract[]; invoices: InstructorInvoice[]; totalInvoiced: number } {
  const d = getDb()
  const row = d.prepare(`
    SELECT id, name, status, yearly_cap as yearlyCap, notes, created_at as createdAt, updated_at as updatedAt
    FROM instructors WHERE id = ?
  `).get(id) as any

  if (!row) throw new Error('Übungsleiter nicht gefunden')

  const contracts = d.prepare(`
    SELECT id, instructor_id as instructorId, title, start_date as startDate, end_date as endDate,
           file_name as fileName, file_path as filePath, mime_type as mimeType, size, created_at as createdAt
    FROM instructor_contracts WHERE instructor_id = ?
    ORDER BY created_at DESC
  `).all(id) as InstructorContract[]

  const invoices = d.prepare(`
    SELECT id, instructor_id as instructorId, date, description, amount, voucher_id as voucherId, 
           file_name as fileName, file_path as filePath, mime_type as mimeType, file_size as fileSize,
           created_at as createdAt
    FROM instructor_invoices WHERE instructor_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as InstructorInvoice[]

  const totalRow = d.prepare('SELECT IFNULL(SUM(amount), 0) as total FROM instructor_invoices WHERE instructor_id = ?').get(id) as { total: number }

  return {
    id: row.id,
    name: row.name,
    status: row.status as InstructorStatus,
    yearlyCap: row.yearlyCap ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    contracts,
    invoices,
    totalInvoiced: totalRow?.total || 0
  }
}

export function createInstructor(input: {
  name: string
  status?: InstructorStatus
  yearlyCap?: number | null
  notes?: string | null
}): { id: number } {
  const d = getDb()
  const { name, status = 'ACTIVE', yearlyCap, notes } = input

  if (!name || !name.trim()) throw new Error('Name ist erforderlich')

  const info = d.prepare(`
    INSERT INTO instructors (name, status, yearly_cap, notes)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), status, yearlyCap ?? null, notes ?? null)

  return { id: Number(info.lastInsertRowid) }
}

export function updateInstructor(input: {
  id: number
  name?: string
  status?: InstructorStatus
  yearlyCap?: number | null
  notes?: string | null
}): { id: number } {
  const d = getDb()
  const { id, name, status, yearlyCap, notes } = input

  const existing = d.prepare('SELECT id FROM instructors WHERE id = ?').get(id)
  if (!existing) throw new Error('Übungsleiter nicht gefunden')

  const sets: string[] = []
  const params: any[] = []

  if (name !== undefined) {
    if (!name.trim()) throw new Error('Name darf nicht leer sein')
    sets.push('name = ?')
    params.push(name.trim())
  }
  if (status !== undefined) {
    sets.push('status = ?')
    params.push(status)
  }
  if (yearlyCap !== undefined) {
    sets.push('yearly_cap = ?')
    params.push(yearlyCap)
  }
  if (notes !== undefined) {
    sets.push('notes = ?')
    params.push(notes)
  }

  if (sets.length === 0) return { id }

  sets.push("updated_at = datetime('now')")
  params.push(id)

  d.prepare(`UPDATE instructors SET ${sets.join(', ')} WHERE id = ?`).run(...params)

  return { id }
}

export function deleteInstructor(id: number): { id: number } {
  const d = getDb()

  // Delete contract files from disk
  const contracts = d.prepare('SELECT file_path as filePath FROM instructor_contracts WHERE instructor_id = ?').all(id) as { filePath: string }[]
  for (const c of contracts) {
    try {
      if (c.filePath && fs.existsSync(c.filePath)) fs.unlinkSync(c.filePath)
    } catch { /* ignore */ }
  }

  d.prepare('DELETE FROM instructors WHERE id = ?').run(id)
  return { id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contracts
// ─────────────────────────────────────────────────────────────────────────────

export function addContract(input: {
  instructorId: number
  title?: string | null
  startDate?: string | null
  endDate?: string | null
  fileName: string
  dataBase64: string
  mimeType?: string | null
}): { id: number } {
  const d = getDb()
  const { instructorId, title, startDate, endDate, fileName, dataBase64, mimeType } = input

  const existing = d.prepare('SELECT id FROM instructors WHERE id = ?').get(instructorId)
  if (!existing) throw new Error('Übungsleiter nicht gefunden')

  const { filesDir } = getAppDataDir()
  const buff = Buffer.from(dataBase64, 'base64')
  const safeName = `instructor-${instructorId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  const abs = path.join(filesDir, safeName)
  fs.writeFileSync(abs, buff)

  const info = d.prepare(`
    INSERT INTO instructor_contracts (instructor_id, title, start_date, end_date, file_name, file_path, mime_type, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(instructorId, title ?? null, startDate ?? null, endDate ?? null, fileName, abs, mimeType ?? null, buff.length)

  return { id: Number(info.lastInsertRowid) }
}

export function deleteContract(contractId: number): { id: number } {
  const d = getDb()
  const row = d.prepare('SELECT file_path as filePath FROM instructor_contracts WHERE id = ?').get(contractId) as { filePath: string } | undefined
  d.prepare('DELETE FROM instructor_contracts WHERE id = ?').run(contractId)
  try {
    if (row?.filePath && fs.existsSync(row.filePath)) fs.unlinkSync(row.filePath)
  } catch { /* ignore */ }
  return { id: contractId }
}

export function getContractFile(contractId: number): { fileName: string; filePath: string; mimeType: string | null } | null {
  const d = getDb()
  const row = d.prepare(`
    SELECT file_name as fileName, file_path as filePath, mime_type as mimeType
    FROM instructor_contracts WHERE id = ?
  `).get(contractId) as { fileName: string; filePath: string; mimeType: string | null } | undefined
  return row ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructor Invoices
// ─────────────────────────────────────────────────────────────────────────────

export function addInstructorInvoice(input: {
  instructorId: number
  date: string
  description?: string | null
  amount: number
  voucherId?: number | null
  fileName?: string | null
  dataBase64?: string | null
  mimeType?: string | null
}): { id: number } {
  const d = getDb()
  const { instructorId, date, description, amount, voucherId, fileName, dataBase64, mimeType } = input

  const existing = d.prepare('SELECT id FROM instructors WHERE id = ?').get(instructorId)
  if (!existing) throw new Error('Übungsleiter nicht gefunden')

  if (amount <= 0) throw new Error('Betrag muss positiv sein')

  let savedFilePath: string | null = null
  let fileSize: number | null = null

  // Handle file upload if provided
  if (fileName && dataBase64) {
    const { filesDir } = getAppDataDir()
    const buff = Buffer.from(dataBase64, 'base64')
    const safeName = `invoice-${instructorId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    savedFilePath = path.join(filesDir, safeName)
    fs.writeFileSync(savedFilePath, buff)
    fileSize = buff.length
  }

  const info = d.prepare(`
    INSERT INTO instructor_invoices (instructor_id, date, description, amount, voucher_id, file_name, file_path, mime_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(instructorId, date, description ?? null, amount, voucherId ?? null, fileName ?? null, savedFilePath, mimeType ?? null, fileSize)

  return { id: Number(info.lastInsertRowid) }
}

export function deleteInstructorInvoice(invoiceId: number): { id: number } {
  const d = getDb()
  // Delete associated file if exists
  const row = d.prepare('SELECT file_path as filePath FROM instructor_invoices WHERE id = ?').get(invoiceId) as { filePath: string | null } | undefined
  if (row?.filePath) {
    try {
      if (fs.existsSync(row.filePath)) fs.unlinkSync(row.filePath)
    } catch { /* ignore */ }
  }
  d.prepare('DELETE FROM instructor_invoices WHERE id = ?').run(invoiceId)
  return { id: invoiceId }
}

export function getInvoiceFile(invoiceId: number): { fileName: string; filePath: string; mimeType: string | null } | null {
  const d = getDb()
  const row = d.prepare(`
    SELECT file_name as fileName, file_path as filePath, mime_type as mimeType
    FROM instructor_invoices WHERE id = ?
  `).get(invoiceId) as { fileName: string | null; filePath: string | null; mimeType: string | null } | undefined
  if (!row?.fileName || !row?.filePath) return null
  return { fileName: row.fileName, filePath: row.filePath, mimeType: row.mimeType }
}

// ─────────────────────────────────────────────────────────────────────────────
// Yearly Summary
// ─────────────────────────────────────────────────────────────────────────────

export function getInstructorYearlySummary(instructorId: number, year: number): {
  total: number
  cap: number | null
  remaining: number | null
  invoices: InstructorInvoice[]
} {
  const d = getDb()
  const instructor = d.prepare('SELECT yearly_cap as yearlyCap FROM instructors WHERE id = ?').get(instructorId) as { yearlyCap: number | null } | undefined
  if (!instructor) throw new Error('Übungsleiter nicht gefunden')

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const invoices = d.prepare(`
    SELECT id, instructor_id as instructorId, date, description, amount, voucher_id as voucherId, 
           file_name as fileName, file_path as filePath, mime_type as mimeType, file_size as fileSize,
           created_at as createdAt
    FROM instructor_invoices
    WHERE instructor_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(instructorId, yearStart, yearEnd) as InstructorInvoice[]

  const total = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
  const cap = instructor.yearlyCap
  const remaining = cap !== null ? Math.max(0, cap - total) : null

  return { total, cap, remaining, invoices }
}
