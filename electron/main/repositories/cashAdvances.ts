/**
 * BudgetO Phase 4: Cash Advances (Barvorschüsse) Repository
 * 
 * Neue Logik:
 * - Kassier holt Barvorschuss (z.B. 1000 €) = total_amount
 * - Gibt Teil-Vorschüsse an Personen (z.B. Peter 250 €, Susanne 250 €)
 * - Personen lösen ihre Vorschüsse später mit tatsächlichen Ausgaben auf
 * - Planerisch verfügbar: total_amount - Summe(vergeben)
 * - Faktisch verfügbar: total_amount - Summe(abgerechnet)
 */

import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir, getDb } from '../db/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CashAdvanceStatus = 'OPEN' | 'RESOLVED' | 'OVERDUE'

export interface CashAdvance {
  id: number
  orderNumber: string
  employeeName: string // Kassier der den Barvorschuss geholt hat
  purpose: string | null
  totalAmount: number // Initialer Barvorschuss-Betrag
  status: CashAdvanceStatus
  createdAt: string
  resolvedAt: string | null
  dueDate: string | null
  notes: string | null
  costCenterId: number | null
}

export interface PartialCashAdvance {
  id: number
  cashAdvanceId: number
  recipientName: string | null // Wer hat den Teil-Vorschuss bekommen
  amount: number // Vergebener Betrag
  issuedAt: string
  description: string | null
  isSettled: boolean
  settledAmount: number | null // Tatsächlich abgerechneter Betrag
  settledAt: string | null
}

export interface CashAdvanceSettlement {
  id: number
  cashAdvanceId: number
  amount: number
  settledAt: string
  description: string | null
  receiptFileName: string | null
  receiptFilePath: string | null
  receiptMimeType: string | null
  voucherId: number | null
}

export interface CashAdvanceWithDetails extends CashAdvance {
  partials: PartialCashAdvance[]
  settlements: CashAdvanceSettlement[]
  // Neue Berechnungen
  totalPlanned: number      // Summe aller vergebenen Teil-Vorschüsse
  totalSettled: number      // Summe aller Abrechnungen (aus Teil-Vorschüssen)
  plannedRemaining: number  // Planerisch noch verfügbar: totalAmount - totalPlanned
  actualRemaining: number   // Faktisch noch verfügbar: totalAmount - totalSettled
  coverage: number          // Über-/Unterdeckung: totalSettled - totalPlanned (negative = gut)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function listCashAdvances(opts?: {
  status?: CashAdvanceStatus | 'ALL'
  search?: string
  limit?: number
  offset?: number
}): { items: (CashAdvance & { recipientCount: number; totalPlanned: number; totalSettled: number })[]; total: number } {
  const db = getDb()
  const { status = 'ALL', search = '', limit = 50, offset = 0 } = opts || {}

  let where = '1=1'
  const params: any[] = []

  if (status !== 'ALL') {
    where += ' AND status = ?'
    params.push(status)
  }

  if (search.trim()) {
    where += ' AND (order_number LIKE ? OR employee_name LIKE ? OR purpose LIKE ?)'
    const q = `%${search.trim()}%`
    params.push(q, q, q)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM cash_advances WHERE ${where}`).get(...params) as { cnt: number }
  const total = countRow?.cnt || 0

  // Extended query with aggregates for list view
  const rows = db.prepare(`
    SELECT 
      ca.id, ca.order_number as orderNumber, ca.employee_name as employeeName,
      ca.purpose, ca.total_amount as totalAmount, ca.status,
      ca.created_at as createdAt, ca.resolved_at as resolvedAt,
      ca.due_date as dueDate, ca.notes, ca.cost_center_id as costCenterId,
      COALESCE((SELECT COUNT(*) FROM partial_cash_advances WHERE cash_advance_id = ca.id), 0) as recipientCount,
      COALESCE((SELECT SUM(amount) FROM partial_cash_advances WHERE cash_advance_id = ca.id), 0) as totalPlanned,
      COALESCE((SELECT SUM(settled_amount) FROM partial_cash_advances WHERE cash_advance_id = ca.id AND is_settled = 1), 0) as totalSettled
    FROM cash_advances ca
    WHERE ${where.replace(/\b(status|order_number|employee_name|purpose)\b/g, 'ca.$1')}
    ORDER BY ca.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (CashAdvance & { recipientCount: number; totalPlanned: number; totalSettled: number })[]

  return { items: rows, total }
}

export function getCashAdvanceById(id: number): CashAdvanceWithDetails | null {
  const db = getDb()

  const row = db.prepare(`
    SELECT 
      id, order_number as orderNumber, employee_name as employeeName,
      purpose, total_amount as totalAmount, status,
      created_at as createdAt, resolved_at as resolvedAt,
      due_date as dueDate, notes, cost_center_id as costCenterId
    FROM cash_advances WHERE id = ?
  `).get(id) as CashAdvance | undefined

  if (!row) return null

  const partials = db.prepare(`
    SELECT id, cash_advance_id as cashAdvanceId, 
           recipient_name as recipientName, amount, 
           issued_at as issuedAt, description,
           is_settled as isSettled,
           settled_amount as settledAmount,
           settled_at as settledAt
    FROM partial_cash_advances
    WHERE cash_advance_id = ?
    ORDER BY issued_at ASC
  `).all(id).map((p: any) => ({
    ...p,
    isSettled: p.isSettled === 1
  })) as PartialCashAdvance[]

  const settlements = db.prepare(`
    SELECT id, cash_advance_id as cashAdvanceId, amount,
           settled_at as settledAt, description,
           receipt_file_name as receiptFileName,
           receipt_file_path as receiptFilePath,
           receipt_mime_type as receiptMimeType,
           voucher_id as voucherId
    FROM cash_advance_settlements
    WHERE cash_advance_id = ?
    ORDER BY settled_at ASC
  `).all(id) as CashAdvanceSettlement[]

  // Neue Berechnungen
  const totalPlanned = partials.reduce((sum, p) => sum + p.amount, 0)
  const totalSettled = partials.reduce((sum, p) => sum + (p.settledAmount || 0), 0)
  const plannedRemaining = row.totalAmount - totalPlanned
  const actualRemaining = row.totalAmount - totalSettled
  const coverage = totalSettled - totalPlanned

  return {
    ...row,
    partials,
    settlements,
    totalPlanned,
    totalSettled,
    plannedRemaining,
    actualRemaining,
    coverage
  }
}

export function createCashAdvance(input: {
  orderNumber: string
  employeeName: string
  purpose?: string | null
  totalAmount: number // Jetzt Pflichtfeld!
  dueDate?: string | null
  notes?: string | null
  costCenterId?: number | null
}): { id: number } {
  const db = getDb()
  const { orderNumber, employeeName, purpose, totalAmount, dueDate, notes, costCenterId } = input

  if (!orderNumber?.trim()) throw new Error('Anordnungsnummer ist erforderlich')
  if (!employeeName?.trim()) throw new Error('Name ist erforderlich')
  if (totalAmount == null || totalAmount <= 0) throw new Error('Barvorschuss-Betrag muss positiv sein')

  // Check uniqueness
  const existing = db.prepare('SELECT id FROM cash_advances WHERE order_number = ?').get(orderNumber.trim())
  if (existing) throw new Error(`Anordnungsnummer "${orderNumber}" existiert bereits`)

  const info = db.prepare(`
    INSERT INTO cash_advances (order_number, employee_name, purpose, total_amount, due_date, notes, cost_center_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderNumber.trim(), employeeName.trim(), purpose ?? null, totalAmount, dueDate ?? null, notes ?? null, costCenterId ?? null)

  return { id: Number(info.lastInsertRowid) }
}

export function updateCashAdvance(input: {
  id: number
  orderNumber?: string
  employeeName?: string
  purpose?: string | null
  totalAmount?: number
  status?: CashAdvanceStatus
  dueDate?: string | null
  notes?: string | null
  costCenterId?: number | null
}): { id: number } {
  const db = getDb()
  const { id, ...fields } = input

  const existing = db.prepare('SELECT id FROM cash_advances WHERE id = ?').get(id)
  if (!existing) throw new Error('Barvorschuss nicht gefunden')

  const sets: string[] = []
  const params: any[] = []

  if (fields.orderNumber !== undefined) {
    const dup = db.prepare('SELECT id FROM cash_advances WHERE order_number = ? AND id != ?').get(fields.orderNumber.trim(), id)
    if (dup) throw new Error(`Anordnungsnummer "${fields.orderNumber}" existiert bereits`)
    sets.push('order_number = ?')
    params.push(fields.orderNumber.trim())
  }
  if (fields.employeeName !== undefined) {
    sets.push('employee_name = ?')
    params.push(fields.employeeName.trim())
  }
  if (fields.purpose !== undefined) {
    sets.push('purpose = ?')
    params.push(fields.purpose)
  }
  if (fields.totalAmount !== undefined) {
    sets.push('total_amount = ?')
    params.push(fields.totalAmount)
  }
  if (fields.status !== undefined) {
    sets.push('status = ?')
    params.push(fields.status)
    if (fields.status === 'RESOLVED') {
      sets.push("resolved_at = datetime('now')")
    } else {
      sets.push('resolved_at = NULL')
    }
  }
  if (fields.dueDate !== undefined) {
    sets.push('due_date = ?')
    params.push(fields.dueDate)
  }
  if (fields.notes !== undefined) {
    sets.push('notes = ?')
    params.push(fields.notes)
  }
  if (fields.costCenterId !== undefined) {
    sets.push('cost_center_id = ?')
    params.push(fields.costCenterId)
  }

  if (sets.length > 0) {
    params.push(id)
    db.prepare(`UPDATE cash_advances SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  return { id }
}

export function deleteCashAdvance(id: number): { id: number } {
  const db = getDb()

  // Delete associated files first
  const settlements = db.prepare('SELECT receipt_file_path as filePath FROM cash_advance_settlements WHERE cash_advance_id = ?').all(id) as { filePath: string | null }[]
  for (const s of settlements) {
    if (s.filePath && fs.existsSync(s.filePath)) {
      try { fs.unlinkSync(s.filePath) } catch { /* ignore */ }
    }
  }

  db.prepare('DELETE FROM cash_advances WHERE id = ?').run(id)
  return { id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Partial Cash Advances (Teil-Vorschüsse an Personen)
// ─────────────────────────────────────────────────────────────────────────────

export function addPartialCashAdvance(input: {
  cashAdvanceId: number
  recipientName: string // Wer bekommt den Vorschuss
  amount: number
  issuedAt?: string
  description?: string | null
}): { id: number } {
  const db = getDb()
  const { cashAdvanceId, recipientName, amount, issuedAt, description } = input

  if (amount <= 0) throw new Error('Betrag muss positiv sein')
  if (!recipientName?.trim()) throw new Error('Empfängername ist erforderlich')

  const existing = db.prepare('SELECT id, total_amount FROM cash_advances WHERE id = ?').get(cashAdvanceId) as { id: number; total_amount: number } | undefined
  if (!existing) throw new Error('Barvorschuss nicht gefunden')

  // Check if we'd exceed the total
  const currentTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM partial_cash_advances WHERE cash_advance_id = ?').get(cashAdvanceId) as { total: number }
  if (currentTotal.total + amount > existing.total_amount) {
    throw new Error(`Betrag überschreitet verfügbaren Barvorschuss (noch ${existing.total_amount - currentTotal.total} € verfügbar)`)
  }

  const info = db.prepare(`
    INSERT INTO partial_cash_advances (cash_advance_id, recipient_name, amount, issued_at, description, is_settled)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(cashAdvanceId, recipientName.trim(), amount, issuedAt || new Date().toISOString().slice(0, 10), description ?? null)

  return { id: Number(info.lastInsertRowid) }
}

export function settlePartialCashAdvance(input: {
  id: number
  settledAmount: number
  settledAt?: string
}): { id: number } {
  const db = getDb()
  const { id, settledAmount, settledAt } = input

  if (settledAmount < 0) throw new Error('Abgerechneter Betrag kann nicht negativ sein')

  const existing = db.prepare('SELECT id FROM partial_cash_advances WHERE id = ?').get(id)
  if (!existing) throw new Error('Teil-Vorschuss nicht gefunden')

  db.prepare(`
    UPDATE partial_cash_advances 
    SET settled_amount = ?, settled_at = ?, is_settled = 1
    WHERE id = ?
  `).run(settledAmount, settledAt || new Date().toISOString().slice(0, 10), id)

  return { id }
}

export function deletePartialCashAdvance(id: number): { id: number } {
  const db = getDb()
  db.prepare('DELETE FROM partial_cash_advances WHERE id = ?').run(id)
  return { id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlements (Abrechnungen) - Legacy, noch für Belege
// ─────────────────────────────────────────────────────────────────────────────

export function addSettlement(input: {
  cashAdvanceId: number
  amount: number
  settledAt?: string
  description?: string | null
  voucherId?: number | null
  fileName?: string | null
  dataBase64?: string | null
  mimeType?: string | null
}): { id: number } {
  const db = getDb()
  const { cashAdvanceId, amount, settledAt, description, voucherId, fileName, dataBase64, mimeType } = input

  if (amount <= 0) throw new Error('Betrag muss positiv sein')

  const existing = db.prepare('SELECT id FROM cash_advances WHERE id = ?').get(cashAdvanceId)
  if (!existing) throw new Error('Barvorschuss nicht gefunden')

  let filePath: string | null = null
  if (fileName && dataBase64) {
    const { filesDir } = getAppDataDir()
    const buff = Buffer.from(dataBase64, 'base64')
    const safeName = `ca-settlement-${cashAdvanceId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    filePath = path.join(filesDir, safeName)
    fs.writeFileSync(filePath, buff)
  }

  const info = db.prepare(`
    INSERT INTO cash_advance_settlements (cash_advance_id, amount, settled_at, description, voucher_id, receipt_file_name, receipt_file_path, receipt_mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cashAdvanceId, 
    amount, 
    settledAt || new Date().toISOString().slice(0, 10), 
    description ?? null, 
    voucherId ?? null,
    fileName ?? null,
    filePath,
    mimeType ?? null
  )

  return { id: Number(info.lastInsertRowid) }
}

export function deleteSettlement(id: number): { id: number } {
  const db = getDb()
  const row = db.prepare('SELECT receipt_file_path as filePath FROM cash_advance_settlements WHERE id = ?').get(id) as { filePath: string | null } | undefined
  
  if (row?.filePath && fs.existsSync(row.filePath)) {
    try { fs.unlinkSync(row.filePath) } catch { /* ignore */ }
  }

  db.prepare('DELETE FROM cash_advance_settlements WHERE id = ?').run(id)
  return { id }
}

export function getSettlementFile(settlementId: number): { fileName: string; filePath: string; mimeType: string | null } | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT receipt_file_name as fileName, receipt_file_path as filePath, receipt_mime_type as mimeType
    FROM cash_advance_settlements WHERE id = ?
  `).get(settlementId) as { fileName: string; filePath: string; mimeType: string | null } | undefined
  return row ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate next order number
// ─────────────────────────────────────────────────────────────────────────────

export function getNextOrderNumber(): string {
  const db = getDb()
  const year = new Date().getFullYear()
  const prefix = `BV-${year}-`
  
  const row = db.prepare(`
    SELECT order_number as orderNumber 
    FROM cash_advances 
    WHERE order_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(`${prefix}%`) as { orderNumber: string } | undefined

  let nextSeq = 1
  if (row) {
    const match = row.orderNumber.match(/-(\d+)$/)
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary / Stats
// ─────────────────────────────────────────────────────────────────────────────

export function getCashAdvanceStats(): {
  totalOpen: number
  totalResolved: number
  totalOverdue: number
  openAmount: number
  overdueAmount: number
} {
  const db = getDb()
  
  const stats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as totalOpen,
      SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as totalResolved,
      SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END) as totalOverdue,
      SUM(CASE WHEN status = 'OPEN' THEN total_amount ELSE 0 END) as openAmount,
      SUM(CASE WHEN status = 'OVERDUE' THEN total_amount ELSE 0 END) as overdueAmount
    FROM cash_advances
  `).get() as any

  return {
    totalOpen: stats?.totalOpen || 0,
    totalResolved: stats?.totalResolved || 0,
    totalOverdue: stats?.totalOverdue || 0,
    openAmount: stats?.openAmount || 0,
    overdueAmount: stats?.overdueAmount || 0
  }
}
