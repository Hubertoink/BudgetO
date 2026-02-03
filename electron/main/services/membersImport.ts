import ExcelJS from 'exceljs'
import { Buffer as NodeBuffer } from 'node:buffer'
import path from 'node:path'

import { getDb } from '../db/database'
import { createMember, updateMember } from '../repositories/members'
import { writeAudit } from './audit'
import { ensureExportsBaseDir } from './exportsDir'

export type MembersImportPreview = {
    headers: string[]
    sample: any[]
    suggestedMapping: Record<string, string | null>
    headerRowIndex: number
}

export type MembersImportExecuteOptions = {
    updateExisting?: boolean
    selectedRows?: number[]
    /**
     * Optional per-row overrides coming from the preview UI.
     * Keys are worksheet row numbers (1-based), values are objects keyed by header name.
     */
    rowEdits?: Record<string, Record<string, any>>
}

export type MembersImportExecuteResult = {
    imported: number
    updated: number
    skipped: number
    errors: Array<{ row: number; message: string }>
    rowStatuses?: Array<{ row: number; ok: boolean; message?: string }>
    errorFilePath?: string
}

function normalizeHeader(h: string) {
    return (h || '').toString().trim().toLowerCase()
}

function normalizeCellValue(v: any): any {
    if (v == null) return null
    if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) return v
    if (typeof v === 'object') {
        if ((v as any).richText && Array.isArray((v as any).richText)) {
            try {
                return (v as any).richText.map((p: any) => p.text).join('')
            } catch {
                // ignore
            }
        }
        if ((v as any).text && typeof (v as any).text === 'string') return (v as any).text
        if (Object.prototype.hasOwnProperty.call(v, 'result')) return (v as any).result
        if ((v as any).formula && Object.prototype.hasOwnProperty.call(v, 'result')) return (v as any).result
    }
    return String(v)
}

function parseString(v: any): string | undefined {
    if (v == null) return undefined
    const s = String(v).trim()
    return s ? s : undefined
}

function parseNumber(v: any): number | undefined {
    if (v == null || v === '') return undefined
    if (typeof v === 'number' && isFinite(v)) return v
    const s = String(v)
        .replace(/\u00A0/g, ' ')
        .replace(/[€\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    const n = Number(s)
    return isFinite(n) ? n : undefined
}

function parseISODate(v: any): string | undefined {
    if (v == null || v === '') return undefined
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    if (typeof v === 'number' && isFinite(v)) {
        // Excel serial
        const ms = (v - 25569) * 24 * 60 * 60 * 1000
        const d = new Date(ms)
        return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
    }
    const s = String(v).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
    if (dm) {
        const d = new Date(Date.UTC(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])))
        return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
    }
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (m) {
        // US-ish m/d/yyyy
        const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])))
        return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
    }
    const n = Number(s)
    if (isFinite(n) && n > 25569) {
        const ms = (n - 25569) * 24 * 60 * 60 * 1000
        const d = new Date(ms)
        return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
    }
    return undefined
}

function parseStatus(v: any): 'ACTIVE' | 'NEW' | 'PAUSED' | 'LEFT' | undefined {
    const s = normalizeHeader(String(v ?? ''))
    if (!s) return undefined
    if (/(active|aktiv|a$)/.test(s)) return 'ACTIVE'
    if (/(new|neu)/.test(s)) return 'NEW'
    if (/(paused|paus|ruhe|inaktiv)/.test(s)) return 'PAUSED'
    if (/(left|ausgetreten|austritt|gek\W?ndigt)/.test(s)) return 'LEFT'
    if (s === '1') return 'ACTIVE'
    if (s === '0') return 'PAUSED'
    return undefined
}

function parseBoardRole(v: any): 'V1' | 'V2' | 'KASSIER' | 'KASSENPR1' | 'KASSENPR2' | 'SCHRIFT' | undefined {
    const s = normalizeHeader(String(v ?? ''))
    if (!s) return undefined
    if (/(v1|1\.\s*vorstand|vorsitz)/.test(s)) return 'V1'
    if (/(v2|2\.\s*vorstand|stellv)/.test(s)) return 'V2'
    if (/(kassier|kasse\b|treasurer)/.test(s)) return 'KASSIER'
    if (/(kassenpr\s*1|kassenpr1|kassenpr\s*i)/.test(s)) return 'KASSENPR1'
    if (/(kassenpr\s*2|kassenpr2|kassenpr\s*ii)/.test(s)) return 'KASSENPR2'
    if (/(schrift|sekret)/.test(s)) return 'SCHRIFT'
    return undefined
}

function parseInterval(v: any): 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | undefined {
    const s = normalizeHeader(String(v ?? ''))
    if (!s) return undefined
    if (/(month|monat)/.test(s) || s === 'm' || s === 'monthly') return 'MONTHLY'
    if (/(quart|viertelj)/.test(s) || s === 'q' || s === 'quarterly') return 'QUARTERLY'
    if (/(year|jahr)/.test(s) || s === 'y' || s === 'yearly' || s === 'annual') return 'YEARLY'
    if (s === '1') return 'MONTHLY'
    if (s === '3') return 'QUARTERLY'
    if (s === '12') return 'YEARLY'
    return undefined
}

function normalizeIban(v: any): string | undefined {
    const s = parseString(v)
    if (!s) return undefined
    return s.replace(/\s+/g, '').toUpperCase()
}

function normalizeBic(v: any): string | undefined {
    const s = parseString(v)
    if (!s) return undefined
    return s.replace(/\s+/g, '').toUpperCase()
}

function suggestMapping(headers: string[]): Record<string, string | null> {
    const map: Record<string, string | null> = {
        memberNo: null,
        name: null,
        email: null,
        phone: null,
        address: null,
        street: null,
        zip: null,
        city: null,
        status: null,
        boardRole: null,
        join_date: null,
        leave_date: null,
        iban: null,
        bic: null,
        contribution_amount: null,
        contribution_interval: null,
        mandate_ref: null,
        mandate_date: null,
        notes: null,
        next_due_date: null
    }

    for (const h of headers) {
        const n = normalizeHeader(h)
        if (!map.memberNo && /(mitglied\w*nr|mitgl\w*nr|mitgliedsnummer|member\s*no|mitgliedsnr|nr\b)/.test(n)) map.memberNo = h
        else if (!map.name && /(^name$|voll\w*name|mitglied\w*name|anzeige\w*name)/.test(n)) map.name = h
        else if (!map.email && /(e-?mail)/.test(n)) map.email = h
        else if (!map.phone && /(telefon|phone|handy|mobil)/.test(n)) map.phone = h
        else if (!map.street && /(stra\u00dfe|strasse|street)/.test(n)) map.street = h
        else if (!map.zip && /(^plz$|post\w*zahl|zip)/.test(n)) map.zip = h
        else if (!map.city && /(ort\b|stadt|city)/.test(n)) map.city = h
        else if (!map.address && /(adresse|address)/.test(n)) map.address = h
        else if (!map.status && /status/.test(n)) map.status = h
        else if (!map.boardRole && /(vorstand|board\s*role|rolle)/.test(n)) map.boardRole = h
        else if (!map.join_date && /(eintritt|join)/.test(n)) map.join_date = h
        else if (!map.leave_date && /(austritt|leave)/.test(n)) map.leave_date = h
        else if (!map.iban && /iban/.test(n)) map.iban = h
        else if (!map.bic && /\bbic\b|swift/.test(n)) map.bic = h
        else if (!map.contribution_amount && /(beitrag|contribution).*(betrag|amount)?/.test(n)) map.contribution_amount = h
        else if (!map.contribution_interval && /(intervall|turnus|interval|rhythm|monat|quart|jahr)/.test(n)) map.contribution_interval = h
        else if (!map.mandate_ref && /(mandat).*(ref|referenz)|mandatsref/.test(n)) map.mandate_ref = h
        else if (!map.mandate_date && /(mandat).*(datum|date)/.test(n)) map.mandate_date = h
        else if (!map.notes && /(notiz|bemerk|notes|comment)/.test(n)) map.notes = h
        else if (!map.next_due_date && /(f\u00e4llig|due)/.test(n)) map.next_due_date = h
    }

    return map
}

// Header heuristics: scan first 25 rows and pick best match
function detectHeader(ws: ExcelJS.Worksheet): { headerRowIdx: number; headers: string[]; idxByHeader: Record<string, number>; score: number } {
    const maxScan = Math.min(25, ws.actualRowCount)
    let bestIdx = 1
    let bestScore = -1
    let bestHeaders: string[] = []
    let bestIdxByHeader: Record<string, number> = {}

    for (let r = 1; r <= maxScan; r++) {
        const row = ws.getRow(r)
        const headers: string[] = []
        const cols: number[] = []
        let nonEmpty = 0
        row.eachCell((cell, colNumber) => {
            const v = String(normalizeCellValue(cell.value) ?? '').trim()
            headers.push(v)
            cols.push(colNumber)
            if (v) nonEmpty++
        })
        if (headers.length === 0 || nonEmpty < 2) continue

        const joined = headers.map(h => h.toLowerCase()).join(' | ')
        let score = 0
        if (/(mitglied\w*nr|mitgliedsnummer|member\s*no)/.test(joined)) score += 4
        if (/(eintritt|join)/.test(joined)) score += 3
        if (/(name|vollname)/.test(joined)) score += 3
        if (/(e-?mail)/.test(joined)) score += 2
        if (/(iban|bic|swift)/.test(joined)) score += 1
        if (/(beitrag|contribution|intervall|turnus)/.test(joined)) score += 1

        if (score > bestScore) {
            bestScore = score
            bestIdx = r
            bestHeaders = headers
            const map: Record<string, number> = {}
            headers.forEach((h, i) => {
                map[h] = cols[i]
            })
            bestIdxByHeader = map
        }
    }

    if (bestScore < 0) {
        const row = ws.getRow(1)
        const headers: string[] = []
        const cols: number[] = []
        row.eachCell((cell, colNumber) => {
            headers.push(String(normalizeCellValue(cell.value) ?? '').trim())
            cols.push(colNumber)
        })
        bestHeaders = headers
        bestIdx = 1
        const map: Record<string, number> = {}
        headers.forEach((h, i) => {
            map[h] = cols[i]
        })
        bestIdxByHeader = map
    }

    return { headerRowIdx: bestIdx, headers: bestHeaders, idxByHeader: bestIdxByHeader, score: bestScore }
}

function pickWorksheet(wb: ExcelJS.Workbook): { ws: ExcelJS.Worksheet; headerRowIdx: number; headers: string[]; idxByHeader: Record<string, number> } | null {
    let best: { ws: ExcelJS.Worksheet; headerRowIdx: number; headers: string[]; idxByHeader: Record<string, number>; score: number } | null = null
    for (const ws of wb.worksheets) {
        const det = detectHeader(ws)
        if (!best || det.score > best.score) {
            best = { ws, ...det }
        }
    }
    if (!best) return null
    return { ws: best.ws, headerRowIdx: best.headerRowIdx, headers: best.headers, idxByHeader: best.idxByHeader }
}

export async function previewMembersXlsx(base64: string): Promise<MembersImportPreview> {
    const wb = new ExcelJS.Workbook()
    const buf = NodeBuffer.from(base64, 'base64')
    await (wb as any).xlsx.load(buf as any)
    const pick = pickWorksheet(wb)
    if (!pick) throw new Error('Keine Tabelle gefunden')

    const { ws, headerRowIdx, headers, idxByHeader } = pick
    const sample: any[] = []
    const maxR = Math.min(ws.actualRowCount, headerRowIdx + 50)
    for (let r = headerRowIdx + 1; r <= maxR; r++) {
        const rowObj: any = {}
        headers.forEach((h, i) => {
            const col = idxByHeader[h] || (i + 1)
            rowObj[h || `col${i + 1}`] = normalizeCellValue(ws.getRow(r).getCell(col).value)
        })
        sample.push(rowObj)
    }

    return {
        headers,
        sample,
        suggestedMapping: suggestMapping(headers),
        headerRowIndex: headerRowIdx
    }
}

function getValue(
    ws: ExcelJS.Worksheet,
    idxByHeader: Record<string, number>,
    mapping: Record<string, string | null>,
    row: number,
    key: string,
    rowEdits?: Record<string, Record<string, any>>
) {
    const header = mapping?.[key]
    if (!header) return undefined

    const edits = rowEdits?.[String(row)]
    if (edits && Object.prototype.hasOwnProperty.call(edits, header)) return edits[header]

    const col = idxByHeader[header]
    if (!col) return undefined
    return normalizeCellValue(ws.getRow(row).getCell(col).value)
}

function buildAddress(street?: string, zip?: string, city?: string, address?: string): string | undefined {
    const a = (address || '').trim()
    if (a) return a
    const parts = [street?.trim(), [zip?.trim(), city?.trim()].filter(Boolean).join(' ')].filter(Boolean)
    const joined = parts.join(', ').trim()
    return joined ? joined : undefined
}

function shouldSkipRow(memberNo?: string, name?: string) {
    const mn = (memberNo || '').trim()
    const nm = (name || '').trim()
    return !mn && !nm
}

export async function executeMembersImport(
    base64: string,
    mapping: Record<string, string | null>,
    options?: MembersImportExecuteOptions
): Promise<MembersImportExecuteResult> {
    const wb = new ExcelJS.Workbook()
    const buf = NodeBuffer.from(base64, 'base64')
    await (wb as any).xlsx.load(buf as any)
    const pick = pickWorksheet(wb)
    if (!pick) throw new Error('Keine Tabelle gefunden')

    const { ws, headerRowIdx, headers, idxByHeader } = pick

    const db = getDb()

    let imported = 0
    let updated = 0
    let skipped = 0
    const errors: Array<{ row: number; message: string }> = []
    const rowStatuses: Array<{ row: number; ok: boolean; message?: string }> = []
    const track = (row: number, ok: boolean, message?: string) => {
        if (rowStatuses.length < 2000) rowStatuses.push({ row, ok, message })
    }

    const allDataRows: number[] = []
    for (let r = headerRowIdx + 1; r <= ws.actualRowCount; r++) allDataRows.push(r)

    const selected = (options?.selectedRows && options.selectedRows.length > 0)
        ? new Set(options.selectedRows)
        : null

    const rowsToProcess = selected ? allDataRows.filter(r => selected.has(r)) : allDataRows

    for (const r of rowsToProcess) {
        try {
            const memberNo = parseString(getValue(ws, idxByHeader, mapping, r, 'memberNo', options?.rowEdits))
            const name = parseString(getValue(ws, idxByHeader, mapping, r, 'name', options?.rowEdits))
            if (shouldSkipRow(memberNo, name)) { skipped++; track(r, false, 'Leerzeile'); continue }

            const join_date = parseISODate(getValue(ws, idxByHeader, mapping, r, 'join_date', options?.rowEdits))
            const leave_date = parseISODate(getValue(ws, idxByHeader, mapping, r, 'leave_date', options?.rowEdits))

            const email = parseString(getValue(ws, idxByHeader, mapping, r, 'email', options?.rowEdits))
            const phone = parseString(getValue(ws, idxByHeader, mapping, r, 'phone', options?.rowEdits))

            const street = parseString(getValue(ws, idxByHeader, mapping, r, 'street', options?.rowEdits))
            const zip = parseString(getValue(ws, idxByHeader, mapping, r, 'zip', options?.rowEdits))
            const city = parseString(getValue(ws, idxByHeader, mapping, r, 'city', options?.rowEdits))
            const addressRaw = parseString(getValue(ws, idxByHeader, mapping, r, 'address', options?.rowEdits))
            const address = buildAddress(street, zip, city, addressRaw)

            const status = parseStatus(getValue(ws, idxByHeader, mapping, r, 'status', options?.rowEdits))
            const boardRole = parseBoardRole(getValue(ws, idxByHeader, mapping, r, 'boardRole', options?.rowEdits))

            const iban = normalizeIban(getValue(ws, idxByHeader, mapping, r, 'iban', options?.rowEdits))
            const bic = normalizeBic(getValue(ws, idxByHeader, mapping, r, 'bic', options?.rowEdits))

            const contribution_amount = parseNumber(getValue(ws, idxByHeader, mapping, r, 'contribution_amount', options?.rowEdits))
            const contribution_interval = parseInterval(getValue(ws, idxByHeader, mapping, r, 'contribution_interval', options?.rowEdits))

            const mandate_ref = parseString(getValue(ws, idxByHeader, mapping, r, 'mandate_ref', options?.rowEdits))
            const mandate_date = parseISODate(getValue(ws, idxByHeader, mapping, r, 'mandate_date', options?.rowEdits))

            const notes = parseString(getValue(ws, idxByHeader, mapping, r, 'notes', options?.rowEdits))
            const next_due_date = parseISODate(getValue(ws, idxByHeader, mapping, r, 'next_due_date', options?.rowEdits))

            if (!memberNo) throw new Error('Mitgliedsnummer fehlt')
            if (!name) throw new Error('Name fehlt')
            if (!join_date) throw new Error('Eintrittsdatum fehlt/ungültig')

            const updateExisting = !!options?.updateExisting

            if (updateExisting) {
                const existing = db
                    .prepare('SELECT id FROM members WHERE member_no = ? LIMIT 1')
                    .get(memberNo) as any

                if (existing?.id) {
                    const payload: any = { id: Number(existing.id) }
                    // only set fields we actually have (avoid overwriting with empty)
                    payload.name = name
                    if (email !== undefined) payload.email = email
                    if (phone !== undefined) payload.phone = phone
                    if (address !== undefined) payload.address = address
                    if (status !== undefined) payload.status = status
                    if (boardRole !== undefined) payload.boardRole = boardRole
                    if (iban !== undefined) payload.iban = iban
                    if (bic !== undefined) payload.bic = bic
                    if (contribution_amount !== undefined) payload.contribution_amount = contribution_amount
                    if (contribution_interval !== undefined) payload.contribution_interval = contribution_interval
                    if (mandate_ref !== undefined) payload.mandate_ref = mandate_ref
                    if (mandate_date !== undefined) payload.mandate_date = mandate_date
                    payload.join_date = join_date
                    if (leave_date !== undefined) payload.leave_date = leave_date
                    if (notes !== undefined) payload.notes = notes
                    if (next_due_date !== undefined) payload.next_due_date = next_due_date

                    updateMember(payload)
                    updated++
                    track(r, true, 'Aktualisiert')
                    continue
                }
            }

            // Create new member
            const createPayload: any = {
                memberNo,
                name,
                join_date
            }
            if (email !== undefined) createPayload.email = email
            if (phone !== undefined) createPayload.phone = phone
            if (address !== undefined) createPayload.address = address
            if (status !== undefined) createPayload.status = status
            if (boardRole !== undefined) createPayload.boardRole = boardRole
            if (iban !== undefined) createPayload.iban = iban
            if (bic !== undefined) createPayload.bic = bic
            if (contribution_amount !== undefined) createPayload.contribution_amount = contribution_amount
            if (contribution_interval !== undefined) createPayload.contribution_interval = contribution_interval
            if (mandate_ref !== undefined) createPayload.mandate_ref = mandate_ref
            if (mandate_date !== undefined) createPayload.mandate_date = mandate_date
            if (leave_date !== undefined) createPayload.leave_date = leave_date
            if (notes !== undefined) createPayload.notes = notes
            if (next_due_date !== undefined) createPayload.next_due_date = next_due_date

            createMember(createPayload)
            imported++
            track(r, true, 'Neu')
        } catch (e: any) {
            skipped++
            const msg = e?.message || String(e)
            errors.push({ row: r, message: msg })
            track(r, false, msg)
        }
    }

    let errorFilePath: string | undefined
    if (errors.length > 0) {
        const errWb = new ExcelJS.Workbook()
        const errWs = errWb.addWorksheet('Fehler')
        const headersWithMeta = ['Zeile', ...headers, 'Fehler']
        errWs.addRow(headersWithMeta)
        for (const e of errors) {
            const rowVals: any[] = []
            rowVals.push(e.row)
            for (const h of headers) {
                const col = idxByHeader[h]
                const v = col ? ws.getRow(e.row).getCell(col).value : undefined
                rowVals.push(normalizeCellValue(v))
            }
            rowVals.push(e.message)
            errWs.addRow(rowVals)
        }
        try {
            const baseDir = ensureExportsBaseDir()
            const when = new Date()
            const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}_${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}${String(when.getSeconds()).padStart(2, '0')}`
            errorFilePath = path.join(baseDir, `MitgliederImport_Fehler_${stamp}.xlsx`)
            await (errWb as any).xlsx.writeFile(errorFilePath)
        } catch {
            // ignore
        }
    }

    try {
        writeAudit(db as any, null, 'members_import', 0, 'EXECUTE', {
            format: 'MEMBERS_XLSX',
            imported,
            updated,
            skipped,
            errorCount: errors.length,
            errorFilePath: errorFilePath || null,
            when: new Date().toISOString()
        })
    } catch {
        // ignore
    }

    return { imported, updated, skipped, errors, rowStatuses, errorFilePath }
}

export async function generateMembersImportTemplate(destPath?: string): Promise<{ filePath: string }> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Mitglieder')

    ws.addRow(['BudgetO – Mitglieder Importvorlage'])
    ws.addRow(['Hinweise:'])
    ws.addRow(['1) Kopfzeile steht in Zeile 4. 2) Pflichtfelder sind mit * markiert. 3) Datumsformat empfohlen: YYYY-MM-DD oder TT.MM.JJJJ.'])
    ws.getRow(1).font = { bold: true, size: 14 }
    ws.getRow(2).font = { bold: true }
    ws.addRow([])

    const columns = [
        'Mitgliedsnummer *',
        'Name *',
        'E-Mail',
        'Telefon',
        'Straße',
        'PLZ',
        'Ort',
        'Adresse',
        'Status (ACTIVE/NEW/PAUSED/LEFT)',
        'Eintrittsdatum *',
        'Austrittsdatum',
        'IBAN',
        'BIC',
        'Beitrag',
        'Intervall (MONTHLY/QUARTERLY/YEARLY)',
        'Mandatsreferenz',
        'Mandatsdatum',
        'Notizen',
        'Nächste Fälligkeit',
        'Vorstandsrolle (V1/V2/KASSIER/...)'
    ]

    ws.columns = columns.map((c) => ({ width: Math.max(14, Math.min(40, c.length + 2)) }))

    ws.addTable({
        name: 'Mitglieder',
        ref: 'A4',
        headerRow: true,
        totalsRow: false,
        columns: columns.map((c) => ({ name: c })),
        rows: [
            ['1001', 'Max Mustermann', 'max@example.org', '0151 123456', 'Musterstraße 1', '12345', 'Musterstadt', '', 'ACTIVE', '2024-01-01', '', 'DE00123456781234567890', 'GENODEF1XXX', 24, 'YEARLY', 'MANDAT-1001', '2024-01-01', 'Beispielnotiz', '', '']
        ]
    })

    ws.views = [{ state: 'frozen', ySplit: 4 }]

    // Data validation: Status dropdown (column I = 9)
    ;(ws as any).dataValidations?.add('I5:I10000', { type: 'list', allowBlank: true, formulae: ['"ACTIVE,NEW,PAUSED,LEFT"'] })
    // Data validation: Intervall dropdown (column O = 15)
    ;(ws as any).dataValidations?.add('O5:O10000', { type: 'list', allowBlank: true, formulae: ['"MONTHLY,QUARTERLY,YEARLY"'] })
    // Data validation: Vorstandsrolle dropdown (column T = 20)
    ;(ws as any).dataValidations?.add('T5:T10000', { type: 'list', allowBlank: true, formulae: ['"V1,V2,KASSIER,KASSENPR1,KASSENPR2,SCHRIFT"'] })

    let filePath = destPath
    if (!filePath) {
        const baseDir = ensureExportsBaseDir()
        const when = new Date()
        const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}_${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}`
        filePath = path.join(baseDir, `Mitglieder_Import_Vorlage_${stamp}.xlsx`)
    }

    await wb.xlsx.writeFile(filePath)
    return { filePath }
}

export async function generateMembersImportTestData(destPath?: string): Promise<{ filePath: string }> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Mitglieder')

    ws.addRow(['BudgetO – Mitglieder Testdaten'])
    ws.addRow(['Diese Datei enthält Beispiel-Mitglieder für den Import.'])
    ws.addRow(['Kopfzeile in Zeile 4, darunter Daten.'])
    ws.getRow(1).font = { bold: true, size: 14 }
    ws.getRow(2).font = { bold: true }
    ws.addRow([])

    const columns = [
        'Mitgliedsnummer *',
        'Name *',
        'E-Mail',
        'Telefon',
        'Straße',
        'PLZ',
        'Ort',
        'Status (ACTIVE/NEW/PAUSED/LEFT)',
        'Eintrittsdatum *',
        'IBAN',
        'BIC',
        'Beitrag',
        'Intervall (MONTHLY/QUARTERLY/YEARLY)',
        'Mandatsreferenz',
        'Mandatsdatum',
        'Notizen'
    ]

    ws.columns = columns.map((c) => ({ width: Math.max(14, Math.min(40, c.length + 2)) }))

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')

    ws.addTable({
        name: 'Mitglieder',
        ref: 'A4',
        headerRow: true,
        totalsRow: false,
        columns: columns.map((c) => ({ name: c })),
        rows: [
            ['2001', 'Erika Musterfrau', 'erika@example.org', '0176 55555', 'Hauptstraße 12', '12345', 'Musterstadt', 'ACTIVE', `${y}-${m}-01`, 'DE11111111111111111111', 'GENODEF1XXX', 5, 'MONTHLY', 'MANDAT-2001', `${y}-${m}-01`, ''],
            ['2002', 'Chris Beispiel', 'chris@example.org', '', 'Nebenweg 3', '54321', 'Beispielort', 'NEW', `${y}-${m}-02`, '', '', 60, 'YEARLY', '', '', 'Beitrag jährlich'],
            ['2003', 'Alex Test', '', '', '', '', '', 'PAUSED', `${y}-${m}-03`, '', '', '', '', '', '', 'Pausiert']
        ]
    })

    ws.views = [{ state: 'frozen', ySplit: 4 }]

    // Data validation: Status dropdown (column H = 8)
    ;(ws as any).dataValidations?.add('H5:H10000', { type: 'list', allowBlank: true, formulae: ['"ACTIVE,NEW,PAUSED,LEFT"'] })
    // Data validation: Intervall dropdown (column M = 13)
    ;(ws as any).dataValidations?.add('M5:M10000', { type: 'list', allowBlank: true, formulae: ['"MONTHLY,QUARTERLY,YEARLY"'] })

    let filePath = destPath
    if (!filePath) {
        const baseDir = ensureExportsBaseDir()
        const when = new Date()
        const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}_${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}`
        filePath = path.join(baseDir, `Mitglieder_Import_Testdaten_${stamp}.xlsx`)
    }

    await wb.xlsx.writeFile(filePath)
    return { filePath }
}
