import { getDb } from '../db/database'

export function listRecentAudit(limit = 20) {
    const d = getDb()
    const rows = d.prepare(
        `SELECT id, user_id as userId, entity, entity_id as entityId, action, diff_json as diffJson, created_at as createdAt
         FROM audit_log ORDER BY id DESC LIMIT ?`
    ).all(limit) as any[]
    return rows.map(r => ({ ...r, diff: safeParseJson(r.diffJson), diffJson: undefined }))
}

function safeParseJson(s: string | null | undefined): any {
    if (!s) return null
    try { return JSON.parse(String(s)) } catch { return null }
}
