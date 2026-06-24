import Database from 'better-sqlite3'
import { getDb } from '../db/database'

type DB = InstanceType<typeof Database>

export type PaymentAccountKind = 'CASH' | 'BANK' | 'PAYPAL' | 'CARD' | 'OTHER'
export type PaymentAccountRow = {
  id: number
  name: string
  kind: PaymentAccountKind
  iban?: string | null
  color?: string | null
  sortOrder: number
  isActive: number
}

export function paymentMethodForAccountKind(kind?: PaymentAccountKind | null): 'BAR' | 'BANK' | null {
  if (!kind) return null
  return kind === 'CASH' ? 'BAR' : 'BANK'
}

export function listPaymentAccounts(opts?: { activeOnly?: boolean }) {
  return getDb().prepare(`SELECT id, name, kind, iban, color, sort_order AS sortOrder,
    is_active AS isActive FROM payment_accounts ${opts?.activeOnly ? 'WHERE is_active=1' : ''}
    ORDER BY is_active DESC, sort_order, name COLLATE NOCASE, id`).all() as PaymentAccountRow[]
}

export function getPaymentAccountById(id: number, db: DB = getDb()) {
  return db.prepare(`SELECT id, name, kind, iban, color, sort_order AS sortOrder,
    is_active AS isActive FROM payment_accounts WHERE id=?`).get(id) as PaymentAccountRow | undefined
}

export function getDefaultPaymentAccountIdForMethod(method: 'BAR' | 'BANK', db: DB = getDb()) {
  const row = db.prepare(`SELECT id FROM payment_accounts WHERE kind=? AND is_active=1
    ORDER BY sort_order, id LIMIT 1`).get(method === 'BAR' ? 'CASH' : 'BANK') as { id: number } | undefined
  return row?.id ?? null
}

export function upsertPaymentAccount(input: { id?: number; name: string; kind: PaymentAccountKind; iban?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean }) {
  const db = getDb()
  const name = String(input.name || '').trim()
  if (!name) throw new Error('Kontoname ist erforderlich.')
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM payment_accounts').get() as { n: number }
  const sortOrder = Number.isFinite(input.sortOrder) && Number(input.sortOrder) > 0 ? Math.floor(Number(input.sortOrder)) : max.n + 1
  if (input.id) {
    db.prepare(`UPDATE payment_accounts SET name=?, kind=?, iban=?, color=?, sort_order=?, is_active=? WHERE id=?`)
      .run(name, input.kind, input.iban ?? null, input.color ?? null, sortOrder, input.isActive === false ? 0 : 1, input.id)
    return { id: input.id }
  }
  const result = db.prepare(`INSERT INTO payment_accounts(name,kind,iban,color,sort_order,is_active) VALUES(?,?,?,?,?,?)`)
    .run(name, input.kind, input.iban ?? null, input.color ?? null, sortOrder, input.isActive === false ? 0 : 1)
  return { id: Number(result.lastInsertRowid) }
}

export function deletePaymentAccount(id: number) {
  const db = getDb()
  const used = db.prepare(`SELECT EXISTS(SELECT 1 FROM vouchers WHERE payment_account_id=? OR transfer_from_account_id=? OR transfer_to_account_id=?) used`).get(id, id, id) as { used: number }
  if (used.used) throw new Error('Dieses Konto wird bereits in Buchungen verwendet und kann nicht gelöscht werden.')
  db.prepare('DELETE FROM payment_accounts WHERE id=?').run(id)
  return { id }
}
