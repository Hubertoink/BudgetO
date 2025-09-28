import Database from 'better-sqlite3'
import { getDb, withTransaction } from '../db/database'

type DB = InstanceType<typeof Database>

export type Binding = {
    id: number
    code: string
    name: string
    description?: string | null
    startDate?: string | null
    endDate?: string | null
    isActive: number
    color?: string | null
    budget?: number | null
}

export function listBindings(params?: { activeOnly?: boolean }) {
    const d = getDb()
    const wh: string[] = []
    const vals: any[] = []
    if (params?.activeOnly) { wh.push('is_active = 1') }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''
    const rows = d.prepare(`SELECT id, code, name, description, start_date as startDate, end_date as endDate, is_active as isActive, color, budget FROM earmarks${whereSql} ORDER BY code`).all(...vals) as any[]
    return rows
}

export function upsertBinding(input: { id?: number; code: string; name: string; description?: string | null; startDate?: string | null; endDate?: string | null; isActive?: boolean; color?: string | null; budget?: number | null }) {
    return withTransaction((d: DB) => {
        if (input.id) {
            d.prepare(`UPDATE earmarks SET code=?, name=?, description=?, start_date=?, end_date=?, is_active=?, color=?, budget=? WHERE id=?`).run(
                input.code, input.name, input.description ?? null, input.startDate ?? null, input.endDate ?? null, (input.isActive ?? true) ? 1 : 0, input.color ?? null, input.budget ?? null, input.id
            )
            return { id: input.id, updated: true }
        }
        const info = d.prepare(`INSERT INTO earmarks(code, name, description, start_date, end_date, is_active, color, budget) VALUES (?,?,?,?,?,?,?,?)`).run(
            input.code, input.name, input.description ?? null, input.startDate ?? null, input.endDate ?? null, (input.isActive ?? true) ? 1 : 0, input.color ?? null, input.budget ?? null
        )
        return { id: Number(info.lastInsertRowid), created: true }
    })
}

export function deleteBinding(id: number) {
    const d = getDb()
    const used = d.prepare('SELECT COUNT(1) as c FROM vouchers WHERE earmark_id=?').get(id) as any
    if ((used?.c || 0) > 0) {
        throw new Error('Zweckbindung wird in Buchungen verwendet und kann nicht gelöscht werden. Bitte archivieren (inaktiv setzen).')
    }
    d.prepare('DELETE FROM earmarks WHERE id=?').run(id)
    return { id }
}

export function bindingUsage(earmarkId: number, params?: { from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) {
    const d = getDb()
    const wh: string[] = ['earmark_id = ?']
    const vals: any[] = [earmarkId]
    if (params?.from) { wh.push('date >= ?'); vals.push(params.from) }
    if (params?.to) { wh.push('date <= ?'); vals.push(params.to) }
    if (params?.sphere) { wh.push('sphere = ?'); vals.push(params.sphere) }
    const whereSql = ' WHERE ' + wh.join(' AND ')
    const rows = d.prepare(`SELECT type, IFNULL(SUM(gross_amount),0) as gross FROM vouchers${whereSql} GROUP BY type`).all(...vals) as any[]
    let allocated = 0, released = 0
    for (const r of rows) {
        if (r.type === 'IN') allocated += r.gross || 0
        if (r.type === 'OUT') released += r.gross || 0
    }
    const budgetRow = d.prepare(`SELECT budget FROM earmarks WHERE id=?`).get(earmarkId) as any
    const budget = Number(budgetRow?.budget ?? 0) || 0
    const balance = Math.round((allocated - released) * 100) / 100
    const remaining = Math.round(((budget + allocated - released) * 100)) / 100
    return { allocated: Math.round(allocated * 100) / 100, released: Math.round(released * 100) / 100, balance, budget, remaining }
}
