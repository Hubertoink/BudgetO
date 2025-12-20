import type Database from 'better-sqlite3'
type DB = InstanceType<typeof Database>

/**
 * BudgetO: Belegnummerierung pro Tag
 * Format: YYYY-MM-DD_NNNN (4-stellige Sequenz, max 9999 Buchungen/Tag)
 * Sphären werden nicht mehr verwendet - Kategorien ersetzen sie
 */

export function nextVoucherSequence(db: DB, year: number, dateISO: string): number {
    // Get max seq_no for the specific date from actual vouchers
    const maxVoucherRow = db.prepare(
        'SELECT MAX(seq_no) as n FROM vouchers WHERE date = ?'
    ).get(dateISO) as { n?: number } | undefined
    
    return (maxVoucherRow?.n ?? 0) + 1
}

// Get a unique sequence within a transaction - safer for concurrent access
export function getNextSequenceInTransaction(db: DB, year: number, dateISO: string): number {
    const maxVoucherRow = db.prepare(
        'SELECT MAX(seq_no) as n FROM vouchers WHERE date = ?'
    ).get(dateISO) as { n?: number } | undefined
    
    return (maxVoucherRow?.n ?? 0) + 1
}

export function makeVoucherNo(year: number, dateISO: string, _unused: string, seq: number) {
    // BudgetO Format: YYYY-MM-DD_NNNN (4 digits, allows up to 9999 bookings per day)
    return `${dateISO}_${String(seq).padStart(4, '0')}`
}
