import type Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'
import { nextOccurrenceDate, type RecurrenceFrequency } from '../services/recurrence'

type DB = InstanceType<typeof Database>

export type RecurringBookingTemplateData = {
  type: 'IN' | 'OUT'
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  description: string
  grossAmount: number
  vatRate: number
  paymentMethod: 'BAR' | 'BANK'
  categoryId?: number | null
  budgetId?: number | null
  earmarkId?: number | null
  tags?: string[]
}

export type RecurringBookingUpsertInput = {
  id?: number
  name: string
  frequency: RecurrenceFrequency
  intervalCount?: number
  nextDueDate: string
  endDate?: string | null
  isActive?: boolean
  template: RecurringBookingTemplateData
}

function mapRow(row: any, today: string) {
  return {
    id: Number(row.id),
    name: String(row.name),
    frequency: row.frequency as RecurrenceFrequency,
    intervalCount: Number(row.intervalCount),
    nextDueDate: String(row.nextDueDate),
    endDate: row.endDate ? String(row.endDate) : null,
    isActive: !!row.isActive,
    isDue: !!row.isActive && String(row.nextDueDate) <= today,
    template: JSON.parse(String(row.templateJson || '{}')) as RecurringBookingTemplateData,
    createdAt: String(row.createdAt)
  }
}

export function listRecurringBookings(options: { includeInactive?: boolean; today?: string } = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10)
  const rows = getDb().prepare(`
    SELECT id, name, frequency, interval_count AS intervalCount, next_due_date AS nextDueDate,
           end_date AS endDate, is_active AS isActive, template_json AS templateJson,
           created_at AS createdAt
    FROM recurring_booking_templates
    ${options.includeInactive ? '' : 'WHERE is_active = 1'}
    ORDER BY is_active DESC, next_due_date ASC, name COLLATE NOCASE ASC
  `).all() as any[]
  return rows.map((row) => mapRow(row, today))
}

export function upsertRecurringBooking(input: RecurringBookingUpsertInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Bitte einen Namen für die Wiederholung eingeben')
  if (input.endDate && input.endDate < input.nextDueDate) throw new Error('Das Enddatum liegt vor der nächsten Fälligkeit')
  if (!Number.isFinite(input.template.grossAmount) || input.template.grossAmount <= 0) throw new Error('Der Betrag muss größer als 0 sein')
  const intervalCount = Math.max(1, Math.floor(input.intervalCount || 1))
  const anchorDay = Number(input.nextDueDate.slice(8, 10))
  // Also validates that the ISO dates represent real calendar dates.
  nextOccurrenceDate(input.nextDueDate, input.frequency, intervalCount, anchorDay)
  if (input.endDate) nextOccurrenceDate(input.endDate, 'WEEKLY', 1)
  const templateJson = JSON.stringify(input.template)
  const db = getDb()

  if (input.id) {
    const completed = db.prepare(`
      SELECT 1 FROM recurring_booking_occurrences WHERE template_id = ? AND due_date = ?
    `).get(input.id, input.nextDueDate)
    if (completed) throw new Error('Für dieses Datum wurde die Wiederholung bereits erledigt oder übersprungen')
    const result = db.prepare(`
      UPDATE recurring_booking_templates
      SET name = ?, frequency = ?, interval_count = ?, anchor_day = ?, next_due_date = ?,
          end_date = ?, is_active = ?, template_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, input.frequency, intervalCount, anchorDay, input.nextDueDate, input.endDate || null, input.isActive === false ? 0 : 1, templateJson, input.id)
    if (!result.changes) throw new Error('Wiederkehrende Buchung nicht gefunden')
    return { id: input.id }
  }

  const result = db.prepare(`
    INSERT INTO recurring_booking_templates
      (name, frequency, interval_count, anchor_day, next_due_date, end_date, is_active, template_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, input.frequency, intervalCount, anchorDay, input.nextDueDate, input.endDate || null, input.isActive === false ? 0 : 1, templateJson)
  return { id: Number(result.lastInsertRowid) }
}

function advanceTemplate(db: DB, row: any, dueDate: string) {
  const nextDueDate = nextOccurrenceDate(dueDate, row.frequency, Number(row.interval_count), Number(row.anchor_day))
  const remainsActive = !row.end_date || nextDueDate <= row.end_date
  db.prepare(`
    UPDATE recurring_booking_templates
    SET next_due_date = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextDueDate, remainsActive ? 1 : 0, row.id)
  return { nextDueDate, isActive: remainsActive }
}

function getCurrentTemplate(db: DB, templateId: number, dueDate: string) {
  const row = db.prepare('SELECT * FROM recurring_booking_templates WHERE id = ?').get(templateId) as any
  if (!row) throw new Error('Wiederkehrende Buchung nicht gefunden')
  if (!row.is_active) throw new Error('Diese Wiederholung ist nicht aktiv')
  if (String(row.next_due_date) !== dueDate) throw new Error('Diese Fälligkeit ist nicht mehr aktuell. Bitte Liste neu laden.')
  return row
}

export function markRecurringOccurrenceBooked(db: DB, templateId: number, dueDate: string, voucherId: number) {
  const row = getCurrentTemplate(db, templateId, dueDate)
  db.prepare(`
    INSERT INTO recurring_booking_occurrences(template_id, due_date, status, voucher_id)
    VALUES (?, ?, 'BOOKED', ?)
  `).run(templateId, dueDate, voucherId)
  return advanceTemplate(db, row, dueDate)
}

export function skipRecurringOccurrence(templateId: number, dueDate: string) {
  return withTransaction((db: DB) => {
    const row = getCurrentTemplate(db, templateId, dueDate)
    db.prepare(`
      INSERT INTO recurring_booking_occurrences(template_id, due_date, status, voucher_id)
      VALUES (?, ?, 'SKIPPED', NULL)
    `).run(templateId, dueDate)
    return advanceTemplate(db, row, dueDate)
  })
}

export function setRecurringBookingActive(id: number, isActive: boolean) {
  const result = getDb().prepare(`
    UPDATE recurring_booking_templates SET is_active = ?, updated_at = datetime('now') WHERE id = ?
  `).run(isActive ? 1 : 0, id)
  if (!result.changes) throw new Error('Wiederkehrende Buchung nicht gefunden')
  return { id, isActive }
}

export function deleteRecurringBooking(id: number) {
  const db = getDb()
  const row = db.prepare('SELECT is_active AS isActive FROM recurring_booking_templates WHERE id = ?').get(id) as { isActive: number } | undefined
  if (!row) throw new Error('Wiederkehrende Buchung nicht gefunden')
  if (row.isActive) throw new Error('Eine aktive Wiederholung muss vor dem Löschen pausiert werden')
  db.prepare('DELETE FROM recurring_booking_templates WHERE id = ?').run(id)
  return { id }
}
