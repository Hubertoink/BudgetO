import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { IconBank, IconCash, IconArrow, TransferDisplay } from '../../../utils/icons'
import { ICONS } from '../../../utils/icons.constants'

// Helper function for contrast text color
function contrastText(bg?: string | null) {
    if (!bg) return '#000'
    const m = /^#?([0-9a-fA-F]{6})$/.exec(bg.trim())
    if (!m) return '#000'
    const hex = m[1]
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    // Perceived luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 ? '#000' : '#fff'
}

// LocalStorage key for column widths
const COLUMN_WIDTHS_KEY = 'journal-column-widths'

const FIXED_COL_WIDTHS: Record<string, number> = {
    // Fixed widths for columns with predictable content
    actions: 50,
    type: 35,
    date: 80,
}

const FIXED_COL_KEYS = new Set(Object.keys(FIXED_COL_WIDTHS))

function sanitizeColumnWidths(widths: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(widths || {})) {
        if (FIXED_COL_KEYS.has(k)) continue
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
        out[k] = v
    }
    return out
}

function loadColumnWidths(): Record<string, number> {
    try {
        const stored = localStorage.getItem(COLUMN_WIDTHS_KEY)
        const parsed = stored ? JSON.parse(stored) : {}
        return sanitizeColumnWidths(parsed)
    } catch { return {} }
}

function saveColumnWidths(widths: Record<string, number>) {
    try {
        localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(sanitizeColumnWidths(widths)))
    } catch { /* ignore */ }
}

interface JournalTableProps {
    rows: Array<{
        id: number
        voucherNo: string
        date: string
        type: 'IN' | 'OUT' | 'TRANSFER'
        sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
        categoryId?: number | null
        categoryName?: string | null
        categoryColor?: string | null
        description?: string | null
        paymentMethod?: 'BAR' | 'BANK' | null
        transferFrom?: 'BAR' | 'BANK' | null
        transferTo?: 'BAR' | 'BANK' | null
        netAmount: number
        vatRate: number
        vatAmount: number
        grossAmount: number
        fileCount?: number
        earmarkId?: number | null
        earmarkCode?: string | null
        budgetId?: number | null
        budgetLabel?: string | null
        budgetColor?: string | null
        budgets?: unknown[]
        tags?: string[]
        earmarksAssigned?: unknown[]
        taxonomyTerms?: Array<{ taxonomyId: number; taxonomyName: string; termId: number; termName: string; termColor?: string | null }>
        isCashAdvancePlaceholder?: boolean
    }>
    order: string[]
    cols: Record<string, boolean>
    onReorder: (o: string[]) => void
    earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
    tagDefs: Array<{ id: number; name: string; color?: string | null }>
    eurFmt: Intl.NumberFormat
    fmtDate: (s?: string) => string
    onEdit: (r: {
        id: number
        date: string
        description: string | null
        paymentMethod: 'BAR' | 'BANK' | null
        transferFrom?: 'BAR' | 'BANK' | null
        transferTo?: 'BAR' | 'BANK' | null
        type?: 'IN' | 'OUT' | 'TRANSFER'
        sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
        categoryId?: number | null
        categoryName?: string | null
        categoryColor?: string | null
        earmarkId?: number | null
        earmarkAmount?: number | null
        budgetId?: number | null
        budgetAmount?: number | null
        tags?: string[]
        netAmount?: number
        grossAmount?: number
        vatRate?: number
        budgets?: unknown[]
        earmarksAssigned?: unknown[]
    }) => void
    onDelete: (r: { id: number; voucherNo: string; description?: string | null }) => void
    onToggleSort: (col: 'date' | 'net' | 'gross' | 'budget' | 'earmark' | 'payment' | 'sphere') => void
    sortDir: 'ASC' | 'DESC'
    sortBy: 'date' | 'net' | 'gross' | 'budget' | 'earmark' | 'payment' | 'sphere'
    onTagClick?: (name: string) => void
    onTaxonomyTermClick?: (p: { termId: number; termName: string; taxonomyName: string }) => void
    onCategoryClick?: (p: { categoryId?: number | null; categoryName?: string | null; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) => void
    onEarmarkClick?: (id: number) => void
    onBudgetClick?: (id: number) => void
    highlightId?: number | null
    lockedUntil?: string | null
    onRowDoubleClick?: (row: any) => void
    budgetUsage?: Record<number, { planned: number; spent: number; inflow: number; remaining: number; percent: number; color?: string | null }>
    earmarkUsage?: Record<number, { allocated: number; released: number; balance: number; budget: number; remaining: number; percent: number; color?: string | null }>
    useCategoriesModule?: boolean
    canWrite?: boolean
}

type BudgetAssignment = { budgetId: number; amount?: number; label?: string | null }
type EarmarkAssignment = { earmarkId: number; amount?: number; code?: string | null; name?: string | null }

export default function JournalTable({
    rows,
    order,
    cols,
    onReorder,
    earmarks,
    tagDefs,
    eurFmt,
    fmtDate,
    onEdit,
    onDelete,
    onToggleSort,
    sortDir,
    sortBy,
    onTagClick,
    onTaxonomyTermClick,
    onCategoryClick,
    onEarmarkClick,
    onBudgetClick,
    highlightId,
    lockedUntil,
    onRowDoubleClick,
    budgetUsage,
    earmarkUsage,
    useCategoriesModule = false,
    canWrite = true
}: JournalTableProps) {
    const dragIdx = useRef<number | null>(null)
    const visibleOrder = order.filter(k => cols[k])
    const [hoverBudgetKey, setHoverBudgetKey] = useState<string | null>(null)
    const [hoverEarmarkKey, setHoverEarmarkKey] = useState<string | null>(null)
    const [hoverCategoryKey, setHoverCategoryKey] = useState<string | null>(null)
    const [hoverTagKey, setHoverTagKey] = useState<string | null>(null)

    const hoverCategoryTimer = useRef<number | null>(null)
    const hoverTagTimer = useRef<number | null>(null)

    const clearHoverCategoryTimer = useCallback(() => {
        if (hoverCategoryTimer.current != null) {
            window.clearTimeout(hoverCategoryTimer.current)
            hoverCategoryTimer.current = null
        }
    }, [])

    const clearHoverTagTimer = useCallback(() => {
        if (hoverTagTimer.current != null) {
            window.clearTimeout(hoverTagTimer.current)
            hoverTagTimer.current = null
        }
    }, [])

    useEffect(() => {
        return () => {
            clearHoverCategoryTimer()
            clearHoverTagTimer()
        }
    }, [clearHoverCategoryTimer, clearHoverTagTimer])

    const categoryUsage = useMemo(() => {
        type Usage = {
            key: string
            label: string
            color?: string | null
            count: number
            inGross: number
            outGross: number
        }
        const byKey: Record<string, Usage> = {}
        let totalIn = 0
        let totalOut = 0
        for (const r of rows) {
            if (r.type === 'IN') totalIn += Number(r.grossAmount || 0)
            if (r.type === 'OUT') totalOut += Number(r.grossAmount || 0)
        }
        for (const r of rows) {
            if (r.type === 'TRANSFER') continue
            // BudgetO: do not use legacy spheres (IDEELL/ZWECK/...) as category grouping.
            // Only show category usage for explicit (custom) categories.
            if (!r.categoryId) continue
            const key = `cat:${r.categoryId}`
            const label = (r.categoryName || `#${r.categoryId}`)
            const color = r.categoryColor || null
            if (!byKey[key]) byKey[key] = { key, label, color, count: 0, inGross: 0, outGross: 0 }
            byKey[key].count += 1
            if (r.type === 'IN') byKey[key].inGross += Number(r.grossAmount || 0)
            if (r.type === 'OUT') byKey[key].outGross += Number(r.grossAmount || 0)
        }
        const list = Object.values(byKey)
        list.sort((a, b) => (b.outGross || 0) - (a.outGross || 0) || (b.count - a.count))
        return { byKey, list, totals: { inGross: totalIn, outGross: totalOut } }
    }, [rows])

    const tagUsage = useMemo(() => {
        type Usage = {
            tag: string
            key: string
            color?: string | null
            count: number
            inGross: number
            outGross: number
        }
        const byKey: Record<string, Usage> = {}
        let totalIn = 0
        let totalOut = 0
        for (const r of rows) {
            if (r.type === 'IN') totalIn += Number(r.grossAmount || 0)
            if (r.type === 'OUT') totalOut += Number(r.grossAmount || 0)
        }
        for (const r of rows) {
            if (r.type === 'TRANSFER') continue
            const tags = Array.isArray(r.tags) ? r.tags : []
            for (const rawTag of tags) {
                const tag = String(rawTag || '').trim()
                if (!tag) continue
                const key = `tag:${tag.toLowerCase()}`
                if (!byKey[key]) {
                    const meta = (tagDefs || []).find(t => (t.name || '').toLowerCase() === tag.toLowerCase())
                    byKey[key] = { tag, key, color: meta?.color ?? null, count: 0, inGross: 0, outGross: 0 }
                }
                byKey[key].count += 1
                if (r.type === 'IN') byKey[key].inGross += Number(r.grossAmount || 0)
                if (r.type === 'OUT') byKey[key].outGross += Number(r.grossAmount || 0)
            }
        }
        const list = Object.values(byKey)
        list.sort((a, b) => (b.outGross || 0) - (a.outGross || 0) || (b.count - a.count))
        return { byKey, list, totals: { inGross: totalIn, outGross: totalOut } }
    }, [rows, tagDefs])
    
    // Column resize state
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths())
    const resizingCol = useRef<string | null>(null)
    const resizeStartX = useRef<number>(0)
    const resizeStartWidth = useRef<number>(0)
    const tableRef = useRef<HTMLTableElement>(null)

    // Save column widths when they change
    useEffect(() => {
        if (Object.keys(columnWidths).length > 0) {
            saveColumnWidths(columnWidths)
        }
    }, [columnWidths])

    // Handle resize move
    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingCol.current) return
        if (!tableRef.current) return

        const delta = e.clientX - resizeStartX.current
        const newWidth = Math.max(40, resizeStartWidth.current + delta)

        // Get container width to limit total table width
        const container = tableRef.current.parentElement
        if (container) {
            const containerWidth = container.clientWidth
            const currentTableWidth = tableRef.current.offsetWidth
            const currentColWidth = resizeStartWidth.current
            const projectedTableWidth = currentTableWidth - currentColWidth + newWidth

            // If table would exceed container, limit the column width
            if (projectedTableWidth > containerWidth && delta > 0) {
                const maxNewWidth = currentColWidth + (containerWidth - currentTableWidth)
                if (maxNewWidth > 40) {
                    setColumnWidths(prev => ({
                        ...prev,
                        [resizingCol.current!]: Math.max(40, maxNewWidth)
                    }))
                }
                return
            }
        }

        setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }))
    }, [])

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        resizingCol.current = null
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [handleResizeMove])

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
        e.preventDefault()
        e.stopPropagation()

        resizingCol.current = colKey
        resizeStartX.current = e.clientX

        // Get current column width (use currentTarget for consistent behavior)
        const th = (e.currentTarget as HTMLElement).closest('th')
        resizeStartWidth.current = th?.offsetWidth || 100

        document.addEventListener('mousemove', handleResizeMove)
        document.addEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [handleResizeEnd, handleResizeMove])

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeEnd)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [handleResizeEnd, handleResizeMove])

    function onHeaderDragStart(e: React.DragEvent<HTMLTableCellElement>, idx: number) {
        dragIdx.current = idx
        e.dataTransfer.effectAllowed = 'move'
    }
    function onHeaderDragOver(e: React.DragEvent<HTMLTableCellElement>) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }
    function onHeaderDrop(e: React.DragEvent<HTMLTableCellElement>, idx: number) {
        e.preventDefault()
        const from = dragIdx.current
        dragIdx.current = null
        if (from == null || from === idx) return
        // Reorder within full order, not just visible
        const keyFrom = visibleOrder[from]
        const keyTo = visibleOrder[idx]
        const next = order.slice()
        const a = next.indexOf(keyFrom)
        const b = next.indexOf(keyTo)
        if (a === -1 || b === -1) return
        const [moved] = next.splice(a, 1)
        next.splice(b, 0, moved)
        onReorder(next)
    }
    const renderSortIcon = (col: 'date' | 'net' | 'gross' | 'budget' | 'earmark' | 'payment' | 'sphere') => {
        const active = sortBy === col
        const sym = active ? (sortDir === 'DESC' ? ICONS.ARROW_DOWN : ICONS.ARROW_UP) : ICONS.ARROW_BOTH
        const color = active ? 'var(--warning)' : 'var(--text-dim)'
        return <span className={`sort-icon ${active ? 'active' : 'inactive'}`} aria-hidden="true" style={{ color }}>{sym}</span>
    }
    const thFor = (k: string) => (
        k === 'actions' ? <th key={k} align="center" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Aktionen</th>
            : k === 'date' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('date')} style={{ cursor: 'pointer' }}>Datum {renderSortIcon('date')}</th>
                : k === 'voucherNo' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Nr.</th>
                    : k === 'type' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Art</th>
                        : k === 'sphere' ? <th key={k} className="sortable" align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('sphere')}>Kategorie {renderSortIcon('sphere')}</th>
                            : k === 'description' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Beschreibung</th>
                                : k === 'earmark' ? <th key={k} className="sortable" align="center" title="Zweckbindung" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('earmark')}>🎯 {renderSortIcon('earmark')}</th>
                                    : k === 'budget' ? <th key={k} className="sortable" align="center" title="Budget" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('budget')}>💰 {renderSortIcon('budget')}</th>
                                        : k === 'paymentMethod' ? <th key={k} className="sortable" align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('payment')}>Zahlweg {renderSortIcon('payment')}</th>
                                            : k === 'attachments' ? <th key={k} align="center" title="Anhänge" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>📎</th>
                                                : k === 'net' ? <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('net')} style={{ cursor: 'pointer' }}>Netto {renderSortIcon('net')}</th>
                                                    : k === 'vat' ? <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>MwSt</th>
                                                        : <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={() => onToggleSort('gross')} style={{ cursor: 'pointer' }}>Brutto {renderSortIcon('gross')}</th>
    )
    const colorFor = (name: string) => (tagDefs || []).find(t => (t.name || '').toLowerCase() === (name || '').toLowerCase())?.color
    const isLocked = (d: string) => {
        if (!lockedUntil) return false
        return String(d) <= String(lockedUntil)
    }

    // Get column width (user-defined only; otherwise let table auto-fit)
    const getColWidth = (k: string): string | undefined => {
        // Fixed widths win over persisted widths
        const fixed = FIXED_COL_WIDTHS[k]
        if (fixed) return `${fixed}px`

        if (columnWidths[k]) return `${columnWidths[k]}px`

        return undefined
    }

    const isResizableCol = (k: string) => !FIXED_COL_KEYS.has(k)

    // Render resize handle
    const ResizeHandle = ({ colKey }: { colKey: string }) => (
        <span
            className="col-resize-handle"
            onMouseDown={(e) => handleResizeStart(e, colKey)}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
            aria-hidden="true"
            onDragStart={(e) => {
                e.preventDefault()
                e.stopPropagation()
            }}
        />
    )

    const tdFor = (k: string, r: any) => (
        k === 'actions' ? (
            <td key={k} align="center" style={{ whiteSpace: 'nowrap' }}>
                {r.isCashAdvancePlaceholder ? (
                    <span
                        className="badge"
                        title="Barvorschuss-Platzhalter (nicht editierbar). Wird beim Abschluss/Löschen des Barvorschusses automatisch entfernt."
                        aria-label="Barvorschuss-Platzhalter (nicht editierbar)"
                    >
                        🔒
                    </span>
                ) : isLocked(r.date) ? (
                    <span className="badge" title={`Bis ${lockedUntil} abgeschlossen (Jahresabschluss)`} aria-label="Gesperrt">🔒</span>
                ) : (
                    canWrite ? (
                        <button className="btn btn-edit" title="Bearbeiten" onClick={() => onEdit({ id: r.id, date: r.date, description: r.description ?? '', paymentMethod: r.paymentMethod ?? null, transferFrom: r.transferFrom ?? null, transferTo: r.transferTo ?? null, type: r.type, sphere: r.sphere, categoryId: r.categoryId ?? null, categoryName: r.categoryName ?? null, categoryColor: r.categoryColor ?? null, earmarkId: r.earmarkId ?? null, earmarkAmount: r.earmarkAmount ?? null, budgetId: r.budgetId ?? null, budgetAmount: r.budgetAmount ?? null, tags: r.tags || [], netAmount: r.netAmount, grossAmount: r.grossAmount, vatRate: r.vatRate, budgets: r.budgets || [], earmarksAssigned: r.earmarksAssigned || [] })}>✎</button>
                    ) : null
                )}
            </td>
        ) : k === 'date' ? (
            <td key={k}>{fmtDate(r.date)}</td>
        ) : k === 'voucherNo' ? (
            <td key={k}>{r.voucherNo}</td>
        ) : k === 'type' ? (
            <td key={k}><span className={`badge ${r.type.toLowerCase()}`}>{r.type}</span></td>
        ) : k === 'sphere' ? (
            <td key={k}>
                {r.type === 'TRANSFER' ? '' : (
                    r.categoryId ? (
                        (() => {
                            const key = `cat:${r.categoryId}`
                            const usage = categoryUsage.byKey[key]
                            const hoverKey = `${r.id}:cat:${r.categoryId}`
                            const hoverActive = hoverCategoryKey === hoverKey
                            const saldo = usage ? (usage.inGross - usage.outGross) : 0

                            return (
                                <div
                                    style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}
                                    onMouseEnter={() => {
                                        clearHoverCategoryTimer()
                                        hoverCategoryTimer.current = window.setTimeout(() => setHoverCategoryKey(hoverKey), 800)
                                    }}
                                    onMouseLeave={() => {
                                        clearHoverCategoryTimer()
                                        setHoverCategoryKey(null)
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="badge"
                                        style={{
                                            background: r.categoryColor || 'var(--surface-alt)',
                                            color: contrastText(r.categoryColor || undefined),
                                            border: r.categoryColor ? `1px solid ${r.categoryColor}` : undefined,
                                            cursor: onCategoryClick ? 'pointer' : undefined,
                                            maxWidth: 180,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                        aria-label={r.categoryName ? `Nach Kategorie ${r.categoryName} filtern` : 'Nach Kategorie filtern'}
                                        onClick={(e) => { e.stopPropagation(); onCategoryClick?.({ categoryId: r.categoryId ?? null, categoryName: r.categoryName ?? null }) }}
                                    >
                                        {r.categoryName || 'Kategorie'}
                                    </button>

                                    <div
                                        className="category-usage-tooltip"
                                        style={{
                                            position: 'absolute',
                                            top: '110%',
                                            right: 0,
                                            minWidth: 260,
                                            maxWidth: 'min(360px, calc(100vw - 32px))',
                                            opacity: hoverActive ? 0.92 : 0,
                                            pointerEvents: hoverActive ? 'auto' : 'none',
                                            transition: 'opacity 0.15s ease, transform 0.15s ease',
                                            transformOrigin: 'top',
                                            zIndex: 9999,
                                            transform: hoverActive ? 'translate(0, 0)' : 'translate(0, -6px)'
                                        }}
                                        role="tooltip"
                                    >
                                        <div className="category-usage-tooltip__body">
                                            {usage ? (
                                                <>
                                                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {usage.label}
                                                    </div>
                                                    <div className="category-usage-tooltip__stats">
                                                        <div>
                                                            <div className="category-usage-tooltip__statLabel">Buchungen</div>
                                                            <div className="category-usage-tooltip__statValue">{usage.count}</div>
                                                        </div>
                                                        <div>
                                                            <div className="category-usage-tooltip__statLabel">Saldo (IN−OUT)</div>
                                                            <div className="category-usage-tooltip__statValue" style={{ color: saldo < 0 ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(saldo)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="category-usage-tooltip__statLabel">Einnahmen (Brutto)</div>
                                                            <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.inGross)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="category-usage-tooltip__statLabel">Ausgaben (Brutto)</div>
                                                            <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.outGross)}</div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="helper" style={{ padding: 6 }}>Keine Daten.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()
                    ) : useCategoriesModule ? (
                        <span className="text-muted">—</span>
                    ) : (
                        <span className="text-muted">—</span>
                    )
                )}
            </td>
        ) : k === 'description' ? (
            <td key={k}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ minWidth: 160, flex: '1 1 auto' }}>{r.description || ''}</span>
                    {(r.tags || []).map((t: string) => {
                        const bg = colorFor(t) || undefined
                        const fg = contrastText(bg)
                        const hoverKey = `${r.id}:tag:${String(t || '').toLowerCase()}`
                        const hoverActive = hoverTagKey === hoverKey
                        const usage = tagUsage.byKey[`tag:${String(t || '').toLowerCase()}`]
                        const totalOut = tagUsage.totals.outGross
                        const base = totalOut > 0 ? totalOut : Math.max(1, (tagUsage.totals.inGross + tagUsage.totals.outGross))
                        const pct = usage ? Math.min(100, Math.max(0, ((usage.outGross / base) * 100))) : 0
                        const barColor = pct >= 80 ? 'var(--warning)' : 'var(--accent)'
                        const saldo = usage ? (usage.inGross - usage.outGross) : 0
                        return (
                            <span
                                key={t}
                                style={{ position: 'relative', display: 'inline-block' }}
                                onMouseEnter={() => {
                                    clearHoverTagTimer()
                                    hoverTagTimer.current = window.setTimeout(() => setHoverTagKey(hoverKey), 800)
                                }}
                                onMouseLeave={() => {
                                    clearHoverTagTimer()
                                    setHoverTagKey(null)
                                }}
                            >
                                <button
                                    className="chip"
                                    style={{ background: bg, color: bg ? fg : undefined, cursor: 'pointer' }}
                                    aria-label={`Nach Tag ${t} filtern`}
                                    onClick={(e) => { e.stopPropagation(); onTagClick?.(t); }}
                                >
                                    {t}
                                </button>

                                <div
                                    className="tag-usage-tooltip"
                                    style={{
                                        position: 'absolute',
                                        top: '110%',
                                        left: 0,
                                        minWidth: 260,
                                        maxWidth: 'min(360px, calc(100vw - 32px))',
                                        opacity: hoverActive ? 0.92 : 0,
                                        pointerEvents: hoverActive ? 'auto' : 'none',
                                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                                        transformOrigin: 'top',
                                        zIndex: 9999,
                                        transform: hoverActive ? 'translate(0, 0)' : 'translate(0, -6px)'
                                    }}
                                    role="tooltip"
                                >
                                    <div className="tag-usage-tooltip__list">
                                        {tagUsage.list.slice(0, 3).map((x, i) => {
                                            const active = x.tag.toLowerCase() === String(t || '').toLowerCase()
                                            const localBase = (tagUsage.totals.outGross > 0 ? tagUsage.totals.outGross : Math.max(1, tagUsage.totals.inGross + tagUsage.totals.outGross))
                                            const localPct = localBase > 0 ? (x.outGross / localBase) * 100 : 0
                                            const pctColor = localPct >= 80 ? 'var(--warning)' : 'var(--text-dim)'
                                            return (
                                                <div key={`${x.key}:${i}`} className={`tag-usage-tooltip__item ${active ? 'tag-usage-tooltip__item--active' : ''}`.trim()}>
                                                    <div className="tag-usage-tooltip__itemLabel">{x.tag}</div>
                                                    <div className="tag-usage-tooltip__itemPct" style={{ color: pctColor }}>{localPct.toFixed(1)}%</div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="tag-usage-tooltip__body">
                                        {usage ? (
                                            <>
                                                <div className="tag-usage-tooltip__bar">
                                                    <div className="tag-usage-tooltip__barFill" style={{ width: `${pct}%`, background: barColor }} />
                                                </div>
                                                <div className="tag-usage-tooltip__stats">
                                                    <div>
                                                        <div className="tag-usage-tooltip__statLabel">Buchungen</div>
                                                        <div className="tag-usage-tooltip__statValue">{usage.count}</div>
                                                    </div>
                                                    <div>
                                                        <div className="tag-usage-tooltip__statLabel">Saldo (IN−OUT)</div>
                                                        <div className="tag-usage-tooltip__statValue" style={{ color: saldo < 0 ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(saldo)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="tag-usage-tooltip__statLabel">Einnahmen (Brutto)</div>
                                                        <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.inGross)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="tag-usage-tooltip__statLabel">Ausgaben (Brutto)</div>
                                                        <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.outGross)}</div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="helper" style={{ padding: 6 }}>Tagdaten werden geladen…</div>
                                        )}
                                    </div>
                                </div>
                            </span>
                        )
                    })}

                    {(r.taxonomyTerms || []).map((tt: { taxonomyId: number; taxonomyName: string; termId: number; termName: string; termColor?: string | null }) => {
                        const bg = tt.termColor || undefined
                        const fg = contrastText(bg)
                        const title = `Nach ${tt.taxonomyName}: ${tt.termName} filtern`
                        return (
                            <button
                                key={`${tt.taxonomyId}:${tt.termId}`}
                                className="chip"
                                style={{
                                    background: bg,
                                    color: bg ? fg : undefined,
                                    border: bg ? `1px solid ${bg}` : '1px solid var(--border)',
                                    cursor: 'pointer'
                                }}
                                title={title}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onTaxonomyTermClick?.({ termId: tt.termId, termName: tt.termName, taxonomyName: tt.taxonomyName })
                                }}
                            >
                                {tt.termName}
                            </button>
                        )
                    })}
                </div>
            </td>
        ) : k === 'earmark' ? (
            <td key={k} align="center">
                {(() => {
                    const maxVisible = 2
                    const raw: unknown = (r as any).earmarksAssigned
                    const multi = Array.isArray(raw) ? (raw as EarmarkAssignment[]).filter((e) => typeof e?.earmarkId === 'number' || !!e?.code) : []

                    const singleId = r.earmarkId as number | null | undefined
                    const singleCode = r.earmarkCode as string | null | undefined
                    const fallbackSingle: EarmarkAssignment[] = (singleId != null || singleCode) ? [{ earmarkId: singleId ?? 0, code: singleCode ?? null }] : []

                    const list = multi.length ? multi : fallbackSingle
                    if (!list.length) return ''

                    const visible = list.slice(0, maxVisible)
                    const rest = Math.max(0, list.length - visible.length)

                    return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflow: 'visible' }}>
                            {visible.map((ea, idx) => {
                                const meta = (ea.earmarkId ? earmarks.find((e) => e.id === ea.earmarkId) : undefined)
                                    || (ea.code ? earmarks.find((e) => e.code === ea.code) : undefined)

                                const id = (ea.earmarkId && ea.earmarkId > 0) ? ea.earmarkId : meta?.id
                                const code = (ea.code && String(ea.code).trim()) ? String(ea.code).trim() : (meta?.code || (id ? `#${id}` : '—'))
                                const name = (ea.name && String(ea.name).trim()) ? String(ea.name).trim() : (meta?.name || code)
                                const bg = meta?.color
                                const fg = contrastText(bg)
                                const usage = id ? earmarkUsage?.[id] : undefined
                                const hoverKey = `${r.id}:earmark:${id ?? 'none'}:${idx}`
                                const hoverActive = hoverEarmarkKey === hoverKey
                                const barPct = usage ? Math.min(100, Math.max(0, usage.percent)) : 0
                                const barColor = usage ? (usage.percent >= 100 ? 'var(--danger)' : usage.percent >= 80 ? 'var(--warning)' : bg || 'var(--accent)') : (bg || 'var(--accent)')

                                return (
                                    <div
                                        key={`${id || code}:${idx}`}
                                        style={{ position: 'relative', display: 'inline-block', maxWidth: 100 }}
                                        onMouseEnter={() => setHoverEarmarkKey(hoverKey)}
                                        onMouseLeave={() => setHoverEarmarkKey(null)}
                                    >
                                        <button
                                            className="badge-earmark"
                                            style={{
                                                background: bg || undefined,
                                                color: bg ? fg : undefined,
                                                cursor: (onEarmarkClick && id != null) ? 'pointer' : 'default',
                                                border: bg ? `1px solid ${bg}` : undefined,
                                                maxWidth: 92,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                            onClick={(e) => { e.stopPropagation(); if (id != null) onEarmarkClick?.(id); }}
                                        >
                                            {code}
                                        </button>

                                        <div
                                            className="earmark-usage-tooltip"
                                            style={{
                                                position: 'absolute',
                                                top: '110%',
                                                right: 0,
                                                minWidth: 240,
                                                maxWidth: 'min(320px, calc(100vw - 32px))',
                                                opacity: hoverActive ? 1 : 0,
                                                pointerEvents: hoverActive ? 'auto' : 'none',
                                                transition: 'opacity 0.15s ease, transform 0.15s ease',
                                                transformOrigin: 'top',
                                                zIndex: 9999,
                                                transform: hoverActive ? 'translate(0, 0)' : 'translate(0, -6px)'
                                            }}
                                            role="tooltip"
                                        >
                                                <div className="earmark-usage-tooltip__list">
                                                    {list.slice(0, 3).map((e: any, i: number) => {
                                                        const eid = Number(e?.earmarkId)
                                                        const u = eid ? earmarkUsage?.[eid] : undefined
                                                        const pct = u ? u.percent : 0
                                                        const pctColor = u ? (u.percent >= 100 ? 'var(--danger)' : u.percent >= 80 ? 'var(--warning)' : 'var(--text-dim)') : 'var(--text-dim)'
                                                        const itemCode = (e?.code && String(e.code).trim()) ? String(e.code).trim() : (eid ? `#${eid}` : '—')
                                                        const active = eid === id
                                                        return (
                                                            <div key={`${eid}:${i}`} className={`earmark-usage-tooltip__item ${active ? 'earmark-usage-tooltip__item--active' : ''}`.trim()}>
                                                                <div className="earmark-usage-tooltip__itemLabel">{itemCode}</div>
                                                                <div className="earmark-usage-tooltip__itemPct" style={{ color: pctColor }}>{pct.toFixed(1)}%</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="earmark-usage-tooltip__body">
                                                    {usage ? (
                                                        <>
                                                            <div className="earmark-usage-tooltip__bar">
                                                                <div className="earmark-usage-tooltip__barFill" style={{ width: `${barPct}%`, background: barColor }} />
                                                            </div>

                                                            <div className="earmark-usage-tooltip__stats">
                                                                <div>
                                                                    <div className="earmark-usage-tooltip__statLabel">Budget</div>
                                                                    <div className="earmark-usage-tooltip__statValue">{eurFmt.format(usage.budget)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="earmark-usage-tooltip__statLabel">Verfügbar</div>
                                                                    <div className="earmark-usage-tooltip__statValue" style={{ color: usage.remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(usage.remaining)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="earmark-usage-tooltip__statLabel">Ausgaben</div>
                                                                    <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.allocated)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="earmark-usage-tooltip__statLabel">Einnahmen</div>
                                                                    <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.released)}</div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="helper" style={{ padding: 6 }}>Zweckbindungsdaten werden geladen…</div>
                                                    )}
                                                </div>
                                            </div>
                                    </div>
                                )
                            })}

                            {rest > 0 && (
                                <span className="badge" style={{ background: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={`${rest} weitere Zweckbindung(en)`}>
                                    +{rest}
                                </span>
                            )}
                        </div>
                    )
                })()}
            </td>
        ) : k === 'paymentMethod' ? (
            <td key={k}>
                {r.type === 'TRANSFER' ? (
                    (() => {
                        const from = r.transferFrom
                        const to = r.transferTo
                        const title = from && to ? `${from} → ${to}` : 'Transfer'
                        return (
                            <span className="badge pm-transfer" title={title} aria-label={title}>
                                <span className={`pm-icon ${from === 'BAR' ? 'pm-bar-icon' : 'pm-bank-icon'}`}>
                                    {from === 'BAR' ? <IconCash /> : <IconBank />}
                                </span>
                                <span className="transfer-arrow">→</span>
                                <span className={`pm-icon ${to === 'BAR' ? 'pm-bar-icon' : 'pm-bank-icon'}`}>
                                    {to === 'BAR' ? <IconCash /> : <IconBank />}
                                </span>
                            </span>
                        )
                    })()
                ) : (
                    r.paymentMethod ? (
                        <span className={`badge pm-${(r.paymentMethod || '').toLowerCase()}`} title={r.paymentMethod} aria-label={`Zahlweg: ${r.paymentMethod}`} style={{ display: 'inline-grid', placeItems: 'center' }}>
                            {r.paymentMethod === 'BAR' ? <IconCash /> : <IconBank />}
                        </span>
                    ) : ''
                )}
            </td>
        ) : k === 'budget' ? (
            <td key={k} align="center">
                {(() => {
                    const maxVisible = 2
                    const raw: unknown = (r as any).budgets
                    const multi = Array.isArray(raw) ? (raw as BudgetAssignment[]).filter((b) => typeof b?.budgetId === 'number' && b.budgetId > 0) : []

                    const singleId = r.budgetId as number | null | undefined
                    const singleLabel = r.budgetLabel as string | null | undefined
                    const singleColor = (r as any).budgetColor || undefined
                    const fallbackSingle: BudgetAssignment[] = (singleId != null || singleLabel) ? [{ budgetId: singleId ?? 0, label: singleLabel ?? null }] : []

                    const list = multi.length ? multi : fallbackSingle
                    if (!list.length) return ''

                    const visible = list.slice(0, maxVisible)
                    const rest = Math.max(0, list.length - visible.length)

                    return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflow: 'visible' }}>
                            {visible.map((ba, idx) => {
                                const id = ba.budgetId
                                const usage = id ? budgetUsage?.[id] : undefined
                                const bg = (usage?.color || (id === singleId ? singleColor : undefined)) as string | undefined
                                const fg = contrastText(bg)
                                const label = (ba.label && String(ba.label).trim()) ? String(ba.label).trim() : (id ? `#${id}` : '—')
                                const hoverKey = `${r.id}:budget:${id ?? 'none'}:${idx}`
                                const hoverActive = hoverBudgetKey === hoverKey
                                const barPct = usage ? Math.min(100, Math.max(0, usage.percent)) : 0
                                const barColor = usage ? (usage.percent >= 100 ? 'var(--danger)' : usage.percent >= 80 ? 'var(--warning)' : usage.color || bg || 'var(--accent)') : (bg || 'var(--accent)')

                                return (
                                    <div
                                        key={`${id}:${idx}`}
                                        style={{ position: 'relative', display: 'inline-block', maxWidth: 120 }}
                                        onMouseEnter={() => setHoverBudgetKey(hoverKey)}
                                        onMouseLeave={() => setHoverBudgetKey(null)}
                                    >
                                        <button
                                            className="badge-budget"
                                            style={{
                                                background: bg,
                                                color: bg ? fg : undefined,
                                                cursor: (onBudgetClick && id != null) ? 'pointer' : 'default',
                                                border: bg ? `1px solid ${bg}` : undefined,
                                                maxWidth: 120,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                            onClick={(e) => { e.stopPropagation(); if (id != null) onBudgetClick?.(id); }}
                                        >
                                            {label}
                                        </button>

                                        <div
                                            className="budget-usage-tooltip"
                                            style={{
                                                position: 'absolute',
                                                top: '110%',
                                                right: 0,
                                                minWidth: 260,
                                                maxWidth: 'min(340px, calc(100vw - 32px))',
                                                opacity: hoverActive ? 1 : 0,
                                                pointerEvents: hoverActive ? 'auto' : 'none',
                                                transition: 'opacity 0.15s ease, transform 0.15s ease',
                                                transformOrigin: 'top',
                                                zIndex: 9999,
                                                transform: hoverActive ? 'translate(0, 0)' : 'translate(0, -6px)'
                                            }}
                                            role="tooltip"
                                        >
                                                <div className="budget-usage-tooltip__list">
                                                    {list.slice(0, 3).map((b: any, i: number) => {
                                                        const bid = Number(b?.budgetId)
                                                        const u = bid ? budgetUsage?.[bid] : undefined
                                                        const pct = u ? u.percent : 0
                                                        const pctColor = u ? (u.percent >= 100 ? 'var(--danger)' : u.percent >= 80 ? 'var(--warning)' : 'var(--text-dim)') : 'var(--text-dim)'
                                                        const itemLabel = (b?.label && String(b.label).trim()) ? String(b.label).trim() : (bid ? `#${bid}` : '—')
                                                        const active = bid === id
                                                        return (
                                                            <div key={`${bid}:${i}`} className={`budget-usage-tooltip__item ${active ? 'budget-usage-tooltip__item--active' : ''}`.trim()}>
                                                                <div className="budget-usage-tooltip__itemLabel">{itemLabel}</div>
                                                                <div className="budget-usage-tooltip__itemPct" style={{ color: pctColor }}>{pct.toFixed(1)}%</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="budget-usage-tooltip__body">
                                                    {usage ? (
                                                        <>
                                                            <div className="budget-usage-tooltip__bar">
                                                                <div className="budget-usage-tooltip__barFill" style={{ width: `${barPct}%`, background: barColor }} />
                                                            </div>

                                                            <div className="budget-usage-tooltip__stats">
                                                                <div>
                                                                    <div className="budget-usage-tooltip__statLabel">Budget</div>
                                                                    <div className="budget-usage-tooltip__statValue">{eurFmt.format(usage.planned)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="budget-usage-tooltip__statLabel">Verfügbar</div>
                                                                    <div className="budget-usage-tooltip__statValue" style={{ color: usage.remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(usage.remaining)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="budget-usage-tooltip__statLabel">Ausgaben netto</div>
                                                                    <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.spent - usage.inflow)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="budget-usage-tooltip__statLabel">Brutto-Ausgaben</div>
                                                                    <div style={{ fontWeight: 600 }}>{eurFmt.format(usage.spent)}</div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="helper" style={{ padding: 6 }}>Budgetdaten werden geladen…</div>
                                                    )}
                                                </div>
                                            </div>
                                    </div>
                                )
                            })}

                            {rest > 0 && (
                                <span className="badge" style={{ background: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={`${rest} weitere Budget(s)`}>
                                    +{rest}
                                </span>
                            )}
                        </div>
                    )
                })()}
            </td>
        ) : k === 'attachments' ? (
            <td key={k} align="center">{(r.fileCount && r.fileCount > 0) ? <span className="badge" title={`${r.fileCount} Anhang${r.fileCount > 1 ? 'e' : ''}`}>📎</span> : ''}</td>
        ) : k === 'net' ? (
            <td key={k} align="right">{eurFmt.format(r.netAmount)}</td>
        ) : k === 'vat' ? (
            <td key={k} align="right">{eurFmt.format(r.vatAmount)}</td>
        ) : (
            <td key={k} align="right" className={r.type === 'IN' ? 'gross-in' : r.type === 'OUT' ? 'gross-out' : 'gross-transfer'}>{eurFmt.format(r.grossAmount)}</td>
        )
    )
    return (
        <div className="table-scroll-wrapper journal-table-scroll">
            <table className="journal-table resizable-table" cellPadding={6} ref={tableRef}>
                <colgroup>
                    {visibleOrder.map((k) => {
                        const width = getColWidth(k)
                        return <col key={k} style={width ? { width } : undefined} />
                    })}
                </colgroup>
                <thead>
                <tr>
                    {visibleOrder.map((k, idx) => {
                        const th = thFor(k)
                        // Clone the th and add resize handle
                        return React.cloneElement(th, {
                            key: k,
                            className: `${th.props.className || ''} resizable-th`.trim(),
                            children: (
                                <>
                                    {th.props.children}
                                    {isResizableCol(k) ? <ResizeHandle colKey={k} /> : null}
                                </>
                            )
                        })
                    })}
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                    <tr 
                        key={r.id} 
                        className={highlightId === r.id ? 'row-flash' : undefined}
                        onDoubleClick={() => onRowDoubleClick?.(r)}
                    >
                        {visibleOrder.map((k) => tdFor(k, r))}
                    </tr>
                ))}
                {rows.length === 0 && (
                    <tr>
                        <td colSpan={visibleOrder.length} className="helper">Keine Buchungen vorhanden.</td>
                    </tr>
                )}
            </tbody>
        </table>
        </div>
    )
}