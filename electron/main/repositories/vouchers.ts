import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { withTransaction, getAppDataDir, getDb } from '../db/database'
import { ensurePeriodOpen, getSetting } from '../services/settings'
import { nextVoucherSequence, makeVoucherNo } from '../services/numbering'
import { writeAudit } from '../services/audit'
import { getTagsForVoucher, setVoucherTags } from './tags'

type DB = InstanceType<typeof Database>

function round2(n: number) {
    return Math.round(n * 100) / 100
}

export type CreateVoucherInput = {
    date: string
    type: 'IN' | 'OUT' | 'TRANSFER'
    sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    description?: string
    netAmount?: number
    grossAmount?: number
    vatRate: number
    paymentMethod?: 'BAR' | 'BANK'
    transferFrom?: 'BAR' | 'BANK'
    transferTo?: 'BAR' | 'BANK'
    categoryId?: number
    projectId?: number
    earmarkId?: number
    earmarkAmount?: number | null
    budgetId?: number
    budgetAmount?: number | null
    budgets?: Array<{ budgetId: number; amount: number }>
    earmarks?: Array<{ earmarkId: number; amount: number }>
    createdBy?: number | null
    files?: { name: string; dataBase64: string; mime?: string }[]
    tags?: string[]
}

export function createVoucherTx(d: DB, input: CreateVoucherInput) {
    const warnings: string[] = []
    ensurePeriodOpen(input.date, d)
    const date = new Date(input.date)
    const year = date.getFullYear()
    // sequence and voucherNo will be (re)generated inside retry loop

    // compute based on provided net or gross
    let netAmount: number
    let grossAmount: number
    let vatAmount: number
    if (typeof input.netAmount === 'number') {
        netAmount = input.netAmount
        vatAmount = round2((netAmount * input.vatRate) / 100)
        grossAmount = round2(netAmount + vatAmount)
    } else if (typeof input.grossAmount === 'number') {
        // User provided gross; do not infer VAT/net automatically
        grossAmount = input.grossAmount
        netAmount = 0
        vatAmount = 0
    } else {
        throw new Error('Either netAmount or grossAmount must be provided')
    }

    // Earmark validations (if provided)
    if (input.earmarkId != null) {
        const em = d.prepare('SELECT id, is_active as isActive, start_date as startDate, end_date as endDate, enforce_time_range as enforceTimeRange FROM earmarks WHERE id=?').get(input.earmarkId) as any
        if (!em) throw new Error('Zweckbindung nicht gefunden')
        if (!em.isActive) throw new Error('Zweckbindung ist inaktiv und kann nicht verwendet werden')
        
        // Zeitraum-Prüfung nur wenn enforceTimeRange aktiv ist
        if (em.enforceTimeRange) {
            if (em.startDate && input.date < em.startDate) throw new Error(`Buchungsdatum liegt vor Beginn der Zweckbindung (${em.startDate})`)
            if (em.endDate && input.date > em.endDate) throw new Error(`Buchungsdatum liegt nach Ende der Zweckbindung (${em.endDate})`)
        }

        // Negative-balance protection (using junction table)
        const cfg = (getSetting<{ allowNegative?: boolean }>('earmark', d) || { allowNegative: false })
        if (!cfg.allowNegative && input.type === 'OUT') {
            const balRow = d.prepare(`
                    SELECT
                      IFNULL(SUM(CASE WHEN v.type='IN' THEN ve.amount ELSE 0 END),0) as allocated,
                      IFNULL(SUM(CASE WHEN v.type='OUT' THEN ve.amount ELSE 0 END),0) as released
                    FROM voucher_earmarks ve
                    JOIN vouchers v ON v.id = ve.voucher_id
                    WHERE ve.earmark_id = ? AND v.date <= ?
                `).get(input.earmarkId, input.date) as any
            const em2 = d.prepare('SELECT budget FROM earmarks WHERE id=?').get(input.earmarkId) as any
            const budget = Number(em2?.budget ?? 0) || 0
            const currentBalance = Math.round(((balRow.allocated || 0) - (balRow.released || 0)) * 100) / 100
            const remaining = Math.round(((budget + currentBalance) * 100)) / 100
            const wouldBe = Math.round(((remaining - (grossAmount ?? 0)) * 100)) / 100
            if (wouldBe < 0) {
                    warnings.push('Zweckbindung würde den verfügbaren Rahmen unterschreiten.')
            }
        }
    }

    // Budget validations (if provided)
    if (input.budgetId != null) {
        const budget = d.prepare('SELECT id, start_date as startDate, end_date as endDate, enforce_time_range as enforceTimeRange FROM budgets WHERE id=?').get(input.budgetId) as any
        if (!budget) throw new Error('Budget nicht gefunden')
        
        // Zeitraum-Prüfung nur wenn enforceTimeRange aktiv ist
        if (budget.enforceTimeRange) {
            if (budget.startDate && input.date < budget.startDate) throw new Error(`Buchungsdatum liegt vor Beginn des Budgets (${budget.startDate})`)
            if (budget.endDate && input.date > budget.endDate) throw new Error(`Buchungsdatum liegt nach Ende des Budgets (${budget.endDate})`)
        }
    }

    const stmt = d.prepare(`
      INSERT INTO vouchers (
    year, seq_no, voucher_no, date, type, sphere, account_id, category_id, project_id, earmark_id, earmark_amount, budget_id, budget_amount, description,
        net_amount, vat_rate, vat_amount, gross_amount, payment_method, transfer_from, transfer_to, counterparty, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `)

    let id: number | null = null
    let lastVoucherNo: string = ''
    // BudgetO: Sequenz pro Tag (nicht pro Sphäre) - bis zu 9999 Buchungen/Tag
    const maxSeqRow = d.prepare(
        'SELECT COALESCE(MAX(seq_no), 0) as maxSeq FROM vouchers WHERE date = ?'
    ).get(input.date) as { maxSeq: number }
    let seq = maxSeqRow.maxSeq + 1
    
    // Retry a few times in case of rare UNIQUE collisions
    for (let attempt = 0; attempt < 5; attempt++) {
        const voucherNo = makeVoucherNo(year, input.date, '', seq)
        lastVoucherNo = voucherNo
        try {
            const info = stmt.run(
                year,
                seq,
                voucherNo,
                input.date,
                input.type,
                input.sphere,
                input.categoryId ?? null,
                input.projectId ?? null,
                input.earmarkId ?? null,
                input.earmarkAmount ?? null,
                input.budgetId ?? null,
                input.budgetAmount ?? null,
                input.description ?? null,
                netAmount,
                input.vatRate,
                vatAmount,
                grossAmount,
                input.paymentMethod ?? null,
                input.transferFrom ?? null,
                input.transferTo ?? null,
                input.createdBy ?? null
            )
            id = Number(info.lastInsertRowid)
            
            // Update sequence table to stay in sync
            d.prepare(
                'INSERT INTO voucher_sequences(year, sphere, last_seq_no) VALUES(?,?,?) ON CONFLICT(year, sphere) DO UPDATE SET last_seq_no = MAX(excluded.last_seq_no, voucher_sequences.last_seq_no)'
            ).run(year, input.sphere, seq)
            
            break
        } catch (e: any) {
            const msg = String(e?.message || '')
            const code = String((e as any)?.code || '')
            const isUnique = code.includes('SQLITE_CONSTRAINT') || /UNIQUE constraint failed/i.test(msg)
            if (!isUnique) throw e
            // Increment seq and retry
            seq++
            if (attempt === 4) throw new Error('Konnte Belegnummer nicht vergeben (UNIQUE). Bitte erneut versuchen.')
        }
    }
    if (!id) throw new Error('Belegerstellung fehlgeschlagen')

    // Persist multi-assignments (if provided). Keep legacy columns in sync.
    if (Array.isArray(input.budgets)) {
        d.prepare('DELETE FROM voucher_budgets WHERE voucher_id = ?').run(id)
        const stmtB = d.prepare('INSERT INTO voucher_budgets (voucher_id, budget_id, amount) VALUES (?, ?, ?)')
        for (const a of input.budgets) {
            if (a?.budgetId && a.amount > 0) stmtB.run(id, a.budgetId, a.amount)
        }
        if (input.budgets.length > 0 && input.budgets[0].budgetId) {
            d.prepare('UPDATE vouchers SET budget_id = ?, budget_amount = ? WHERE id = ?')
                .run(input.budgets[0].budgetId, input.budgets[0].amount, id)
        } else {
            d.prepare('UPDATE vouchers SET budget_id = NULL, budget_amount = NULL WHERE id = ?').run(id)
        }
    }
    if (Array.isArray(input.earmarks)) {
        d.prepare('DELETE FROM voucher_earmarks WHERE voucher_id = ?').run(id)
        const stmtE = d.prepare('INSERT INTO voucher_earmarks (voucher_id, earmark_id, amount) VALUES (?, ?, ?)')
        for (const a of input.earmarks) {
            if (a?.earmarkId && a.amount > 0) stmtE.run(id, a.earmarkId, a.amount)
        }
        if (input.earmarks.length > 0 && input.earmarks[0].earmarkId) {
            d.prepare('UPDATE vouchers SET earmark_id = ?, earmark_amount = ? WHERE id = ?')
                .run(input.earmarks[0].earmarkId, input.earmarks[0].amount, id)
        } else {
            d.prepare('UPDATE vouchers SET earmark_id = NULL, earmark_amount = NULL WHERE id = ?').run(id)
        }
    }

    if (input.files?.length) {
        const { filesDir } = getAppDataDir()
        for (const f of input.files) {
            const buff = Buffer.from(f.dataBase64, 'base64')
            const safeName = `${id}-${Date.now()}-${f.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            const abs = path.join(filesDir, safeName)
            fs.writeFileSync(abs, buff)
            d.prepare(
                ' INSERT INTO voucher_files(voucher_id, file_name, file_path, mime_type, size) VALUES (?,?,?,?,?) '
            ).run(id, f.name, abs, f.mime ?? null, buff.length)
        }
    }

    // assign tags if provided
    if (input.tags && input.tags.length) {
        setVoucherTags(id, input.tags)
    }

    writeAudit(d, input.createdBy ?? null, 'vouchers', id, 'CREATE', {
        id,
        data: input
    })

    return { id, voucherNo: lastVoucherNo, grossAmount, warnings }
}

export function createVoucher(input: CreateVoucherInput) {
    return withTransaction((d: DB) => createVoucherTx(d, input))
}

export function reverseVoucher(originalId: number, userId: number | null) {
    return withTransaction((d: DB) => {
        const original = d.prepare('SELECT * FROM vouchers WHERE id=?').get(originalId) as any
        if (!original) throw new Error('Original voucher not found')
        // Reverse uses today's date; ensure open
        ensurePeriodOpen(new Date().toISOString().slice(0, 10), d)

        const now = new Date()
        const year = now.getFullYear()
        const seq = nextVoucherSequence(d, year, original.sphere)
        const todayISO = now.toISOString().slice(0, 10)
        const voucherNo = makeVoucherNo(year, todayISO, original.sphere, seq)

        const stmt = d.prepare(`
      INSERT INTO vouchers (
        year, seq_no, voucher_no, date, type, sphere, account_id, category_id, project_id, earmark_id, description,
        net_amount, vat_rate, vat_amount, gross_amount, payment_method, counterparty, created_by, original_id
      ) VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, 'Storno', ?, ?, ?, ?, NULL, NULL, ?, ?)
    `)
        const info = stmt.run(
            year,
            seq,
            voucherNo,
            original.type === 'IN' ? 'OUT' : original.type === 'OUT' ? 'IN' : 'TRANSFER',
            original.sphere,
            original.account_id,
            original.category_id,
            original.project_id,
            original.earmark_id,
            -original.net_amount,
            original.vat_rate,
            -original.vat_amount,
            -original.gross_amount,
            userId ?? null,
            originalId
        )
        const id = Number(info.lastInsertRowid)

        d.prepare('UPDATE vouchers SET reversed_by_id=? WHERE id=?').run(id, originalId)

        writeAudit(d, userId ?? null, 'vouchers', id, 'REVERSE', { originalId })
        return { id, voucherNo }
    })
}

export function listRecentVouchers(limit = 20) {
    const d = getDb()
    const rows = (d
        .prepare(
            `SELECT v.id, v.voucher_no as voucherNo, v.date, v.type, v.sphere, v.category_id as categoryId,
                            (SELECT cc.name FROM custom_categories cc WHERE cc.id = v.category_id) as categoryName,
                            (SELECT cc.color FROM custom_categories cc WHERE cc.id = v.category_id) as categoryColor,
                            v.payment_method as paymentMethod, v.transfer_from as transferFrom, v.transfer_to as transferTo, v.description, v.net_amount as netAmount,
                            v.vat_rate as vatRate, v.vat_amount as vatAmount, v.gross_amount as grossAmount,
                            (SELECT COUNT(1) FROM voucher_files vf WHERE vf.voucher_id = v.id) as fileCount,
                            v.earmark_id as earmarkId,
                            v.earmark_amount as earmarkAmount,
                            (SELECT e.code FROM earmarks e WHERE e.id = v.earmark_id) as earmarkCode,
                            v.budget_id as budgetId,
                            v.budget_amount as budgetAmount,
                            (
                                SELECT CASE
                                    WHEN b.name IS NOT NULL AND b.name <> '' THEN b.name
                                    WHEN b.category_name IS NOT NULL AND b.category_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.category_name)
                                    WHEN b.project_name IS NOT NULL AND b.project_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.project_name)
                                    ELSE printf('%04d-%s-%s', b.year, b.sphere, COALESCE(b.category_id, COALESCE(b.project_id, COALESCE(b.earmark_id, ''))))
                                END FROM budgets b WHERE b.id = v.budget_id
                            ) as budgetLabel,
                            (SELECT b.color FROM budgets b WHERE b.id = v.budget_id) as budgetColor,
                            (
                                SELECT GROUP_CONCAT(t.name, '\u0001')
                                FROM voucher_tags vt JOIN tags t ON t.id = vt.tag_id
                                WHERE vt.voucher_id = v.id
                            ) as tagsConcat
             FROM vouchers v ORDER BY v.date DESC, v.id DESC LIMIT ?`
        )
        .all(limit)) as any[]
    // Map concatenated tags to array
    return rows.map(r => ({ ...r, tags: (r as any).tagsConcat ? String((r as any).tagsConcat).split('\u0001') : [] }))
}

export function listVouchersFiltered({ limit = 20, paymentMethod }: { limit?: number; paymentMethod?: 'BAR' | 'BANK' }) {
    const d = getDb()
    let sql = `SELECT id, voucher_no as voucherNo, date, type, sphere, payment_method as paymentMethod, transfer_from as transferFrom, transfer_to as transferTo, description,
                                        net_amount as netAmount, vat_rate as vatRate, vat_amount as vatAmount, gross_amount as grossAmount,
                                        (SELECT COUNT(1) FROM voucher_files vf WHERE vf.voucher_id = vouchers.id) as fileCount
                         FROM vouchers`
    const params: any[] = []
    const wh: string[] = []
    if (paymentMethod) {
        wh.push(`(payment_method = ? OR (type = 'TRANSFER' AND (transfer_from = ? OR transfer_to = ?)))`)
        params.push(paymentMethod, paymentMethod, paymentMethod)
    }
    if (wh.length) sql += ` WHERE ` + wh.join(' AND ')
    sql += ` ORDER BY date DESC, id DESC LIMIT ?`
    params.push(limit)
    return d.prepare(sql).all(...params) as any[]
}

export function listVouchersAdvanced(filters: {
    limit?: number
    offset?: number
    sort?: 'ASC' | 'DESC'
    // Extended sort keys
    sortBy?: 'date' | 'gross' | 'net' | 'attachments' | 'budget' | 'earmark' | 'payment' | 'sphere'
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    earmarkId?: number
    budgetId?: number
    q?: string
    tag?: string
}) {
    const d = getDb()
    const { limit = 20, offset = 0, sort = 'DESC', sortBy, paymentMethod, sphere, categoryId, type, from, to, earmarkId, budgetId, q, tag } = filters
    let sql = `SELECT v.id, v.voucher_no as voucherNo, v.date, v.type, v.sphere, v.category_id as categoryId,
                                        (SELECT cc.name FROM custom_categories cc WHERE cc.id = v.category_id) as categoryName,
                                        (SELECT cc.color FROM custom_categories cc WHERE cc.id = v.category_id) as categoryColor,
                                        v.payment_method as paymentMethod, v.transfer_from as transferFrom, v.transfer_to as transferTo, v.description, v.counterparty,
                                        v.net_amount as netAmount, v.vat_rate as vatRate, v.vat_amount as vatAmount, v.gross_amount as grossAmount,
                                        (SELECT COUNT(1) FROM voucher_files vf WHERE vf.voucher_id = v.id) as fileCount,
                                        v.earmark_id as earmarkId,
                                        v.earmark_amount as earmarkAmount,
                                        (SELECT e.code FROM earmarks e WHERE e.id = v.earmark_id) as earmarkCode,
                                        v.budget_id as budgetId,
                                        v.budget_amount as budgetAmount,
                                        (
                                            SELECT CASE
                                                WHEN b.name IS NOT NULL AND b.name <> '' THEN b.name
                                                WHEN b.category_name IS NOT NULL AND b.category_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.category_name)
                                                WHEN b.project_name IS NOT NULL AND b.project_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.project_name)
                                                ELSE printf('%04d-%s-%s', v.year, v.sphere, COALESCE(b.category_id, COALESCE(b.project_id, COALESCE(b.earmark_id, ''))))
                                            END FROM budgets b WHERE b.id = v.budget_id
                                        ) as budgetLabel,
                                        (SELECT b.color FROM budgets b WHERE b.id = v.budget_id) as budgetColor,
                                        (
                                            SELECT GROUP_CONCAT(t.name, '\u0001')
                                            FROM voucher_tags vt JOIN tags t ON t.id = vt.tag_id
                                            WHERE vt.voucher_id = v.id
                                        ) as tagsConcat
                         FROM vouchers v`
    const params: any[] = []
    const wh: string[] = []
    if (paymentMethod) { wh.push('(v.payment_method = ? OR (v.type = \'TRANSFER\' AND (v.transfer_from = ? OR v.transfer_to = ?)))'); params.push(paymentMethod, paymentMethod, paymentMethod) }
    if (sphere) { wh.push('v.sphere = ?'); params.push(sphere) }
    if (typeof categoryId === 'number') { wh.push('v.category_id = ?'); params.push(categoryId) }
    if (type) { wh.push('v.type = ?'); params.push(type) }
    if (from) { wh.push('v.date >= ?'); params.push(from) }
    if (to) { wh.push('v.date <= ?'); params.push(to) }
    // Check both legacy column and junction table for earmarks
    if (earmarkId) {
        wh.push('(v.earmark_id = ? OR EXISTS (SELECT 1 FROM voucher_earmarks ve WHERE ve.voucher_id = v.id AND ve.earmark_id = ?))')
        params.push(earmarkId, earmarkId)
    }
    // Check both legacy column and junction table for budgets
    if (budgetId) {
        wh.push('(v.budget_id = ? OR EXISTS (SELECT 1 FROM voucher_budgets vb WHERE vb.voucher_id = v.id AND vb.budget_id = ?))')
        params.push(budgetId, budgetId)
    }
    if (q && q.trim()) {
        const like = `%${q.trim()}%`
        wh.push('(v.voucher_no LIKE ? OR v.description LIKE ? OR v.counterparty LIKE ? OR v.date LIKE ?)')
        params.push(like, like, like, like)
    }
    if (tag) {
        sql += ' JOIN voucher_tags vt ON vt.voucher_id = v.id JOIN tags t ON t.id = vt.tag_id'
        wh.push('t.name = ?')
        params.push(tag)
    }
    if (wh.length) sql += ' WHERE ' + wh.join(' AND ')
    const dir = (sort === 'ASC' ? 'ASC' : 'DESC')
    // Map sort key to SQL expression (include aliases from SELECT)
    const orderExpr = (() => {
        switch (sortBy) {
            case 'gross': return 'v.gross_amount'
            case 'net': return 'v.net_amount'
            case 'attachments': return 'fileCount'
            case 'budget': return 'budgetLabel COLLATE NOCASE'
            case 'earmark': return 'earmarkCode COLLATE NOCASE'
            case 'payment': return 'v.payment_method COLLATE NOCASE'
            case 'sphere': return 'v.sphere'
            case 'date': default: return 'v.date'
        }
    })()
    sql += ` ORDER BY ${orderExpr} ${dir}, v.id ${dir} LIMIT ? OFFSET ?`
    params.push(limit, offset)
    const rows = d.prepare(sql).all(...params) as any[]
    // Map concatenated tags to array
    return rows.map(r => ({ ...r, tags: (r as any).tagsConcat ? String((r as any).tagsConcat).split('\u0001') : [] }))
}

export function listVouchersAdvancedPaged(filters: {
    limit?: number
    offset?: number
    sort?: 'ASC' | 'DESC'
    // Extended sort keys
    sortBy?: 'date' | 'gross' | 'net' | 'attachments' | 'budget' | 'earmark' | 'payment' | 'sphere'
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    earmarkId?: number
    budgetId?: number
    q?: string
    tag?: string
    taxonomyTermId?: number
    // Archive mode: server-side filtering by work year
    workYear?: number
    showArchived?: boolean
}): { rows: any[]; total: number } {
    const d = getDb()
    const { limit = 20, offset = 0, sort = 'DESC', sortBy, paymentMethod, sphere, categoryId, type, from, to, earmarkId, budgetId, q, tag, taxonomyTermId, workYear, showArchived } = filters
    const params: any[] = []
    const wh: string[] = []
    if (paymentMethod) { wh.push('(v.payment_method = ? OR (v.type = \'TRANSFER\' AND (v.transfer_from = ? OR v.transfer_to = ?)))'); params.push(paymentMethod, paymentMethod, paymentMethod) }
    if (sphere) { wh.push('v.sphere = ?'); params.push(sphere) }
    if (typeof categoryId === 'number') { wh.push('v.category_id = ?'); params.push(categoryId) }
    if (type) { wh.push('v.type = ?'); params.push(type) }
    if (from) { wh.push('v.date >= ?'); params.push(from) }
    if (to) { wh.push('v.date <= ?'); params.push(to) }
    // Check both legacy column and junction table for earmarks
    if (earmarkId) {
        wh.push('(v.earmark_id = ? OR EXISTS (SELECT 1 FROM voucher_earmarks ve WHERE ve.voucher_id = v.id AND ve.earmark_id = ?))')
        params.push(earmarkId, earmarkId)
    }
    // Check both legacy column and junction table for budgets
    if (budgetId) {
        wh.push('(v.budget_id = ? OR EXISTS (SELECT 1 FROM voucher_budgets vb WHERE vb.voucher_id = v.id AND vb.budget_id = ?))')
        params.push(budgetId, budgetId)
    }
    if (q && q.trim()) {
        const qTrim = q.trim()
        const like = `%${qTrim}%`
        const idMatch = qTrim.match(/^#?(\d+)$/)
        if (idMatch) {
            wh.push('(v.id = ? OR v.voucher_no LIKE ? OR v.description LIKE ? OR v.counterparty LIKE ? OR v.date LIKE ?)')
            params.push(Number(idMatch[1]), like, like, like, like)
        } else {
            wh.push('(v.voucher_no LIKE ? OR v.description LIKE ? OR v.counterparty LIKE ? OR v.date LIKE ?)')
            params.push(like, like, like, like)
        }
    }

    // Archive mode: when showArchived is false and no explicit date filter, limit to workYear
    if (showArchived === false && typeof workYear === 'number' && !from && !to) {
        wh.push('v.date >= ? AND v.date <= ?')
        params.push(`${workYear}-01-01`, `${workYear}-12-31`)
    }

    if (typeof taxonomyTermId === 'number') {
        wh.push('EXISTS (SELECT 1 FROM voucher_taxonomy_terms vtt WHERE vtt.voucher_id = v.id AND vtt.term_id = ?)')
        params.push(taxonomyTermId)
    }
    let joinSql = ''
    if (tag) {
        joinSql = ' JOIN voucher_tags vt ON vt.voucher_id = v.id JOIN tags t ON t.id = vt.tag_id'
        wh.push('t.name = ?')
        params.push(tag)
    }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''
    const total = (d.prepare(`SELECT COUNT(1) as c FROM vouchers v LEFT JOIN cash_advances ca ON ca.placeholder_voucher_id = v.id AND ca.status = 'OPEN'${joinSql}${whereSql}`).get(...params) as any)?.c || 0
    // Determine ORDER BY expression
    const orderExpr = (() => {
        switch (sortBy) {
            case 'gross': return 'v.gross_amount'
            case 'net': return 'v.net_amount'
            case 'attachments': return 'fileCount'
            case 'budget': return 'budgetLabel COLLATE NOCASE'
            case 'earmark': return 'earmarkCode COLLATE NOCASE'
            case 'payment': return 'v.payment_method COLLATE NOCASE'
            case 'sphere': return 'v.sphere'
            case 'date': default: return 'v.date'
        }
    })()
    const rows = d.prepare(
        `SELECT v.id, v.voucher_no as voucherNo, v.date, v.type, v.sphere,
            v.category_id as categoryId,
            (SELECT cc.name FROM custom_categories cc WHERE cc.id = v.category_id) as categoryName,
            (SELECT cc.color FROM custom_categories cc WHERE cc.id = v.category_id) as categoryColor,
            v.payment_method as paymentMethod, v.transfer_from as transferFrom, v.transfer_to as transferTo, v.description, v.counterparty,
                v.net_amount as netAmount, v.vat_rate as vatRate, v.vat_amount as vatAmount, v.gross_amount as grossAmount,
                (SELECT COUNT(1) FROM voucher_files vf WHERE vf.voucher_id = v.id) as fileCount,
                CASE WHEN ca.id IS NOT NULL THEN 1 ELSE 0 END as isCashAdvancePlaceholder,
                v.earmark_id as earmarkId,
                v.earmark_amount as earmarkAmount,
                (SELECT e.code FROM earmarks e WHERE e.id = v.earmark_id) as earmarkCode,
                v.budget_id as budgetId,
                v.budget_amount as budgetAmount,
                (
                    SELECT CASE
                        WHEN b.name IS NOT NULL AND b.name <> '' THEN b.name
                        WHEN b.category_name IS NOT NULL AND b.category_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.category_name)
                        WHEN b.project_name IS NOT NULL AND b.project_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.project_name)
                        ELSE printf('%04d-%s-%s', v.year, v.sphere, COALESCE(b.category_id, COALESCE(b.project_id, COALESCE(b.earmark_id, ''))))
                    END FROM budgets b WHERE b.id = v.budget_id
                ) as budgetLabel,
                (SELECT b.color FROM budgets b WHERE b.id = v.budget_id) as budgetColor,
                (
                    SELECT GROUP_CONCAT(t.name, '\u0001')
                    FROM voucher_tags vt JOIN tags t ON t.id = vt.tag_id
                    WHERE vt.voucher_id = v.id
                ) as tagsConcat
         FROM vouchers v
         LEFT JOIN cash_advances ca ON ca.placeholder_voucher_id = v.id AND ca.status = 'OPEN'
         ${joinSql}${whereSql}
         ORDER BY ${orderExpr} ${sort === 'ASC' ? 'ASC' : 'DESC'}, v.id ${sort === 'ASC' ? 'ASC' : 'DESC'}
         LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[]
    const mapped = rows.map(r => ({
        ...r,
        isCashAdvancePlaceholder: !!(r as any).isCashAdvancePlaceholder,
        tags: (r as any).tagsConcat ? String((r as any).tagsConcat).split('\u0001') : []
    }))
    return { rows: mapped, total }
}

function assertNotCashAdvancePlaceholder(d: DB, voucherId: number) {
    const hit = d.prepare(`
        SELECT 1
        FROM cash_advances
        WHERE placeholder_voucher_id = ? AND status = 'OPEN'
        LIMIT 1
    `).get(voucherId)
    if (hit) {
        throw new Error('Dieser Beleg ist ein Barvorschuss-Platzhalter und kann nicht bearbeitet/gelöscht werden. Änderungen bitte im Barvorschuss vornehmen.')
    }
}

export type VoucherTaxonomyTermBadge = {
    taxonomyId: number
    taxonomyName: string
    termId: number
    termName: string
    termColor?: string | null
}

export function getVoucherTaxonomyTermsForVouchers(voucherIds: number[]): Record<number, VoucherTaxonomyTermBadge[]> {
    const d = getDb()
    const ids = (voucherIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    if (!ids.length) return {}

    const placeholders = ids.map(() => '?').join(',')
    const rows = d.prepare(
        `
        SELECT
          vtt.voucher_id as voucherId,
          tx.id as taxonomyId,
          tx.name as taxonomyName,
          t.id as termId,
          t.name as termName,
          t.color as termColor
        FROM voucher_taxonomy_terms vtt
        JOIN category_taxonomies tx ON tx.id = vtt.taxonomy_id
        JOIN category_terms t ON t.id = vtt.term_id
        WHERE vtt.voucher_id IN (${placeholders})
        ORDER BY tx.sort_order ASC, tx.name COLLATE NOCASE ASC, t.sort_order ASC, t.name COLLATE NOCASE ASC
        `
    ).all(...ids) as any[]

    const byVoucher: Record<number, VoucherTaxonomyTermBadge[]> = {}
    for (const r of rows) {
        const vid = Number(r.voucherId)
        if (!byVoucher[vid]) byVoucher[vid] = []
        byVoucher[vid].push({
            taxonomyId: Number(r.taxonomyId),
            taxonomyName: String(r.taxonomyName),
            termId: Number(r.termId),
            termName: String(r.termName),
            termColor: r.termColor ?? null
        })
    }
    return byVoucher
}

// Batch-assign an earmarkId to vouchers matching filters
export function batchAssignEarmark(params: {
    earmarkId: number
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    q?: string
    onlyWithout?: boolean // when true, only rows where earmark_id IS NULL
}) {
    const d = getDb()
    const wh: string[] = []
    const args: any[] = []
    if (params.paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); args.push(params.paymentMethod, params.paymentMethod, params.paymentMethod) }
    if (params.sphere) { wh.push('sphere = ?'); args.push(params.sphere) }
    if (typeof params.categoryId === 'number') { wh.push('category_id = ?'); args.push(params.categoryId) }
    if (params.type) { wh.push('type = ?'); args.push(params.type) }
    if (params.from) { wh.push('date >= ?'); args.push(params.from) }
    if (params.to) { wh.push('date <= ?'); args.push(params.to) }
    if (params.q && params.q.trim()) {
        const like = `%${params.q.trim()}%`
        wh.push('(voucher_no LIKE ? OR description LIKE ? OR counterparty LIKE ? OR date LIKE ?)')
        args.push(like, like, like, like)
    }
    if (params.onlyWithout) wh.push('earmark_id IS NULL')
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

    // Validate earmark exists and active
    const em = d.prepare('SELECT id, is_active as isActive FROM earmarks WHERE id=?').get(params.earmarkId) as any
    if (!em) throw new Error('Zweckbindung nicht gefunden')
    if (!em.isActive) throw new Error('Zweckbindung ist inaktiv und kann nicht verwendet werden')

    const res = d.prepare(`UPDATE vouchers SET earmark_id = ?${whereSql}`).run(params.earmarkId, ...args)
    const updated = Number(res.changes || 0)
    
    // Log batch assignment to audit
    if (updated > 0) {
        const earmarkInfo = d.prepare('SELECT code, name FROM earmarks WHERE id=?').get(params.earmarkId) as any
        writeAudit(
            d,
            null,
            'VOUCHER',
            0,
            'BATCH_ASSIGN_EARMARK',
            { earmarkId: params.earmarkId, earmarkCode: earmarkInfo?.code, earmarkName: earmarkInfo?.name, count: updated, filters: params }
        )
    }
    
    return { updated }
}

// Batch-assign a budgetId to vouchers matching filters
export function batchAssignBudget(params: {
    budgetId: number
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    q?: string
    onlyWithout?: boolean
}) {
    const d = getDb()
    const wh: string[] = []
    const args: any[] = []
    if (params.paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); args.push(params.paymentMethod, params.paymentMethod, params.paymentMethod) }
    if (params.sphere) { wh.push('sphere = ?'); args.push(params.sphere) }
    if (typeof params.categoryId === 'number') { wh.push('category_id = ?'); args.push(params.categoryId) }
    if (params.type) { wh.push('type = ?'); args.push(params.type) }
    if (params.from) { wh.push('date >= ?'); args.push(params.from) }
    if (params.to) { wh.push('date <= ?'); args.push(params.to) }
    if (params.q && params.q.trim()) {
        const like = `%${params.q.trim()}%`
        wh.push('(voucher_no LIKE ? OR description LIKE ? OR counterparty LIKE ? OR date LIKE ?)')
        args.push(like, like, like, like)
    }
    if (params.onlyWithout) wh.push('budget_id IS NULL')
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

    // Validate budget exists
    const b = d.prepare('SELECT id FROM budgets WHERE id=?').get(params.budgetId) as any
    if (!b) throw new Error('Budget nicht gefunden')
    const res = d.prepare(`UPDATE vouchers SET budget_id = ?${whereSql}`).run(params.budgetId, ...args)
    const updated = Number(res.changes || 0)
    
    // Log batch assignment to audit
    if (updated > 0) {
        const budgetInfo = d.prepare('SELECT name, year FROM budgets WHERE id=?').get(params.budgetId) as any
        writeAudit(
            d,
            null,
            'VOUCHER',
            0,
            'BATCH_ASSIGN_BUDGET',
            { budgetId: params.budgetId, budgetName: budgetInfo?.name, budgetYear: budgetInfo?.year, count: updated, filters: params }
        )
    }
    
    return { updated }
}

// Batch-assign tags to vouchers matching filters (adds tags, does not remove existing)
export function batchAssignTags(params: {
    tags: string[]
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    q?: string
}) {
    const d = getDb()
    const wh: string[] = []
    const args: any[] = []
    if (params.paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); args.push(params.paymentMethod, params.paymentMethod, params.paymentMethod) }
    if (params.sphere) { wh.push('sphere = ?'); args.push(params.sphere) }
    if (typeof params.categoryId === 'number') { wh.push('category_id = ?'); args.push(params.categoryId) }
    if (params.type) { wh.push('type = ?'); args.push(params.type) }
    if (params.from) { wh.push('date >= ?'); args.push(params.from) }
    if (params.to) { wh.push('date <= ?'); args.push(params.to) }
    if (params.q && params.q.trim()) {
        const like = `%${params.q.trim()}%`
        wh.push('(voucher_no LIKE ? OR description LIKE ? OR counterparty LIKE ? OR date LIKE ?)')
        args.push(like, like, like, like)
    }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''
    // Collect voucher ids
    const ids = (d.prepare(`SELECT id FROM vouchers${whereSql}`).all(...args) as any[]).map(r => r.id)
    if (!ids.length) return { updated: 0 }
    // Ensure tags exist (upsert by name)
    const exist = d.prepare('SELECT id, name FROM tags').all() as any[]
    const byName = new Map<string, number>(exist.map(r => [String(r.name).toLowerCase(), r.id]))
    const tagIds: number[] = []
    for (const nameRaw of params.tags) {
        const name = String(nameRaw || '').trim()
        if (!name) continue
        const key = name.toLowerCase()
        let id = byName.get(key)
        if (!id) {
            const info = d.prepare('INSERT INTO tags(name) VALUES (?)').run(name)
            id = Number(info.lastInsertRowid)
            byName.set(key, id)
        }
        tagIds.push(id!)
    }
    if (!tagIds.length) return { updated: 0 }
    const stmt = d.prepare('INSERT OR IGNORE INTO voucher_tags(voucher_id, tag_id) VALUES (?, ?)')
    let count = 0
    for (const vid of ids) {
        for (const tid of tagIds) {
            const r = stmt.run(vid, tid)
            count += Number(r.changes || 0)
        }
    }
    // updated = number of vouchers touched (approximate: unique vids with at least one insert)
    const updated = ids.length
    
    // Log batch assignment to audit
    if (updated > 0) {
        writeAudit(
            d,
            null,
            'VOUCHER',
            0,
            'BATCH_ASSIGN_TAGS',
            { tags: params.tags, count: updated, filters: params }
        )
    }
    
    return { updated }
}

// Batch-assign a custom categoryId to vouchers matching filters
export function batchAssignCategory(params: {
    categoryIdToAssign: number
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    q?: string
    onlyWithout?: boolean
}) {
    const d = getDb()
    const wh: string[] = []
    const args: any[] = []
    if (params.paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); args.push(params.paymentMethod, params.paymentMethod, params.paymentMethod) }
    if (params.sphere) { wh.push('sphere = ?'); args.push(params.sphere) }
    if (typeof params.categoryId === 'number') { wh.push('category_id = ?'); args.push(params.categoryId) }
    if (params.type) { wh.push('type = ?'); args.push(params.type) }
    if (params.from) { wh.push('date >= ?'); args.push(params.from) }
    if (params.to) { wh.push('date <= ?'); args.push(params.to) }
    if (params.q && params.q.trim()) {
        const like = `%${params.q.trim()}%`
        wh.push('(voucher_no LIKE ? OR description LIKE ? OR counterparty LIKE ? OR date LIKE ?)')
        args.push(like, like, like, like)
    }
    if (params.onlyWithout) wh.push('category_id IS NULL')
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

    // Validate category exists and active
    const cat = d.prepare('SELECT id, is_active as isActive FROM custom_categories WHERE id=?').get(params.categoryIdToAssign) as any
    if (!cat) throw new Error('Kategorie nicht gefunden')
    if (!cat.isActive) throw new Error('Kategorie ist inaktiv und kann nicht verwendet werden')

    const res = d.prepare(`UPDATE vouchers SET category_id = ?${whereSql}`).run(params.categoryIdToAssign, ...args)
    const updated = Number(res.changes || 0)

    if (updated > 0) {
        const info = d.prepare('SELECT name FROM custom_categories WHERE id=?').get(params.categoryIdToAssign) as any
        writeAudit(
            d,
            null,
            'VOUCHER',
            0,
            'BATCH_ASSIGN_CATEGORY',
            { categoryId: params.categoryIdToAssign, categoryName: info?.name, count: updated, filters: params }
        )
    }

    return { updated }
}

export function summarizeVouchers(filters: {
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    earmarkId?: number
    q?: string
    tag?: string
    // Archive mode: server-side filtering by work year (Blank Slate)
    workYear?: number
    showArchived?: boolean
}) {
    const d = getDb()
    const { paymentMethod, sphere, categoryId, type, from, to, earmarkId, q, tag, workYear, showArchived } = filters
    const paramsBase: any[] = []
    const wh: string[] = []
    let joinSql = ''
    if (paymentMethod) { wh.push('(v.payment_method = ? OR (v.type = \'TRANSFER\' AND (v.transfer_from = ? OR v.transfer_to = ?)))'); paramsBase.push(paymentMethod, paymentMethod, paymentMethod) }
    if (sphere) { wh.push('v.sphere = ?'); paramsBase.push(sphere) }
    if (typeof categoryId === 'number') { wh.push('v.category_id = ?'); paramsBase.push(categoryId) }
    if (type && paymentMethod && (type === 'IN' || type === 'OUT')) {
        if (type === 'IN') {
            wh.push(`(v.type = 'IN' OR (v.type = 'TRANSFER' AND v.transfer_to = ?))`)
            paramsBase.push(paymentMethod)
        } else {
            wh.push(`(v.type = 'OUT' OR (v.type = 'TRANSFER' AND v.transfer_from = ?))`)
            paramsBase.push(paymentMethod)
        }
    } else if (type) { wh.push('v.type = ?'); paramsBase.push(type) }
    if (from) { wh.push('v.date >= ?'); paramsBase.push(from) }
    if (to) { wh.push('v.date <= ?'); paramsBase.push(to) }
    if (earmarkId != null) { wh.push('v.earmark_id = ?'); paramsBase.push(earmarkId) }
    if (q && q.trim()) {
        const like = `%${q.trim()}%`
        wh.push('(v.voucher_no LIKE ? OR v.description LIKE ? OR v.counterparty LIKE ? OR v.date LIKE ? )')
        paramsBase.push(like, like, like, like)
    }
    if (tag) {
        joinSql = ' JOIN voucher_tags vt ON vt.voucher_id = v.id JOIN tags t ON t.id = vt.tag_id'
        wh.push('t.name = ?')
        paramsBase.push(tag)
    }

    // Archive mode: when showArchived is false and no explicit date filter, limit to workYear
    if (showArchived === false && typeof workYear === 'number' && !from && !to) {
        wh.push('v.date >= ? AND v.date <= ?')
        paramsBase.push(`${workYear}-01-01`, `${workYear}-12-31`)
    }

    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

    const pmAdjustedType = paymentMethod
        ? `CASE WHEN v.type = 'TRANSFER' AND v.transfer_from = '${paymentMethod}' THEN 'OUT' WHEN v.type = 'TRANSFER' AND v.transfer_to = '${paymentMethod}' THEN 'IN' ELSE v.type END`
        : 'v.type'

    const totals = d.prepare(`
        SELECT
            IFNULL(SUM(v.net_amount), 0) as net,
            IFNULL(SUM(v.vat_amount), 0) as vat,
            IFNULL(SUM(v.gross_amount), 0) as gross
        FROM vouchers v${joinSql}${whereSql}
    `).get(...paramsBase) as any

    const bySphere = d.prepare(`
        SELECT v.sphere as key,
               IFNULL(SUM(v.net_amount), 0) as net,
               IFNULL(SUM(v.vat_amount), 0) as vat,
               IFNULL(SUM(v.gross_amount), 0) as gross
        FROM vouchers v${joinSql}${whereSql}
        GROUP BY v.sphere
        ORDER BY v.sphere
    `).all(...paramsBase) as any[]

    let byPaymentMethod: any[]
    if (paymentMethod) {
        byPaymentMethod = d.prepare(`
            SELECT '${paymentMethod}' as key,
                   IFNULL(SUM(v.net_amount), 0) as net,
                   IFNULL(SUM(v.vat_amount), 0) as vat,
                   IFNULL(SUM(v.gross_amount), 0) as gross
            FROM vouchers v${joinSql}${whereSql}
            GROUP BY key
            ORDER BY key IS NULL, key
        `).all(...paramsBase) as any[]
    } else {
        byPaymentMethod = d.prepare(`
            WITH filtered AS (
                SELECT v.payment_method, v.type, v.transfer_from, v.transfer_to,
                       v.net_amount, v.vat_amount, v.gross_amount
                FROM vouchers v${joinSql}${whereSql}
            )
            SELECT pm as key,
                   IFNULL(SUM(net_amount), 0) as net,
                   IFNULL(SUM(vat_amount), 0) as vat,
                   IFNULL(SUM(gross_amount), 0) as gross
            FROM (
                SELECT CASE WHEN type != 'TRANSFER' THEN payment_method ELSE transfer_from END as pm,
                       net_amount, vat_amount, gross_amount
                FROM filtered
                UNION ALL
                SELECT transfer_to as pm, net_amount, vat_amount, gross_amount
                FROM filtered WHERE type = 'TRANSFER'
            ) sub
            GROUP BY pm
            ORDER BY pm IS NULL, pm
        `).all(...paramsBase) as any[]
    }

    const byType = d.prepare(`
         SELECT ${pmAdjustedType} as key,
               IFNULL(SUM(v.net_amount), 0) as net,
               IFNULL(SUM(v.vat_amount), 0) as vat,
               IFNULL(SUM(v.gross_amount), 0) as gross
        FROM vouchers v${joinSql}${whereSql}
         GROUP BY ${pmAdjustedType}
         ORDER BY ${pmAdjustedType}
    `).all(...paramsBase) as any[]

    return { totals, bySphere, byPaymentMethod, byType }
}

export function summarizeVouchersByCategory(filters: {
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    earmarkId?: number
    q?: string
    tag?: string
    workYear?: number
    showArchived?: boolean
}) {
    const d = getDb()
    const { paymentMethod, sphere, categoryId, type, from, to, earmarkId, q, tag, workYear, showArchived } = filters
    const params: any[] = []
    const wh: string[] = []
    let joinSql = ''
    if (paymentMethod) { wh.push('v.payment_method = ?'); params.push(paymentMethod) }
    if (sphere) { wh.push('v.sphere = ?'); params.push(sphere) }
    if (typeof categoryId === 'number') { wh.push('v.category_id = ?'); params.push(categoryId) }
    if (type) { wh.push('v.type = ?'); params.push(type) }
    if (from) { wh.push('v.date >= ?'); params.push(from) }
    if (to) { wh.push('v.date <= ?'); params.push(to) }
    if (earmarkId != null) { wh.push('v.earmark_id = ?'); params.push(earmarkId) }
    if (q && q.trim()) {
        const like = `%${q.trim()}%`
        wh.push('(v.voucher_no LIKE ? OR v.description LIKE ? OR v.counterparty LIKE ? OR v.date LIKE ?)')
        params.push(like, like, like, like)
    }
    if (tag) {
        joinSql = ' JOIN voucher_tags vt ON vt.voucher_id = v.id JOIN tags t ON t.id = vt.tag_id'
        wh.push('t.name = ?')
        params.push(tag)
    }

    // Archive mode: when showArchived is false and no explicit date filter, limit to workYear
    if (showArchived === false && typeof workYear === 'number' && !from && !to) {
        wh.push('v.date >= ? AND v.date <= ?')
        params.push(`${workYear}-01-01`, `${workYear}-12-31`)
    }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''

    let rows: any[] = []
    try {
        rows = d.prepare(`
            SELECT
                v.category_id as categoryId,
                cc.name as categoryName,
                cc.color as categoryColor,
                IFNULL(SUM(v.gross_amount), 0) as gross
            FROM vouchers v${joinSql}
            LEFT JOIN custom_categories cc ON cc.id = v.category_id
            ${whereSql}
            GROUP BY v.category_id, cc.name, cc.color
            ORDER BY ABS(gross) DESC
        `).all(...params) as any[]
    } catch {
        // Legacy fallback for older DBs that still use a plain `categories` table
        rows = d.prepare(`
            SELECT
                v.category_id as categoryId,
                c.name as categoryName,
                NULL as categoryColor,
                IFNULL(SUM(v.gross_amount), 0) as gross
            FROM vouchers v${joinSql}
            LEFT JOIN categories c ON c.id = v.category_id
            ${whereSql}
            GROUP BY v.category_id, c.name
            ORDER BY ABS(gross) DESC
        `).all(...params) as any[]
    }

    return rows.map((r) => ({
        categoryId: r.categoryId ?? null,
        categoryName: r.categoryName ?? 'Ohne Kategorie',
        categoryColor: r.categoryColor ?? null,
        gross: Number(r.gross) || 0
    }))
}

export function balanceAt(params: { to: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) {
    const d = getDb()
    const to = params.to
    const wh: string[] = ['date <= ?']
    const vals: any[] = [to]
    if (params.sphere) { wh.push('sphere = ?'); vals.push(params.sphere) }
    const whereSql = ' WHERE ' + wh.join(' AND ')
    const rows = d.prepare(`
        SELECT payment_method as pm, type, IFNULL(SUM(gross_amount), 0) as gross
        FROM vouchers${whereSql}
        GROUP BY payment_method, type
    `).all(...vals) as any[]
    let bar = 0, bank = 0
    for (const r of rows) {
        const sign = r.type === 'IN' ? 1 : r.type === 'OUT' ? -1 : 0
        if (r.pm === 'BAR') bar += sign * (r.gross || 0)
        if (r.pm === 'BANK') bank += sign * (r.gross || 0)
    }
    return { BAR: Math.round(bar * 100) / 100, BANK: Math.round(bank * 100) / 100 }
}

export function monthlyVouchers(filters: {
    from?: string
    to?: string
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
}) {
    const d = getDb()
    const { from, to, paymentMethod, sphere, categoryId, type } = filters
    const params: any[] = []
    const wh: string[] = []
    if (from) { wh.push('date >= ?'); params.push(from) }
    if (to) { wh.push('date <= ?'); params.push(to) }
    if (paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); params.push(paymentMethod, paymentMethod, paymentMethod) }
    if (sphere) { wh.push('sphere = ?'); params.push(sphere) }
    if (typeof categoryId === 'number') { wh.push('category_id = ?'); params.push(categoryId) }
    if (type && paymentMethod && (type === 'IN' || type === 'OUT')) {
        if (type === 'IN') {
            wh.push(`(type = 'IN' OR (type = 'TRANSFER' AND transfer_to = ?))`)
            params.push(paymentMethod)
        } else {
            wh.push(`(type = 'OUT' OR (type = 'TRANSFER' AND transfer_from = ?))`)
            params.push(paymentMethod)
        }
    } else if (type) { wh.push('type = ?'); params.push(type) }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''
    const netExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN net_amount WHEN type = 'OUT' THEN -net_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(net_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(net_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN net_amount WHEN type = 'OUT' THEN -net_amount ELSE 0 END`
    const vatExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN vat_amount WHEN type = 'OUT' THEN -vat_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(vat_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(vat_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN vat_amount WHEN type = 'OUT' THEN -vat_amount ELSE 0 END`
    const grossExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN gross_amount WHEN type = 'OUT' THEN -gross_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(gross_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(gross_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN gross_amount WHEN type = 'OUT' THEN -gross_amount ELSE 0 END`
    const rows = d.prepare(`
        SELECT strftime('%Y-%m', date) as month,
               IFNULL(SUM(${netExpr}), 0) as net,
               IFNULL(SUM(${vatExpr}), 0) as vat,
               IFNULL(SUM(${grossExpr}), 0) as gross
        FROM vouchers${whereSql}
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month ASC
    `).all(...params) as any[]
    return rows
}

export function dailyVouchers(filters: {
    from?: string
    to?: string
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    type?: 'IN' | 'OUT' | 'TRANSFER'
}) {
    const d = getDb()
    const { from, to, paymentMethod, sphere, type } = filters
    const params: any[] = []
    const wh: string[] = []
    if (from) { wh.push('date >= ?'); params.push(from) }
    if (to) { wh.push('date <= ?'); params.push(to) }
    if (paymentMethod) { wh.push('(payment_method = ? OR (type = \'TRANSFER\' AND (transfer_from = ? OR transfer_to = ?)))'); params.push(paymentMethod, paymentMethod, paymentMethod) }
    if (sphere) { wh.push('sphere = ?'); params.push(sphere) }
    if (type && paymentMethod && (type === 'IN' || type === 'OUT')) {
        if (type === 'IN') {
            wh.push(`(type = 'IN' OR (type = 'TRANSFER' AND transfer_to = ?))`)
            params.push(paymentMethod)
        } else {
            wh.push(`(type = 'OUT' OR (type = 'TRANSFER' AND transfer_from = ?))`)
            params.push(paymentMethod)
        }
    } else if (type) { wh.push('type = ?'); params.push(type) }
    const whereSql = wh.length ? ' WHERE ' + wh.join(' AND ') : ''
    const netExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN net_amount WHEN type = 'OUT' THEN -net_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(net_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(net_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN net_amount WHEN type = 'OUT' THEN -net_amount ELSE 0 END`
    const vatExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN vat_amount WHEN type = 'OUT' THEN -vat_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(vat_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(vat_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN vat_amount WHEN type = 'OUT' THEN -vat_amount ELSE 0 END`
    const grossExpr = paymentMethod
        ? `CASE WHEN type = 'IN' THEN gross_amount WHEN type = 'OUT' THEN -gross_amount WHEN type = 'TRANSFER' AND transfer_from = '${paymentMethod}' THEN -ABS(gross_amount) WHEN type = 'TRANSFER' AND transfer_to = '${paymentMethod}' THEN ABS(gross_amount) ELSE 0 END`
        : `CASE WHEN type = 'IN' THEN gross_amount WHEN type = 'OUT' THEN -gross_amount ELSE 0 END`
    const rows = d.prepare(`
        SELECT date,
               IFNULL(SUM(${netExpr}), 0) as net,
               IFNULL(SUM(${vatExpr}), 0) as vat,
               IFNULL(SUM(${grossExpr}), 0) as gross
        FROM vouchers${whereSql}
        GROUP BY date
        ORDER BY date ASC
    `).all(...params) as any[]
    return rows
}

export function updateVoucher(input: {
    id: number
    date?: string
    type?: 'IN' | 'OUT' | 'TRANSFER'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number | null
    description?: string | null
    paymentMethod?: 'BAR' | 'BANK' | null
    transferFrom?: 'BAR' | 'BANK' | null
    transferTo?: 'BAR' | 'BANK' | null
    earmarkId?: number | null
    earmarkAmount?: number | null
    budgetId?: number | null
    budgetAmount?: number | null
    tags?: string[]
    netAmount?: number
    vatRate?: number
    grossAmount?: number
}) {
    const d = getDb()
    const warnings: string[] = []

    // Barvorschuss-Platzhalter dürfen nicht manuell editiert werden.
    assertNotCashAdvancePlaceholder(d as any, input.id)

    if (input.categoryId !== undefined && input.categoryId !== null) {
        const exists = d.prepare('SELECT id FROM custom_categories WHERE id=?').get(input.categoryId) as any
        if (!exists) throw new Error('Kategorie nicht gefunden')
    }

    const current = d.prepare(`
         SELECT id, year, seq_no as seqNo, voucher_no as voucherNo, date, type, sphere,
             category_id as categoryId,
               net_amount as netAmount, vat_rate as vatRate, gross_amount as grossAmount,
               earmark_id as earmarkId, earmark_amount as earmarkAmount,
               budget_id as budgetId, budget_amount as budgetAmount,
               payment_method as paymentMethod, transfer_from as transferFrom, transfer_to as transferTo,
               description
        FROM vouchers WHERE id=?
    `).get(input.id) as any
    if (!current) throw new Error('Beleg nicht gefunden')
    // Capture tags before update for audit
    const beforeTags = getTagsForVoucher(input.id)
    const currentFull = { ...current, tags: beforeTags }
    // Enforce period lock for the voucher's existing date (block edits in closed year)
    ensurePeriodOpen(current.date, d)

    const newDate = input.date ?? current.date
    const newType = input.type ?? current.type
    const newEarmarkId = (input.earmarkId === undefined) ? current.earmarkId : input.earmarkId
    const newBudgetId = (input.budgetId === undefined) ? current.budgetId : input.budgetId

    // Additional check when date actually changes (ensures new date is open too)
    if (input.date != null) ensurePeriodOpen(newDate, d)

    // Earmark validations if earmark set
    if (newEarmarkId != null) {
        const em = d.prepare('SELECT id, is_active as isActive, start_date as startDate, end_date as endDate, budget, enforce_time_range as enforceTimeRange FROM earmarks WHERE id=?').get(newEarmarkId) as any
        if (!em) throw new Error('Zweckbindung nicht gefunden')
        if (!em.isActive) throw new Error('Zweckbindung ist inaktiv und kann nicht verwendet werden')
        
        // Zeitraum-Prüfung nur wenn enforceTimeRange aktiv ist
        if (em.enforceTimeRange) {
            if (em.startDate && newDate < em.startDate) throw new Error(`Buchungsdatum liegt vor Beginn der Zweckbindung (${em.startDate})`)
            if (em.endDate && newDate > em.endDate) throw new Error(`Buchungsdatum liegt nach Ende der Zweckbindung (${em.endDate})`)
        }

        const cfg = (getSetting<{ allowNegative?: boolean }>('earmark', d) || { allowNegative: false })
        if (!cfg.allowNegative && newType === 'OUT') {
            const balRow = d.prepare(`
                SELECT
                  IFNULL(SUM(CASE WHEN v.type='IN' THEN ve.amount ELSE 0 END),0) as allocated,
                  IFNULL(SUM(CASE WHEN v.type='OUT' THEN ve.amount ELSE 0 END),0) as released
                FROM voucher_earmarks ve
                JOIN vouchers v ON v.id = ve.voucher_id
                WHERE ve.earmark_id = ? AND v.date <= ? AND v.id <> ?
            `).get(newEarmarkId, newDate, input.id) as any
            const balance = Math.round(((balRow.allocated || 0) - (balRow.released || 0)) * 100) / 100
            const budget = Number(em?.budget ?? 0) || 0
            const remaining = Math.round(((budget + balance) * 100)) / 100
            const wouldBe = Math.round(((remaining - (current.grossAmount || 0)) * 100)) / 100
            if (wouldBe < 0) warnings.push('Zweckbindung würde den verfügbaren Rahmen unterschreiten.')
        }
    }

    // Budget validations if budget set
    if (newBudgetId != null) {
        const budget = d.prepare('SELECT id, start_date as startDate, end_date as endDate, enforce_time_range as enforceTimeRange FROM budgets WHERE id=?').get(newBudgetId) as any
        if (!budget) throw new Error('Budget nicht gefunden')
        
        // Zeitraum-Prüfung nur wenn enforceTimeRange aktiv ist
        if (budget.enforceTimeRange) {
            if (budget.startDate && newDate < budget.startDate) throw new Error(`Buchungsdatum liegt vor Beginn des Budgets (${budget.startDate})`)
            if (budget.endDate && newDate > budget.endDate) throw new Error(`Buchungsdatum liegt nach Ende des Budgets (${budget.endDate})`)
        }
    }

    const fields: string[] = []
    const params: any[] = []
    if (input.date != null) { fields.push('date = ?'); params.push(input.date) }
    if (input.type != null) { fields.push('type = ?'); params.push(input.type) }
    if (input.sphere != null) { fields.push('sphere = ?'); params.push(input.sphere) }
    if (input.categoryId !== undefined) { fields.push('category_id = ?'); params.push(input.categoryId) }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description) }
    if (input.paymentMethod !== undefined) { fields.push('payment_method = ?'); params.push(input.paymentMethod) }
    if (input.earmarkId !== undefined) { fields.push('earmark_id = ?'); params.push(input.earmarkId) }
    if (input.earmarkAmount !== undefined) { fields.push('earmark_amount = ?'); params.push(input.earmarkAmount) }
    if (input.transferFrom !== undefined) { fields.push('transfer_from = ?'); params.push(input.transferFrom) }
    if (input.transferTo !== undefined) { fields.push('transfer_to = ?'); params.push(input.transferTo) }
    if (input.budgetId !== undefined) { fields.push('budget_id = ?'); params.push(input.budgetId) }
    if (input.budgetAmount !== undefined) { fields.push('budget_amount = ?'); params.push(input.budgetAmount) }
    // If sphere or year changes, re-number voucher (year, seq_no, voucher_no)
    const targetSphere = input.sphere ?? current.sphere
    const targetYear = Number(newDate?.slice(0, 4) || String(current.year))
    const sphereChanged = input.sphere != null && input.sphere !== current.sphere
    const yearChanged = Number(targetYear) !== Number(current.year)
    if (sphereChanged || yearChanged) {
        const seq = nextVoucherSequence(d as any, targetYear, targetSphere)
        const newNo = makeVoucherNo(targetYear, newDate, targetSphere, seq)
        fields.push('year = ?')
        params.push(targetYear)
        fields.push('seq_no = ?')
        params.push(seq)
        fields.push('voucher_no = ?')
        params.push(newNo)
        if (current.voucherNo && current.voucherNo !== newNo) warnings.push(`Belegnummer neu vergeben: ${current.voucherNo} → ${newNo}`)
    }

    // Amount updates (optional)
    let setAmounts = false
    if (input.grossAmount != null) {
        fields.push('gross_amount = ?')
        params.push(input.grossAmount)
        // If gross is provided, we don't infer net/vat unless vatRate also provided
        if (input.vatRate != null) {
            fields.push('vat_rate = ?')
            params.push(input.vatRate)
            fields.push('net_amount = ?')
            const net = Math.round((Number(input.grossAmount) / (1 + Number(input.vatRate)/100)) * 100) / 100
            params.push(net)
            fields.push('vat_amount = ?')
            const vat = Math.round((Number(input.grossAmount) - net) * 100) / 100
            params.push(vat)
        }
        setAmounts = true
    } else if (input.netAmount != null) {
        fields.push('net_amount = ?')
        params.push(input.netAmount)
        const rate = input.vatRate != null ? Number(input.vatRate) : (current.vatRate ?? 0)
        fields.push('vat_rate = ?')
        params.push(rate)
        const vat = Math.round((Number(input.netAmount) * rate / 100) * 100) / 100
        fields.push('vat_amount = ?')
        params.push(vat)
        const gross = Math.round(((Number(input.netAmount) + vat) * 100)) / 100
        fields.push('gross_amount = ?')
        params.push(gross)
        setAmounts = true
    } else if (input.vatRate != null) {
        // Update vatRate with recompute from existing net if available
        const rate = Number(input.vatRate)
        const curNet = current?.netAmount ?? 0
        fields.push('vat_rate = ?')
        params.push(rate)
        const vat = Math.round((curNet * rate / 100) * 100) / 100
        fields.push('vat_amount = ?')
        params.push(vat)
        const gross = Math.round(((curNet + vat) * 100)) / 100
        fields.push('gross_amount = ?')
        params.push(gross)
        setAmounts = true
    }
    if (!fields.length && !input.tags && !setAmounts) return { id: input.id, warnings }
    params.push(input.id)
    d.prepare(`UPDATE vouchers SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    // Apply tag changes before snapshotting 'after' so audit contains new tags state
    if (input.tags) setVoucherTags(input.id, input.tags)
    try {
        const after = d.prepare(`
            SELECT id, date, type, sphere, description, payment_method as paymentMethod, transfer_from as transferFrom, transfer_to as transferTo,
                   category_id as categoryId,
                   earmark_id as earmarkId, earmark_amount as earmarkAmount, budget_id as budgetId, budget_amount as budgetAmount,
                   net_amount as netAmount, vat_rate as vatRate, gross_amount as grossAmount
            FROM vouchers WHERE id=?
        `).get(input.id) as any
        const afterTags = getTagsForVoucher(input.id)
        const afterFull = { ...after, tags: afterTags }
        writeAudit(d as any, null, 'vouchers', input.id, 'UPDATE', { before: currentFull, after: afterFull, changes: input })
    } catch { /* ignore audit failures */ }
    return { id: input.id, warnings }
}

export function deleteVoucher(id: number) {
    const d = getDb()
    // Barvorschuss-Platzhalter dürfen nicht manuell gelöscht werden (wird über Barvorschuss-Abschluss/Löschen entfernt).
    assertNotCashAdvancePlaceholder(d as any, id)
    // Snapshot before deletion for audit
    const snap = d.prepare('SELECT id, voucher_no as voucherNo, date, type, sphere, payment_method as paymentMethod, description, net_amount as netAmount, vat_rate as vatRate, vat_amount as vatAmount, gross_amount as grossAmount, earmark_id as earmarkId, earmark_amount as earmarkAmount, budget_id as budgetId, budget_amount as budgetAmount FROM vouchers WHERE id=?').get(id) as any
    if (!snap) throw new Error('Beleg nicht gefunden')
    // Block deletion in closed year
    ensurePeriodOpen(snap.date, d)
    // Optional: cascade delete files on disk
    const files = d.prepare('SELECT file_path FROM voucher_files WHERE voucher_id=?').all(id) as any[]
    d.prepare('DELETE FROM voucher_files WHERE voucher_id=?').run(id)
    d.prepare('DELETE FROM vouchers WHERE id=?').run(id)
    for (const f of files) {
        try { fs.unlinkSync(f.file_path) } catch { }
    }
    try { writeAudit(d as any, null, 'vouchers', id, 'DELETE', { snapshot: snap }) } catch { }
    return { id }
}

export function deleteVoucherTx(d: DB, id: number) {
    // Snapshot before deletion for audit
    const snap = d.prepare('SELECT id, voucher_no as voucherNo, date, type, sphere, payment_method as paymentMethod, description, net_amount as netAmount, vat_rate as vatRate, vat_amount as vatAmount, gross_amount as grossAmount, earmark_id as earmarkId, earmark_amount as earmarkAmount, budget_id as budgetId, budget_amount as budgetAmount FROM vouchers WHERE id=?').get(id) as any
    if (!snap) throw new Error('Beleg nicht gefunden')
    // Block deletion in closed year
    ensurePeriodOpen(snap.date, d)
    // Remove files (should be none for placeholder, but keep consistent)
    const files = d.prepare('SELECT file_path FROM voucher_files WHERE voucher_id=?').all(id) as any[]
    d.prepare('DELETE FROM voucher_files WHERE voucher_id=?').run(id)
    d.prepare('DELETE FROM vouchers WHERE id=?').run(id)
    for (const f of files) {
        try { fs.unlinkSync(f.file_path) } catch { }
    }
    try { writeAudit(d as any, null, 'vouchers', id, 'DELETE', { snapshot: snap }) } catch { }
    return { id }
}

export function clearAllVouchers() {
    return withTransaction((d: DB) => {
        // Collect file paths before deletion
        const files = d.prepare('SELECT file_path FROM voucher_files').all() as any[]
        const countRow = d.prepare('SELECT COUNT(1) as c FROM vouchers').get() as any
        const deleted = Number(countRow?.c || 0)
        d.prepare('UPDATE vouchers SET reversed_by_id = NULL, original_id = NULL').run()
        d.prepare('UPDATE invoices SET posted_voucher_id = NULL WHERE posted_voucher_id IS NOT NULL').run()
        d.prepare('UPDATE membership_payments SET voucher_id = NULL WHERE voucher_id IS NOT NULL').run()
        d.prepare('DELETE FROM voucher_budgets').run()
        d.prepare('DELETE FROM voucher_earmarks').run()
        d.prepare('DELETE FROM voucher_tags').run()
        d.prepare('DELETE FROM voucher_files').run()
        d.prepare('DELETE FROM vouchers').run()
        d.prepare('DELETE FROM voucher_sequences').run()
        // Remove files from disk
        for (const f of files) {
            try { fs.unlinkSync(f.file_path) } catch { }
        }
        // Audit entry (system)
        try { writeAudit(d as any, null, 'vouchers', 0, 'CLEAR_ALL', { deleted }) } catch { }
        return { deleted }
    })
}

export function cashBalance(params: { from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) {
    const d = getDb()
    const to = params.to ?? new Date().toISOString().slice(0, 10)
    const year = to.slice(0, 4)
    // Wenn 'from' übergeben wird, nutze es; sonst Jahresanfang
    const from = params.from ?? `${year}-01-01`
    const wh: string[] = ["date >= ?", "date <= ?"]
    const vals: any[] = [from, to]
    if (params.sphere) { wh.push('sphere = ?'); vals.push(params.sphere) }
    const whereSql = ' WHERE ' + wh.join(' AND ')
    const rows = d.prepare(`
        SELECT payment_method as pm, type, transfer_from as transferFrom, transfer_to as transferTo, IFNULL(SUM(gross_amount), 0) as gross
        FROM vouchers${whereSql}
        GROUP BY payment_method, type, transfer_from, transfer_to
    `).all(...vals) as any[]
    let bar = 0, bank = 0
    for (const r of rows) {
        if (r.type === 'TRANSFER') {
            const amt = r.gross || 0
            if (r.transferFrom === 'BAR') bar -= amt
            if (r.transferFrom === 'BANK') bank -= amt
            if (r.transferTo === 'BAR') bar += amt
            if (r.transferTo === 'BANK') bank += amt
        } else {
            const sign = r.type === 'IN' ? 1 : r.type === 'OUT' ? -1 : 0
            if (r.pm === 'BAR') bar += sign * (r.gross || 0)
            if (r.pm === 'BANK') bank += sign * (r.gross || 0)
        }
    }
    return { BAR: Math.round(bar * 100) / 100, BANK: Math.round(bank * 100) / 100 }
}

// Distinct voucher years present in the database
export function listVoucherYears(): number[] {
    const d = getDb()

        // NOTE: Some installations store ISO dates with time (e.g. 2026-01-17T00:00:00.000Z).
        // SQLite's strftime() may return NULL for some ISO variants, so we fall back to parsing the year
        // from the string prefix (and keep a defensive legacy parser for dd.mm.yy).
        const rows = d.prepare(`
                SELECT DISTINCT year FROM (
                    SELECT
                        CASE
                            WHEN date GLOB '____-__-__*' THEN CAST(substr(date, 1, 4) AS INTEGER)
                            WHEN date GLOB '__.__.__' THEN
                                (CASE
                                    WHEN CAST(substr(date, 7, 2) AS INTEGER) < 70 THEN 2000 + CAST(substr(date, 7, 2) AS INTEGER)
                                    ELSE 1900 + CAST(substr(date, 7, 2) AS INTEGER)
                                END)
                            ELSE CAST(strftime('%Y', date) AS INTEGER)
                        END AS year
                    FROM vouchers
                )
                WHERE year IS NOT NULL AND year BETWEEN 1900 AND 2100
                ORDER BY year DESC
        `).all() as any[]

        return rows.map(r => Number(r.year)).filter((y) => Number.isFinite(y))
}

// Attachments
export function listFilesForVoucher(voucherId: number) {
    const d = getDb()
    const rows = d.prepare(`
        SELECT id, file_name as fileName, file_path as filePath, mime_type as mimeType, size, created_at as createdAt
        FROM voucher_files WHERE voucher_id = ? ORDER BY created_at DESC, id DESC
    `).all(voucherId) as any[]
    return rows
}

export function getFileById(fileId: number) {
    const d = getDb()
    const row = d.prepare(`
        SELECT id, voucher_id as voucherId, file_name as fileName, file_path as filePath, mime_type as mimeType, size, created_at as createdAt
        FROM voucher_files WHERE id = ?
    `).get(fileId) as any
    return row
}

export function addFileToVoucher(voucherId: number, fileName: string, dataBase64: string, mime?: string) {
    const d = getDb()
    const { filesDir } = getAppDataDir()
    const buff = Buffer.from(dataBase64, 'base64')
    const safeName = `${voucherId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    const abs = path.join(filesDir, safeName)
    fs.writeFileSync(abs, buff)
    const info = d.prepare('INSERT INTO voucher_files(voucher_id, file_name, file_path, mime_type, size) VALUES (?,?,?,?,?)').run(voucherId, fileName, abs, mime ?? null, buff.length)
    const id = Number(info.lastInsertRowid)
    return { id }
}

export function deleteVoucherFile(fileId: number) {
    const d = getDb()
    const row = d.prepare('SELECT file_path as filePath FROM voucher_files WHERE id=?').get(fileId) as any
    d.prepare('DELETE FROM voucher_files WHERE id=?').run(fileId)
    try { if (row?.filePath && fs.existsSync(row.filePath)) fs.unlinkSync(row.filePath) } catch { /* ignore */ }
    return { id: fileId }
}

// ─────────────────────────────────────────────────────────────────────────────
// Junction table functions for multiple budgets/earmarks per voucher
// ─────────────────────────────────────────────────────────────────────────────

export type VoucherBudgetAssignment = { id: number; budgetId: number; amount: number; label?: string }
export type VoucherEarmarkAssignment = { id: number; earmarkId: number; amount: number; code?: string; name?: string }

/** Get all budget assignments for a voucher */
export function getVoucherBudgets(voucherId: number): VoucherBudgetAssignment[] {
    const d = getDb()
    const rows = d.prepare(`
        SELECT vb.id, vb.budget_id as budgetId, vb.amount,
               CASE
                   WHEN b.name IS NOT NULL AND b.name <> '' THEN b.name
                   WHEN b.category_name IS NOT NULL AND b.category_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.category_name)
                   WHEN b.project_name IS NOT NULL AND b.project_name <> '' THEN printf('%04d-%s-%s', b.year, b.sphere, b.project_name)
                   ELSE printf('%04d-%s', b.year, b.sphere)
               END as label
        FROM voucher_budgets vb
        JOIN budgets b ON b.id = vb.budget_id
        WHERE vb.voucher_id = ?
        ORDER BY vb.id
    `).all(voucherId) as VoucherBudgetAssignment[]
    return rows
}

/** Get all earmark assignments for a voucher */
export function getVoucherEarmarks(voucherId: number): VoucherEarmarkAssignment[] {
    const d = getDb()
    const rows = d.prepare(`
        SELECT ve.id, ve.earmark_id as earmarkId, ve.amount,
               e.code, e.name
        FROM voucher_earmarks ve
        JOIN earmarks e ON e.id = ve.earmark_id
        WHERE ve.voucher_id = ?
        ORDER BY ve.id
    `).all(voucherId) as VoucherEarmarkAssignment[]
    return rows
}

/** Set budget assignments for a voucher (replaces existing) */
export function setVoucherBudgets(voucherId: number, assignments: Array<{ budgetId: number; amount: number }>) {
    const d = getDb()
    d.prepare('DELETE FROM voucher_budgets WHERE voucher_id = ?').run(voucherId)
    const stmt = d.prepare('INSERT INTO voucher_budgets (voucher_id, budget_id, amount) VALUES (?, ?, ?)')
    for (const a of assignments) {
        if (a.budgetId && a.amount > 0) {
            stmt.run(voucherId, a.budgetId, a.amount)
        }
    }
    // Sync legacy columns for backwards compatibility (use first assignment)
    if (assignments.length > 0 && assignments[0].budgetId) {
        d.prepare('UPDATE vouchers SET budget_id = ?, budget_amount = ? WHERE id = ?')
            .run(assignments[0].budgetId, assignments[0].amount, voucherId)
    } else {
        d.prepare('UPDATE vouchers SET budget_id = NULL, budget_amount = NULL WHERE id = ?').run(voucherId)
    }
}

/** Set earmark assignments for a voucher (replaces existing) */
export function setVoucherEarmarks(voucherId: number, assignments: Array<{ earmarkId: number; amount: number }>) {
    const d = getDb()
    d.prepare('DELETE FROM voucher_earmarks WHERE voucher_id = ?').run(voucherId)
    const stmt = d.prepare('INSERT INTO voucher_earmarks (voucher_id, earmark_id, amount) VALUES (?, ?, ?)')
    for (const a of assignments) {
        if (a.earmarkId && a.amount > 0) {
            stmt.run(voucherId, a.earmarkId, a.amount)
        }
    }
    // Sync legacy columns for backwards compatibility (use first assignment)
    if (assignments.length > 0 && assignments[0].earmarkId) {
        d.prepare('UPDATE vouchers SET earmark_id = ?, earmark_amount = ? WHERE id = ?')
            .run(assignments[0].earmarkId, assignments[0].amount, voucherId)
    } else {
        d.prepare('UPDATE vouchers SET earmark_id = NULL, earmark_amount = NULL WHERE id = ?').run(voucherId)
    }
}

/** Add a single budget assignment to a voucher */
export function addVoucherBudget(voucherId: number, budgetId: number, amount: number): { id: number } {
    const d = getDb()
    const info = d.prepare('INSERT OR REPLACE INTO voucher_budgets (voucher_id, budget_id, amount) VALUES (?, ?, ?)')
        .run(voucherId, budgetId, amount)
    return { id: Number(info.lastInsertRowid) }
}

/** Add a single earmark assignment to a voucher */
export function addVoucherEarmark(voucherId: number, earmarkId: number, amount: number): { id: number } {
    const d = getDb()
    const info = d.prepare('INSERT OR REPLACE INTO voucher_earmarks (voucher_id, earmark_id, amount) VALUES (?, ?, ?)')
        .run(voucherId, earmarkId, amount)
    return { id: Number(info.lastInsertRowid) }
}

/** Remove a budget assignment by id */
export function removeVoucherBudget(assignmentId: number) {
    const d = getDb()
    d.prepare('DELETE FROM voucher_budgets WHERE id = ?').run(assignmentId)
    return { id: assignmentId }
}

/** Remove an earmark assignment by id */
export function removeVoucherEarmark(assignmentId: number) {
    const d = getDb()
    d.prepare('DELETE FROM voucher_earmarks WHERE id = ?').run(assignmentId)
    return { id: assignmentId }
}

/** Get total budget allocation for a voucher */
export function getVoucherBudgetTotal(voucherId: number): number {
    const d = getDb()
    const row = d.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM voucher_budgets WHERE voucher_id = ?')
        .get(voucherId) as { total: number }
    return row.total
}

/** Get total earmark allocation for a voucher */
export function getVoucherEarmarkTotal(voucherId: number): number {
    const d = getDb()
    const row = d.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM voucher_earmarks WHERE voucher_id = ?')
        .get(voucherId) as { total: number }
    return row.total
}

/** Get list of category IDs that are used in at least one voucher */
export function getUsedCategoryIds(): number[] {
    const d = getDb()
    const rows = d.prepare('SELECT DISTINCT category_id FROM vouchers WHERE category_id IS NOT NULL').all() as { category_id: number }[]
    return rows.map(r => r.category_id)
}
