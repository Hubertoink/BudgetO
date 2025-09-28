import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Simple contrast helper for hex colors (returns black or white text)
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

const EARMARK_PALETTE = ['#7C4DFF', '#2962FF', '#00B8D4', '#00C853', '#AEEA00', '#FFD600', '#FF9100', '#FF3D00', '#F50057', '#9C27B0']

export default function App() {
    // Global data refresh key to trigger summary re-fetches across views
    const [refreshKey, setRefreshKey] = useState(0)
    const bumpDataVersion = () => setRefreshKey((k) => k + 1)
    const [lastId, setLastId] = useState<number | null>(null)
    // Toast notifications
    const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error' | 'info'; text: string }>>([])
    const toastIdRef = useRef(1)
    const notify = (type: 'success' | 'error' | 'info', text: string, ms = 3000) => {
        const id = toastIdRef.current++
        setToasts(prev => [...prev, { id, type, text }])
        window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms)
    }
    // Dynamic available years from vouchers
    const [yearsAvail, setYearsAvail] = useState<number[]>([])
    useEffect(() => {
        let cancelled = false
        async function loadYears() {
            try {
                const res = await window.api?.reports?.years?.()
                if (!cancelled && res?.years) setYearsAvail(res.years)
            } catch { }
        }
        loadYears()
        const onChanged = () => loadYears()
        window.addEventListener('data-changed', onChanged)
        return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
    }, [])
    const [activePage, setActivePage] = useState<'Dashboard' | 'Buchungen' | 'Zweckbindungen' | 'Budgets' | 'Reports' | 'Belege' | 'Einstellungen'>(() => {
        try { return (localStorage.getItem('activePage') as any) || 'Buchungen' } catch { return 'Buchungen' }
    })

    const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem('sidebarCollapsed') === '1' } catch { return false }
    })
    const [reportsTab, setReportsTab] = useState<string>(() => {
        try {
            const v = localStorage.getItem('reportsTab') || 'overview'
            return v === 'compare' ? 'overview' : v
        } catch { return 'overview' }
    })
    // DOM-Debug removed for release
    // const [domDebug, setDomDebug] = useState<boolean>(false)
    // Global Tags Manager modal state
    const [showTagsManager, setShowTagsManager] = useState<boolean>(false)
    // Time filter modal state
    const [showTimeFilter, setShowTimeFilter] = useState<boolean>(false)
    useEffect(() => {
        try { localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0') } catch { }
    }, [sidebarCollapsed])

    useEffect(() => {
        try { localStorage.setItem('activePage', activePage) } catch { }
    }, [activePage])
    useEffect(() => {
        try { localStorage.setItem('reportsTab', reportsTab) } catch { }
    }, [reportsTab])

    // UI preference: date format (ISO vs PRETTY)
    type DateFmt = 'ISO' | 'PRETTY'
    const [dateFmt, setDateFmt] = useState<DateFmt>(() => {
        try { return (localStorage.getItem('ui.dateFmt') as DateFmt) || 'ISO' } catch { return 'ISO' }
    })
    useEffect(() => { try { localStorage.setItem('ui.dateFmt', dateFmt) } catch { } }, [dateFmt])
    const fmtDate = useMemo(() => {
        const pretty = (s?: string) => {
            if (!s) return ''
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
            if (!m) return s
            const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
            // Use UTC to avoid TZ shifting
            const dt = new Date(Date.UTC(y, mo - 1, d))
            const mon = dt.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
            const dd = String(d).padStart(2, '0')
            return `${dd} ${mon} ${y}`
        }
        return (s?: string) => dateFmt === 'PRETTY' ? pretty(s) : (s || '')
    }, [dateFmt])

    // Quick-Add modal state and actions
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const { quickAdd, setQuickAdd, qa, setQa, onQuickSave, files, setFiles, openFilePicker, onDropFiles } = useQuickAdd(today, async (p: any) => {
        try {
            const res = await window.api?.vouchers.create?.(p)
            if (res) {
                setLastId(res.id)
                notify('success', `Beleg erstellt: #${res.voucherNo} (Brutto ${res.grossAmount})`)
                await loadRecent()
                bumpDataVersion()
            }
            return res
        } catch (e: any) {
            notify('error', 'Fehler: ' + (e?.message || String(e)))
            return null
        }
    }, () => fileInputRef.current?.click())

    async function createSampleVoucher() {
        try {
            notify('info', 'Erzeuge Beleg …')
            const res = await window.api?.vouchers.create?.({
                date: today,
                type: 'IN',
                sphere: 'IDEELL',
                description: 'Dev Sample Voucher',
                netAmount: 100,
                vatRate: 19
            })
            if (res) {
                setLastId(res.id)
                notify('success', `Beleg erstellt: #${res.voucherNo} (Brutto ${res.grossAmount})`)
                await loadRecent()
                bumpDataVersion()
            }
        } catch (e: any) {
            notify('error', 'Fehler: ' + (e?.message || String(e)))
        }
    }

    async function reverseLastVoucher() {
        if (!lastId) {
            notify('info', 'Kein zuletzt erstellter Beleg zum Stornieren.')
            return
        }
        try {
            notify('info', 'Storniere Beleg …')
            const res = await window.api?.vouchers.reverse?.({ originalId: lastId, reason: 'Dev Reverse' })
            if (res) {
                notify('success', `Storno erstellt: #${res.voucherNo}`)
                await loadRecent()
                bumpDataVersion()
            }
        } catch (e: any) {
            notify('error', 'Fehler: ' + (e?.message || String(e)))
        }
    }

    const [rows, setRows] = useState<
        Array<{
            id: number
            voucherNo: string
            date: string
            type: 'IN' | 'OUT' | 'TRANSFER'
            sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
            description?: string | null
            paymentMethod?: 'BAR' | 'BANK' | null
            netAmount: number
            vatRate: number
            vatAmount: number
            grossAmount: number
            hasFiles?: boolean
            earmarkId?: number | null
            earmarkCode?: string | null
            fileCount?: number
            tags?: string[]
        }>
    >([])
    const [totalRows, setTotalRows] = useState<number>(0)
    const [page, setPage] = useState<number>(() => { try { return Number(localStorage.getItem('journal.page') || '1') } catch { return 1 } })
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(() => { try { return (localStorage.getItem('journal.sort') as any) || 'DESC' } catch { return 'DESC' } })
    // Column settings for Buchungen table (visibility + order)
    type ColKey = 'actions' | 'date' | 'voucherNo' | 'type' | 'sphere' | 'description' | 'earmark' | 'paymentMethod' | 'attachments' | 'net' | 'vat' | 'gross'
    const defaultCols: Record<ColKey, boolean> = { actions: true, date: true, voucherNo: true, type: true, sphere: true, description: true, earmark: true, paymentMethod: true, attachments: true, net: true, vat: true, gross: true }
    const defaultOrder: ColKey[] = ['actions', 'date', 'voucherNo', 'type', 'sphere', 'description', 'earmark', 'paymentMethod', 'attachments', 'net', 'vat', 'gross']
    function sanitizeOrder(raw: any): ColKey[] {
        const arr = Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : []
        const known = new Set<ColKey>(['actions', 'date', 'voucherNo', 'type', 'sphere', 'description', 'earmark', 'paymentMethod', 'attachments', 'net', 'vat', 'gross'])
        const cleaned = arr.filter((k) => known.has(k as ColKey)) as ColKey[]
        // ensure all keys appear exactly once; append any missing in default order
        const missing = defaultOrder.filter((k) => !cleaned.includes(k))
        return [...cleaned, ...missing]
    }
    const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
        try { const raw = localStorage.getItem('journal.cols'); if (raw) return { ...defaultCols, ...JSON.parse(raw) } } catch { }
        return defaultCols
    })
    const [order, setOrder] = useState<ColKey[]>(() => {
        try { const raw = localStorage.getItem('journal.order'); if (raw) return sanitizeOrder(JSON.parse(raw)) } catch { }
        return defaultOrder
    })
    useEffect(() => { try { localStorage.setItem('journal.cols', JSON.stringify(cols)) } catch { } }, [cols])
    useEffect(() => { try { localStorage.setItem('journal.order', JSON.stringify(order)) } catch { } }, [order])

    // Preference: journal row limit
    const [journalLimit, setJournalLimit] = useState<number>(() => {
        try { return Number(localStorage.getItem('journal.limit') || '20') } catch { return 20 }
    })
    useEffect(() => { try { localStorage.setItem('journal.limit', String(journalLimit)) } catch { } }, [journalLimit])
    useEffect(() => { try { localStorage.setItem('journal.page', String(page)) } catch { } }, [page])
    useEffect(() => { try { localStorage.setItem('journal.sort', sortDir) } catch { } }, [sortDir])
    const [editRow, setEditRow] = useState<null | { id: number; date: string; description: string | null; paymentMethod: 'BAR' | 'BANK' | null; type?: 'IN' | 'OUT' | 'TRANSFER'; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; earmarkId?: number | null; tags?: string[] }>(null)
    const [deleteRow, setDeleteRow] = useState<null | { id: number; voucherNo: string }>(null)

    const searchInputRef = useRef<HTMLInputElement | null>(null)
    const [q, setQ] = useState<string>('')
    async function loadRecent() {
        const offset = Math.max(0, (page - 1)) * journalLimit
        const res = await window.api?.vouchers.list?.({
            limit: journalLimit,
            offset,
            sort: sortDir,
            paymentMethod: filterPM || undefined,
            sphere: filterSphere || undefined,
            type: filterType || undefined,
            from: from || undefined,
            to: to || undefined,
            earmarkId: filterEarmark || undefined,
            q: q || undefined,
            tag: filterTag || undefined
        })
        if (res) { setRows(res.rows); setTotalRows(res.total ?? 0) }
    }

    useEffect(() => { loadRecent() }, [])
    // Reload when page/limit/sort change
    useEffect(() => { loadRecent() }, [page, journalLimit, sortDir])

    // Global listener to react to data changes from nested components (e.g., import)
    useEffect(() => {
        function onDataChanged() { setRefreshKey((k) => k + 1); if (activePage === 'Buchungen') loadRecent() }
        window.addEventListener('data-changed', onDataChanged)
        return () => window.removeEventListener('data-changed', onDataChanged)
        // Intentionally only depend on activePage; loadRecent reads latest state when invoked
    }, [activePage])

    // Allow child components to trigger applying an earmark filter and jump to Buchungen
    useEffect(() => {
        function onApplyEarmark(e: Event) {
            const de = e as CustomEvent<{ earmarkId?: number }>
            setFilterEarmark(de.detail.earmarkId ?? null)
            setActivePage('Buchungen')
        }
        window.addEventListener('apply-earmark-filter', onApplyEarmark as any)
        return () => window.removeEventListener('apply-earmark-filter', onApplyEarmark as any)
    }, [])

    // Filters
    const [filterPM, setFilterPM] = useState<null | 'BAR' | 'BANK'>(null)
    const [filterSphere, setFilterSphere] = useState<null | 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'>(null)
    const [filterType, setFilterType] = useState<null | 'IN' | 'OUT' | 'TRANSFER'>(null)
    const [from, setFrom] = useState<string>('')
    const [to, setTo] = useState<string>('')
    const [filterEarmark, setFilterEarmark] = useState<number | null>(null)
    const [filterTag, setFilterTag] = useState<string | null>(null)
    // Debounced auto-apply filters
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); loadRecent() }, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterPM, filterSphere, filterType, from, to, filterEarmark, filterTag, sortDir, q])

    // Active earmarks for selection in forms (used in filters and forms)
    const [earmarks, setEarmarks] = useState<Array<{ id: number; code: string; name: string; color?: string | null }>>([])
    const [tagDefs, setTagDefs] = useState<Array<{ id: number; name: string; color?: string | null; usage?: number }>>([])
    async function loadEarmarks() {
        const res = await window.api?.bindings.list?.({ activeOnly: true })
        if (res) setEarmarks(res.rows.map(r => ({ id: r.id, code: r.code, name: r.name, color: (r as any).color })))
    }
    // Load active earmarks once for forms and filters
    useEffect(() => { loadEarmarks() }, [])
    useEffect(() => {
        let cancelled = false
        async function load() {
            const res = await window.api?.tags?.list?.({})
            if (!cancelled && res?.rows) setTagDefs(res.rows)
        }
        load()
        const onTagsChanged = () => load()
        window.addEventListener('tags-changed', onTagsChanged)
        return () => { cancelled = true; window.removeEventListener('tags-changed', onTagsChanged) }
    }, [])

    const activeChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; clear: () => void }> = []
        if (from) chips.push({ key: 'from', label: `von ${fmtDate(from)}`, clear: () => setFrom('') })
        if (to) chips.push({ key: 'to', label: `bis ${fmtDate(to)}`, clear: () => setTo('') })
        if (filterSphere) chips.push({ key: 'sphere', label: `Sphäre: ${filterSphere}`, clear: () => setFilterSphere(null) })
        if (filterType) chips.push({ key: 'type', label: `Art: ${filterType}`, clear: () => setFilterType(null) })
        if (filterPM) chips.push({ key: 'pm', label: `Zahlweg: ${filterPM}`, clear: () => setFilterPM(null) })
        if (filterEarmark) {
            const em = earmarks.find(e => e.id === filterEarmark)
            chips.push({ key: 'earmark', label: `Zweckbindung: ${em?.code ?? '#' + filterEarmark}`, clear: () => setFilterEarmark(null) })
        }
        if (filterTag) chips.push({ key: 'tag', label: `Tag: ${filterTag}`, clear: () => setFilterTag(null) })
        if (q) chips.push({ key: 'q', label: `Suche: ${q}`.slice(0, 40) + (q.length > 40 ? '…' : ''), clear: () => setQ('') })
        return chips
    }, [from, to, filterSphere, filterType, filterPM, filterEarmark, filterTag, earmarks, q, fmtDate])

    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

    // Zweckbindungen (Bindings) state
    const [bindings, setBindings] = useState<Array<{ id: number; code: string; name: string; description?: string | null; startDate?: string | null; endDate?: string | null; isActive: number; color?: string | null }>>([])
    const [editBinding, setEditBinding] = useState<null | { id?: number; code: string; name: string; description?: string | null; startDate?: string | null; endDate?: string | null; isActive?: boolean; color?: string | null }>(null)
    async function loadBindings() {
        const res = await window.api?.bindings.list?.({})
        if (res) setBindings(res.rows)
    }

    // Budgets state
    const [budgets, setBudgets] = useState<Array<{ id: number; year: number; sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; categoryId: number | null; projectId: number | null; earmarkId: number | null; amountPlanned: number }>>([])
    const [editBudget, setEditBudget] = useState<null | { id?: number; year: number; sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; categoryId?: number | null; projectId?: number | null; earmarkId?: number | null; amountPlanned: number }>(null)
    async function loadBudgets() {
        const res = await window.api?.budgets.list?.({})
        if (res) setBudgets(res.rows)
    }

    useEffect(() => {
        if (activePage === 'Zweckbindungen') loadBindings()
        if (activePage === 'Budgets') loadBudgets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePage])

    // (earmarks loaded above)

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `${sidebarCollapsed ? '64px' : '240px'} 1fr`, gridTemplateRows: '56px 1fr', gridTemplateAreas: '"top top" "side main"', height: '100%' }}>
            {/* Topbar */}
            <header style={{ gridArea: 'top', position: 'sticky', top: 0, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)', backdropFilter: 'var(--blur)', background: 'color-mix(in oklab, var(--surface) 80%, transparent)' }}>
                <strong style={{ fontSize: 18 }}>VereinO</strong>
                <div style={{ flex: 1 }} />
                {/* DOM-Debug toggle removed for release */}
            </header>

            {/* Sidebar */}
            <aside style={{ gridArea: 'side', borderRight: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
                    {!sidebarCollapsed && <strong>Menü</strong>}
                    <button className="btn" title={sidebarCollapsed ? 'Menü ausklappen' : 'Menü einklappen'} onClick={() => setSidebarCollapsed(v => !v)}>
                        {sidebarCollapsed ? '»' : '«'}
                    </button>
                </div>
                <nav style={{ display: 'grid', gap: 6 }}>
                    {[
                        {
                            key: 'Dashboard', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
                            )
                        },
                        {
                            key: 'Buchungen', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2z" /></svg>
                            )
                        },
                        {
                            key: 'Zweckbindungen', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3L1 9l11 6 9-4.91V17h2V9L12 3v4z" /></svg>
                            )
                        },
                        {
                            key: 'Budgets', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h18v2H3v-2zm0-7h18v6H3V10zm0-5h18v2H3V5z" /></svg>
                            )
                        },
                        {
                            key: 'Reports', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v2H3V3zm2 4h14v14H5V7zm2 2v10h10V9H7z" /></svg>
                            )
                        },
                        {
                            key: 'Belege', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8l-6-6zM8 12h8v2H8v-2zm0-4h5v2H8V8z" /></svg>
                            )
                        },
                        {
                            key: 'Einstellungen', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94a7.97 7.97 0 0 0 .06-1l2.03-1.58-1.92-3.32-2.39.5a7.97 7.97 0 0 0-1.73-1l-.36-2.43h-3.84l-.36 2.43a7.97 7.97 0 0 0-1.73 1l-2.39-.5-1.92 3.32L4.8 11.94c0 .34.02.67.06 1L2.83 14.5l1.92 3.32 2.39-.5c.53.4 1.12.74 1.73 1l.36 2.43h3.84l.36-2.43c.61-.26 1.2-.6 1.73-1l2.39.5 1.92-3.32-2.03-1.56zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" /></svg>
                            )
                        }
                    ].map(({ key, icon }) => (
                        <button key={key} className="btn ghost" onClick={() => setActivePage(key as any)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, background: activePage === (key as any) ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }} title={key}>
                            <span style={{ width: 22, display: 'inline-flex', justifyContent: 'center' }}>{icon}</span>
                            {!sidebarCollapsed && <span>{key}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main content */}
            <main style={{ gridArea: 'main', padding: 16 }}>
                <div className="container">
                    {activePage === 'Dashboard' && <h1>Dashboard</h1>}
                    {activePage === 'Buchungen' && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <h1 style={{ margin: 0 }}>Buchungen</h1>
                            <input ref={searchInputRef} className="input" placeholder="Suche Buchungen (Ctrl+K)" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: 8, width: 340 }} />
                        </div>
                    )}
                    {activePage === 'Reports' && <h1>Reports</h1>}
                    {activePage === 'Zweckbindungen' && <h1>Zweckbindungen</h1>}
                    {activePage === 'Budgets' && <h1>Budgets</h1>}
                    {activePage === 'Dashboard' && (
                        <DashboardView today={today} />
                    )}
                    {activePage === 'Buchungen' && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>Zeit:</span>
                            <button className="btn" title="Zeitraum/Jahr wählen" onClick={() => setShowTimeFilter(true)}>
                                {/* clock icon */}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1Zm0 20a9 9 0 1 1 9-9 9.01 9.01 0 0 1-9 9Zm.5-14h-2v6l5.2 3.12 1-1.64-4.2-2.48Z" /></svg>
                            </button>
                            <span style={{ color: 'var(--text-dim)' }}>Sphäre:</span>
                            <select className="input" value={filterSphere ?? ''} onChange={(e) => setFilterSphere((e.target.value as any) || null)}>
                                <option value="">Alle</option>
                                <option value="IDEELL">IDEELL</option>
                                <option value="ZWECK">ZWECK</option>
                                <option value="VERMOEGEN">VERMOEGEN</option>
                                <option value="WGB">WGB</option>
                            </select>
                            <span style={{ color: 'var(--text-dim)' }}>Zweckbindung:</span>
                            <select className="input" value={filterEarmark ?? ''} onChange={(e) => setFilterEarmark(e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Alle</option>
                                {earmarks.map(em => (
                                    <option key={em.id} value={em.id}>{em.code}</option>
                                ))}
                            </select>
                            <span style={{ color: 'var(--text-dim)' }}>Art:</span>
                            <select className="input" value={filterType ?? ''} onChange={(e) => setFilterType((e.target.value as any) || null)}>
                                <option value="">Alle</option>
                                <option value="IN">IN</option>
                                <option value="OUT">OUT</option>
                                <option value="TRANSFER">TRANSFER</option>
                            </select>
                            <span style={{ color: 'var(--text-dim)' }}>Zahlweg:</span>
                            <select className="input" value={filterPM ?? ''} onChange={(e) => { const v = e.target.value as any; setFilterPM(v || null); }}>
                                <option value="">Alle</option>
                                <option value="BAR">Bar</option>
                                <option value="BANK">Bank</option>
                            </select>
                            <span style={{ color: 'var(--text-dim)' }}>Tag:</span>
                            <select className="input" value={filterTag ?? ''} onChange={(e) => setFilterTag(e.target.value || null)}>
                                <option value="">Alle</option>
                                {tagDefs.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                            <button className="btn" onClick={() => loadRecent()}>Aktualisieren</button>
                        </div>
                    )}
                    {activePage === 'Reports' && (
                        <div className="card" style={{ padding: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Zeitraum:</span>
                                    <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                                    <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                                    <span style={{ color: 'var(--text-dim)' }}>Jahr:</span>
                                    {/* dynamic years from vouchers */}
                                    <select className="input" value={(() => {
                                        if (!from || !to) return ''
                                        const fy = from.slice(0, 4)
                                        const ty = to.slice(0, 4)
                                        // full-year only when matching boundaries
                                        if (from === `${fy}-01-01` && to === `${fy}-12-31` && fy === ty) return fy
                                        return ''
                                    })()} onChange={(e) => {
                                        const y = e.target.value
                                        if (!y) { setFrom(''); setTo(''); return }
                                        const yr = Number(y)
                                        const f = new Date(Date.UTC(yr, 0, 1)).toISOString().slice(0, 10)
                                        const t = new Date(Date.UTC(yr, 11, 31)).toISOString().slice(0, 10)
                                        setFrom(f); setTo(t)
                                    }}>
                                        <option value="">Alle</option>
                                        {yearsAvail.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                                    </select>
                                    <div className="inline-field">
                                        <span style={{ color: 'var(--text-dim)' }}>Sphäre:</span>
                                        <select className="input" value={filterSphere ?? ''} onChange={(e) => setFilterSphere((e.target.value as any) || null)}>
                                            <option value="">Alle</option>
                                            <option value="IDEELL">IDEELL</option>
                                            <option value="ZWECK">ZWECK</option>
                                            <option value="VERMOEGEN">VERMOEGEN</option>
                                            <option value="WGB">WGB</option>
                                        </select>
                                    </div>
                                    <span style={{ color: 'var(--text-dim)' }}>Art:</span>
                                    <select className="input" value={filterType ?? ''} onChange={(e) => setFilterType((e.target.value as any) || null)}>
                                        <option value="">Alle</option>
                                        <option value="IN">IN</option>
                                        <option value="OUT">OUT</option>
                                        <option value="TRANSFER">TRANSFER</option>
                                    </select>
                                    <span style={{ color: 'var(--text-dim)' }}>Zahlweg:</span>
                                    <select className="input" value={filterPM ?? ''} onChange={(e) => { const v = e.target.value as any; setFilterPM(v || null); }}>
                                        <option value="">Alle</option>
                                        <option value="BAR">Bar</option>
                                        <option value="BANK">Bank</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button className="btn" onClick={async () => {
                                        const res = await window.api?.reports.export?.({ type: 'JOURNAL', format: 'CSV', from: from || '', to: to || '', filters: { paymentMethod: filterPM || undefined, sphere: filterSphere || undefined, type: filterType || undefined } })
                                        if (res) notify('success', `CSV exportiert: ${res.filePath}`)
                                    }}>Export CSV</button>
                                    <button className="btn" onClick={async () => {
                                        const res = await window.api?.reports.export?.({ type: 'JOURNAL', format: 'XLSX', from: from || '', to: to || '', filters: { paymentMethod: filterPM || undefined, sphere: filterSphere || undefined, type: filterType || undefined } })
                                        if (res) notify('success', `XLSX exportiert: ${res.filePath}`)
                                    }}>Export XLSX</button>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn ghost" onClick={() => setReportsTab('overview')} style={{ background: reportsTab === 'overview' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Übersicht</button>
                                        <button className="btn ghost" onClick={() => setReportsTab('monthly')} style={{ background: reportsTab === 'monthly' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Monatsverlauf</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activePage === 'Reports' && reportsTab === 'overview' && (
                        <>
                            <ReportsSummary refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <ReportsSphereBars refreshKey={refreshKey} from={from || undefined} to={to || undefined} />
                                <ReportsCashBars refreshKey={refreshKey} from={from || undefined} to={to || undefined} />
                            </div>
                        </>
                    )}
                    {activePage === 'Reports' && reportsTab === 'monthly' && (
                        <>
                            <ReportsMonthlyChart refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
                            <ReportsInOutLines refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} />
                        </>
                    )}

                    {activePage === 'Buchungen' && activeChips.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 8px' }}>
                            {activeChips.map((c) => (
                                <span key={c.key} className="chip">
                                    {c.label}
                                    <button className="chip-x" onClick={c.clear} aria-label={`Filter ${c.key} löschen`}>×</button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Status card removed; replaced by toasts */}

                    {/* Heading removed per request */}
                    {activePage === 'Buchungen' && (
                        <FilterTotals refreshKey={refreshKey} from={from || undefined} to={to || undefined} paymentMethod={filterPM || undefined} sphere={filterSphere || undefined} type={filterType || undefined} earmarkId={filterEarmark || undefined} />
                    )}
                    {activePage === 'Buchungen' && (
                        <div>
                            <div className="card">
                                {/* Pagination controls */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                    <div className="helper">Seite {page} von {Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} — {totalRows} Einträge</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn" onClick={() => { setPage(1) }} disabled={page <= 1} style={page <= 1 ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>⏮</button>
                                        <button className="btn" onClick={() => { setPage(p => Math.max(1, p - 1)) }} disabled={page <= 1} style={page <= 1 ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>‹ Zurück</button>
                                        <button className="btn" onClick={() => { const maxP = Math.max(1, Math.ceil((totalRows || 0) / journalLimit)); setPage(p => Math.min(maxP, p + 1)) }} disabled={page >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} style={page >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit)) ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>Weiter ›</button>
                                        <button className="btn" onClick={() => { const maxP = Math.max(1, Math.ceil((totalRows || 0) / journalLimit)); setPage(maxP) }} disabled={page >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} style={page >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit)) ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>⏭</button>
                                    </div>
                                </div>
                                <JournalTable
                                    rows={rows}
                                    order={order}
                                    cols={cols}
                                    onReorder={(o: any) => setOrder(o as any)}
                                    earmarks={earmarks}
                                    tagDefs={tagDefs}
                                    eurFmt={eurFmt}
                                    fmtDate={fmtDate}
                                    onEdit={(r) => setEditRow(r)}
                                    onDelete={(r) => setDeleteRow(r)}
                                    onToggleSort={() => { setSortDir(prev => prev === 'DESC' ? 'ASC' : 'DESC'); setPage(1) }}
                                    sortDir={sortDir}
                                    onTagClick={async (name) => {
                                        setFilterTag(name)
                                        setActivePage('Buchungen')
                                        setPage(1)
                                        await loadRecent()
                                    }}
                                />
                            </div>
                            {/* Edit Modal */}
                            {editRow && (
                                <div className="modal-overlay" onClick={() => setEditRow(null)}>
                                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <h2 style={{ margin: 0 }}>Buchung bearbeiten</h2>
                                            <button className="btn danger" onClick={() => setEditRow(null)}>Schließen</button>
                                        </header>
                                        <div className="row">
                                            <div className="field">
                                                <label>Datum</label>
                                                <input className="input" type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} />
                                            </div>
                                            <div className="field">
                                                <label>Art</label>
                                                <select className="input" value={editRow.type ?? ''} onChange={(e) => setEditRow({ ...editRow, type: (e.target.value as any) || undefined })}>
                                                    <option value="">—</option>
                                                    <option value="IN">IN</option>
                                                    <option value="OUT">OUT</option>
                                                    <option value="TRANSFER">TRANSFER</option>
                                                </select>
                                            </div>
                                            <div className="field">
                                                <label>Sphäre</label>
                                                <select className="input" value={editRow.sphere ?? ''} onChange={(e) => setEditRow({ ...editRow, sphere: (e.target.value as any) || undefined })}>
                                                    <option value="">—</option>
                                                    <option value="IDEELL">IDEELL</option>
                                                    <option value="ZWECK">ZWECK</option>
                                                    <option value="VERMOEGEN">VERMOEGEN</option>
                                                    <option value="WGB">WGB</option>
                                                </select>
                                            </div>
                                            <div className="field">
                                                <label>Zahlweg</label>
                                                <select className="input" value={editRow.paymentMethod ?? ''} onChange={(e) => setEditRow({ ...editRow, paymentMethod: (e.target.value as any) || null })}>
                                                    <option value="">—</option>
                                                    <option value="BAR">Bar</option>
                                                    <option value="BANK">Bank</option>
                                                </select>
                                            </div>
                                            <div className="field">
                                                <label>Zweckbindung</label>
                                                <select className="input" value={(editRow.earmarkId ?? '') as any} onChange={(e) => setEditRow({ ...editRow, earmarkId: e.target.value ? Number(e.target.value) : null })}>
                                                    <option value="">—</option>
                                                    {earmarks.map(em => (
                                                        <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="field" style={{ gridColumn: '1 / span 2' }}>
                                                <label>Beschreibung</label>
                                                <input className="input" value={editRow.description ?? ''} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} />
                                            </div>
                                            <TagsEditor
                                                label="Tags"
                                                value={editRow.tags || []}
                                                onChange={(tags) => setEditRow({ ...editRow, tags })}
                                                tagDefs={tagDefs}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                            <button className="btn" onClick={() => setEditRow(null)}>Abbrechen</button>
                                            <button className="btn primary" onClick={async () => { await window.api?.vouchers.update?.({ id: editRow.id, date: editRow.date, description: editRow.description ?? null, paymentMethod: editRow.paymentMethod ?? null, type: editRow.type, sphere: editRow.sphere, earmarkId: editRow.earmarkId, tags: editRow.tags || [] }); setEditRow(null); await loadRecent(); bumpDataVersion() }}>Speichern</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delete Modal */}
                            {deleteRow && (
                                <div className="modal-overlay" onClick={() => setDeleteRow(null)}>
                                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <h2 style={{ margin: 0 }}>Buchung löschen</h2>
                                            <button className="btn danger" onClick={() => setDeleteRow(null)}>Schließen</button>
                                        </header>
                                        <p>Möchtest du die Buchung <strong>#{deleteRow.voucherNo}</strong> wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                            <button className="btn" onClick={() => setDeleteRow(null)}>Abbrechen</button>
                                            <button className="btn danger" onClick={async () => { await window.api?.vouchers.delete?.({ id: deleteRow.id }); setDeleteRow(null); await loadRecent(); bumpDataVersion() }}>Ja, löschen</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activePage === 'Einstellungen' && (
                        <SettingsView
                            defaultCols={defaultCols}
                            defaultOrder={defaultOrder}
                            cols={cols}
                            setCols={setCols}
                            order={order}
                            setOrder={(o: string[]) => setOrder(o as any)}
                            journalLimit={journalLimit}
                            setJournalLimit={(n: number) => { setJournalLimit(n); setPage(1) }}
                            dateFmt={dateFmt}
                            setDateFmt={setDateFmt}
                            tagDefs={tagDefs}
                            setTagDefs={setTagDefs}
                            notify={notify}
                            bumpDataVersion={bumpDataVersion}
                            openTagsManager={() => setShowTagsManager(true)}
                        />
                    )}

                    {activePage === 'Belege' && (
                        <ReceiptsView />
                    )}

                    {activePage === 'Zweckbindungen' && (
                        <>
                            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="helper">Zweckbindungen verwalten</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn" onClick={loadBindings}>Aktualisieren</button>
                                        <button
                                            className="btn primary"
                                            onClick={() => setEditBinding({ code: '', name: '', description: null, startDate: null, endDate: null, isActive: true, color: null } as any)}
                                        >+ Neu</button>
                                    </div>
                                </div>
                                <table cellPadding={6} style={{ marginTop: 8, width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th align="left">Code</th>
                                            <th align="left">Name</th>
                                            <th align="left">Zeitraum</th>
                                            <th align="left">Status</th>
                                            <th align="left">Farbe</th>
                                            <th align="center">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bindings.map(b => (
                                            <tr key={b.id}>
                                                <td>{b.code}</td>
                                                <td>{b.name}</td>
                                                <td>{(b.startDate ?? '—')} – {(b.endDate ?? '—')}</td>
                                                <td>{b.isActive ? 'aktiv' : 'inaktiv'}</td>
                                                <td>
                                                    {b.color ? (
                                                        <span title={b.color} style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: b.color, verticalAlign: 'middle' }} />
                                                    ) : '—'}
                                                </td>
                                                <td align="center" style={{ whiteSpace: 'nowrap' }}>
                                                    <button className="btn" onClick={() => setEditBinding({ id: b.id, code: b.code, name: b.name, description: b.description ?? null, startDate: b.startDate ?? null, endDate: b.endDate ?? null, isActive: !!b.isActive, color: b.color ?? null })}>✎</button>
                                                    <button className="btn" onClick={async () => {
                                                        if (!confirm('Zweckbindung wirklich löschen?')) return
                                                        try {
                                                            await window.api?.bindings.delete?.({ id: b.id })
                                                            notify('success', 'Zweckbindung gelöscht')
                                                            await loadBindings()
                                                            await loadEarmarks()
                                                        } catch (e: any) {
                                                            notify('error', e?.message || String(e))
                                                        }
                                                    }}>🗑</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {bindings.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Keine Zweckbindungen vorhanden.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {editBinding && (
                                    <BindingModal
                                        value={editBinding}
                                        onClose={() => setEditBinding(null)}
                                        onSaved={async () => { notify('success', 'Zweckbindung gespeichert'); await loadBindings(); await loadEarmarks() }}
                                    />
                                )}
                            </div>

                            <EarmarkUsageCards
                                bindings={bindings}
                                from={from || undefined}
                                to={to || undefined}
                                sphere={filterSphere || undefined}
                            />
                        </>
                    )}

                    {activePage === 'Budgets' && (
                        <div className="card" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="helper">Jahresbudgets je Sphäre/Kategorie/Projekt/Zweckbindung</div>
                                <button className="btn primary" onClick={() => setEditBudget({ year: new Date().getFullYear(), sphere: 'IDEELL', amountPlanned: 0, categoryId: null, projectId: null, earmarkId: null })}>+ Neu</button>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <button className="btn" onClick={loadBudgets}>Aktualisieren</button>
                            </div>
                            <table cellPadding={6} style={{ marginTop: 8, width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th align="left">Jahr</th>
                                        <th align="left">Sphäre</th>
                                        <th align="left">Kategorie</th>
                                        <th align="left">Projekt</th>
                                        <th align="left">Zweckbindung</th>
                                        <th align="right">Budget</th>
                                        <th align="center">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgets.map(b => (
                                        <tr key={b.id}>
                                            <td>{b.year}</td>
                                            <td>{b.sphere}</td>
                                            <td>{b.categoryId ?? '—'}</td>
                                            <td>{b.projectId ?? '—'}</td>
                                            <td>{b.earmarkId ?? '—'}</td>
                                            <td align="right">{eurFmt.format(b.amountPlanned)}</td>
                                            <td align="center" style={{ whiteSpace: 'nowrap' }}>
                                                <button className="btn" onClick={() => setEditBudget({ id: b.id, year: b.year, sphere: b.sphere, categoryId: b.categoryId, projectId: b.projectId, earmarkId: b.earmarkId, amountPlanned: b.amountPlanned })}>✎</button>
                                                <button className="btn" onClick={async () => { await window.api?.budgets.delete?.({ id: b.id }); notify('success', 'Budget gelöscht'); await loadBudgets() }}>🗑</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {editBudget && (
                                <BudgetModal
                                    value={editBudget}
                                    onClose={() => setEditBudget(null)}
                                    onSaved={async () => { notify('success', 'Budget gespeichert'); await loadBudgets() }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Quick-Add Modal */}
            {quickAdd && (
                <div className="modal-overlay" onClick={() => setQuickAdd(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <h2 style={{ margin: 0 }}>+ Buchung</h2>
                            <button className="btn danger" onClick={() => { setQuickAdd(false); setFiles([]) }}>Schließen</button>
                        </header>
                        <form onSubmit={(e) => { e.preventDefault(); onQuickSave(); }}>
                            <div className="row">
                                <div className="field">
                                    <label>Datum</label>
                                    <input className="input" type="date" value={qa.date} onChange={(e) => setQa({ ...qa, date: e.target.value })} required />
                                </div>
                                <div className="field">
                                    <label>Art</label>
                                    <select value={qa.type} onChange={(e) => setQa({ ...qa, type: e.target.value as any })}>
                                        <option value="IN">IN</option>
                                        <option value="OUT">OUT</option>
                                        <option value="TRANSFER">TRANSFER</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Sphäre</label>
                                    <select value={qa.sphere} onChange={(e) => setQa({ ...qa, sphere: e.target.value as any })}>
                                        <option value="IDEELL">IDEELL</option>
                                        <option value="ZWECK">ZWECK</option>
                                        <option value="VERMOEGEN">VERMOEGEN</option>
                                        <option value="WGB">WGB</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Zahlweg</label>
                                    <select value={(qa as any).paymentMethod ?? 'BAR'} onChange={(e) => setQa({ ...qa, paymentMethod: e.target.value as any })}>
                                        <option value="BAR">Bar</option>
                                        <option value="BANK">Bank</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Zweckbindung</label>
                                    <select value={(qa as any).earmarkId ?? ''} onChange={(e) => setQa({ ...qa, earmarkId: e.target.value ? Number(e.target.value) : null } as any)}>
                                        <option value="">—</option>
                                        {earmarks.map(em => (
                                            <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>{(qa as any).mode === 'GROSS' ? 'Brutto' : 'Netto'}</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select className="input" value={(qa as any).mode ?? 'NET'} onChange={(e) => setQa({ ...qa, mode: e.target.value as any })}>
                                            <option value="NET">Netto</option>
                                            <option value="GROSS">Brutto</option>
                                        </select>
                                        <span className="adorn-wrap">
                                            <input className="input" type="number" step="0.01" value={(qa as any).mode === 'GROSS' ? (qa as any).grossAmount ?? '' : qa.netAmount}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value)
                                                    if ((qa as any).mode === 'GROSS') setQa({ ...qa, grossAmount: v })
                                                    else setQa({ ...qa, netAmount: v })
                                                }} />
                                            <span className="adorn-suffix">€</span>
                                        </span>
                                    </div>
                                    <div className="helper">{(qa as any).mode === 'GROSS' ? 'Bei Brutto wird USt/Netto nicht berechnet' : 'USt wird automatisch berechnet'}</div>
                                </div>
                                {(qa as any).mode === 'NET' && (
                                    <div className="field">
                                        <label>USt %</label>
                                        <input className="input" type="number" step="0.1" value={qa.vatRate} onChange={(e) => setQa({ ...qa, vatRate: Number(e.target.value) })} />
                                    </div>
                                )}
                                <div className="field">
                                    <label>Beschreibung</label>
                                    <input className="input" value={qa.description} onChange={(e) => setQa({ ...qa, description: e.target.value })} />
                                </div>
                                <TagsEditor
                                    label="Tags"
                                    value={(qa as any).tags || []}
                                    onChange={(tags) => setQa({ ...(qa as any), tags } as any)}
                                    tagDefs={tagDefs}
                                />
                            </div>
                            {/* Attachments */}
                            <div
                                className="card"
                                style={{ marginTop: 8, padding: 12 }}
                                onDragOver={(e) => { if (quickAdd) { e.preventDefault(); e.stopPropagation() } }}
                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (quickAdd) onDropFiles(e.dataTransfer?.files) }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                        <strong>Anhänge</strong>
                                        <div className="helper">Dateien hierher ziehen oder per Button/Ctrl+U auswählen</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => onDropFiles(e.target.files)} />
                                        <button type="button" className="btn" onClick={openFilePicker}>+ Datei(en)</button>
                                        {files.length > 0 && (
                                            <button type="button" className="btn" onClick={() => setFiles([])}>Leeren</button>
                                        )}
                                    </div>
                                </div>
                                {files.length > 0 && (
                                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                                        {files.map((f, i) => (
                                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                <button type="button" className="btn" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>Entfernen</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button type="button" className="btn" onClick={() => { setQuickAdd(false); setFiles([]) }}>Abbrechen</button>
                                <button type="submit" className="btn primary">Speichern (Ctrl+S)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Toasts bottom-right */}
            <div className="toast-container" aria-live="polite" aria-atomic="true">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type}`} role="status">
                        <span className="title">{t.type === 'error' ? 'Fehler' : t.type === 'success' ? 'OK' : 'Info'}</span>
                        <span>{t.text}</span>
                    </div>
                ))}
            </div>
            {/* Global Floating Action Button: + Buchung */}
            <button className="fab fab-buchung" onClick={() => setQuickAdd(true)} title="+ Buchung">+ Buchung</button>
            {/* Time Filter Modal for Buchungen */}
            <TimeFilterModal
                open={activePage === 'Buchungen' && showTimeFilter}
                onClose={() => setShowTimeFilter(false)}
                yearsAvail={yearsAvail}
                from={from}
                to={to}
                onApply={({ from: nf, to: nt }) => { setFrom(nf); setTo(nt) }}
            />
            {/* Global DOM debugger overlay */}
            {/* DomDebugger removed for release */}
            {/* Global Tags Manager Modal */}
            {showTagsManager && (
                <TagsManagerModal
                    onClose={() => setShowTagsManager(false)}
                    notify={notify}
                    onChanged={() => { setShowTagsManager(false); setShowTagsManager(true); /* simple reload of list */ }}
                />
            )}
        </div>
    )
}

// Time Filter Modal: controls date range and quick year selection
function TimeFilterModal({ open, onClose, yearsAvail, from, to, onApply }: {
    open: boolean
    onClose: () => void
    yearsAvail: number[]
    from: string
    to: string
    onApply: (v: { from: string; to: string }) => void
}) {
    const [f, setF] = useState<string>(from)
    const [t, setT] = useState<string>(to)
    useEffect(() => { setF(from); setT(to) }, [from, to, open])
    return open ? (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>Zeitraum wählen</h2>
                    <button className="btn danger" onClick={onClose}>Schließen</button>
                </header>
                <div className="row">
                    <div className="field">
                        <label>Von</label>
                        <input className="input" type="date" value={f} onChange={(e) => setF(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Bis</label>
                        <input className="input" type="date" value={t} onChange={(e) => setT(e.target.value)} />
                    </div>
                    <div className="field" style={{ gridColumn: '1 / span 2' }}>
                        <label>Schnellauswahl Jahr</label>
                        <select className="input" value={(() => {
                            if (!f || !t) return ''
                            const fy = f.slice(0, 4)
                            const ty = t.slice(0, 4)
                            if (f === `${fy}-01-01` && t === `${fy}-12-31` && fy === ty) return fy
                            return ''
                        })()} onChange={(e) => {
                            const y = e.target.value
                            if (!y) { setF(''); setT(''); return }
                            const yr = Number(y)
                            const nf = new Date(Date.UTC(yr, 0, 1)).toISOString().slice(0, 10)
                            const nt = new Date(Date.UTC(yr, 11, 31)).toISOString().slice(0, 10)
                            setF(nf); setT(nt)
                        }}>
                            <option value="">—</option>
                            {yearsAvail.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <button className="btn" onClick={() => { setF(''); setT('') }}>Zurücksetzen</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={onClose}>Abbrechen</button>
                        <button className="btn primary" onClick={() => { onApply({ from: f, to: t }); onClose() }}>Übernehmen</button>
                    </div>
                </div>
            </div>
        </div>
    ) : null
}
function DashboardView({ today }: { today: string }) {
    const [quote, setQuote] = useState<{ text: string; author?: string; source?: string } | null>(null)
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        window.api?.quotes.weekly?.({ date: today }).then((q) => { if (!cancelled) setQuote(q) }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [today])

    // Load available years for optional selection
    const [yearsAvail, setYearsAvail] = useState<number[]>([])
    useEffect(() => {
        let cancelled = false
        window.api?.reports.years?.().then(res => { if (!cancelled && res?.years) setYearsAvail(res.years) })
        const onChanged = () => { window.api?.reports.years?.().then(res => { if (!cancelled && res?.years) setYearsAvail(res.years) }) }
        window.addEventListener('data-changed', onChanged)
        return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
    }, [])
    // KPIs with Month/Year toggle
    const [period, setPeriod] = useState<'MONAT' | 'JAHR'>(() => {
        try { return (localStorage.getItem('dashPeriod') as any) || 'MONAT' } catch { return 'MONAT' }
    })
    useEffect(() => { try { localStorage.setItem('dashPeriod', period) } catch { } }, [period])
    const [yearSel, setYearSel] = useState<number | null>(null)
    useEffect(() => {
        if (period === 'JAHR' && yearsAvail.length > 0 && (yearSel == null || !yearsAvail.includes(yearSel))) {
            setYearSel(yearsAvail[0])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [yearsAvail, period])
    const [sum, setSum] = useState<null | { inGross: number; outGross: number; diff: number }>(null)
    // React to global data changes (e.g., new voucher)
    const [refreshKey, setRefreshKey] = useState(0)
    useEffect(() => {
        const onDataChanged = () => setRefreshKey((k) => k + 1)
        window.addEventListener('data-changed', onDataChanged)
        return () => window.removeEventListener('data-changed', onDataChanged)
    }, [])
    useEffect(() => {
        let cancelled = false
        const now = new Date()
        const y = (period === 'JAHR' && yearSel) ? yearSel : now.getUTCFullYear()
        const from = period === 'MONAT'
            ? new Date(Date.UTC(y, now.getUTCMonth(), 1)).toISOString().slice(0, 10)
            : new Date(Date.UTC(y, 0, 1)).toISOString().slice(0, 10)
        const to = period === 'MONAT'
            ? new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
            : new Date(Date.UTC(y, 11, 31)).toISOString().slice(0, 10)
        window.api?.reports.summary?.({ from, to }).then(res => {
            if (cancelled || !res) return
            const inGross = res.byType.find(x => x.key === 'IN')?.gross || 0
            const outGrossRaw = res.byType.find(x => x.key === 'OUT')?.gross || 0
            const outGross = Math.abs(outGrossRaw)
            const diff = Math.round((inGross - outGross) * 100) / 100
            setSum({ inGross, outGross, diff })
        })
        return () => { cancelled = true }
    }, [period, refreshKey])
    const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

    return (
        <div className="card" style={{ padding: 12, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>Hallo Merle</div>
                    <div className="helper">Willkommen zurück – hier ist dein Überblick.</div>
                </div>
                <div style={{ textAlign: 'right', maxWidth: 520 }}>
                    <div className="helper">Satz der Woche</div>
                    <div style={{ fontStyle: 'italic' }}>{loading ? '…' : (quote?.text || '—')}</div>
                    <div className="helper">{quote?.author || quote?.source || ''}</div>
                </div>
            </div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                    <div className="btn-group" role="tablist" aria-label="Zeitraum">
                        <button className="btn ghost" onClick={() => setPeriod('MONAT')} style={{ background: period === 'MONAT' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Monat</button>
                        <button className="btn ghost" onClick={() => setPeriod('JAHR')} style={{ background: period === 'JAHR' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Jahr</button>
                    </div>
                    {period === 'JAHR' && yearsAvail.length > 1 && (
                        <select className="input" value={String((yearSel ?? yearsAvail[0]))} onChange={(e) => setYearSel(Number(e.target.value))}>
                            {yearsAvail.map((y) => (
                                <option key={y} value={String(y)}>{y}</option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="card" style={{ padding: 12 }}>
                    <div className="helper">Einnahmen ({period === 'MONAT' ? 'Monat' : 'Jahr'})</div>
                    <div style={{ fontWeight: 600 }}>{eur.format(sum?.inGross || 0)}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                    <div className="helper">Ausgaben ({period === 'MONAT' ? 'Monat' : 'Jahr'})</div>
                    <div style={{ fontWeight: 600 }}>{eur.format(sum?.outGross || 0)}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                    <div className="helper">Saldo ({period === 'MONAT' ? 'Monat' : 'Jahr'})</div>
                    <div style={{ fontWeight: 600, color: (sum && sum.diff >= 0) ? 'var(--success)' : 'var(--danger)' }}>{eur.format(sum?.diff || 0)}</div>
                </div>
            </div>
            {/* Charts preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(() => {
                    const now = new Date()
                    const y = (period === 'JAHR' && yearSel) ? yearSel : now.getUTCFullYear()
                    const f = period === 'MONAT'
                        ? new Date(Date.UTC(y, now.getUTCMonth(), 1)).toISOString().slice(0, 10)
                        : new Date(Date.UTC(y, 0, 1)).toISOString().slice(0, 10)
                    const t = period === 'MONAT'
                        ? new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
                        : new Date(Date.UTC(y, 11, 31)).toISOString().slice(0, 10)
                    return (
                        <>
                            <ReportsMonthlyChart from={f} to={t} />
                            <ReportsCashBars from={f} to={t} />
                        </>
                    )
                })()}
            </div>
            {/* Earmarks at a glance: top active ones */}
            <DashboardEarmarksPeek />
        </div>
    )
}

function DashboardEarmarksPeek() {
    const [bindings, setBindings] = useState<Array<{ id: number; code: string; name: string; color?: string | null }>>([])
    const [usage, setUsage] = useState<Record<number, { balance: number }>>({})
    const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    useEffect(() => {
        (async () => {
            const res = await window.api?.bindings.list?.({ activeOnly: true })
            const rows = res?.rows?.slice(0, 6) || []
            setBindings(rows)
            const u: Record<number, { balance: number }> = {}
            for (const b of rows) {
                const r = await window.api?.bindings.usage?.({ earmarkId: b.id })
                if (r) u[b.id] = { balance: r.balance }
            }
            setUsage(u)
        })()
    }, [])
    if (!bindings.length) return null
    return (
        <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>Zweckbindungen (Auszug)</strong>
                <button className="btn ghost" onClick={() => { const ev = new CustomEvent('apply-earmark-filter', { detail: { earmarkId: null } }); window.dispatchEvent(ev); }}>Zu Buchungen</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 8 }}>
                {bindings.map(b => {
                    const bg = b.color || undefined
                    const fg = contrastText(bg)
                    return (
                        <div key={b.id} className="card" style={{ padding: 10, borderTop: bg ? `4px solid ${bg}` : undefined }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span className="badge" style={{ background: bg, color: fg }}>{b.code}</span>
                                <span className="helper">{b.name}</span>
                            </div>
                            <div style={{ marginTop: 6 }}>Saldo: {eur.format(usage[b.id]?.balance || 0)}</div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Binding Modal
function BindingModal({ value, onClose, onSaved }: { value: { id?: number; code: string; name: string; description?: string | null; startDate?: string | null; endDate?: string | null; isActive?: boolean; color?: string | null }; onClose: () => void; onSaved: () => void }) {
    const [v, setV] = useState(value)
    return createPortal(
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>{v.id ? 'Zweckbindung bearbeiten' : 'Zweckbindung anlegen'}</h2>
                    <button className="btn danger" onClick={onClose}>Schließen</button>
                </header>
                <div className="row">
                    <div className="field">
                        <label>Code</label>
                        <input className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Name</label>
                        <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
                    </div>
                    <div className="field" style={{ gridColumn: '1 / span 2' }}>
                        <label>Beschreibung</label>
                        <input className="input" value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Von</label>
                        <input className="input" type="date" value={v.startDate ?? ''} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} />
                    </div>
                    <div className="field">
                        <label>Bis</label>
                        <input className="input" type="date" value={v.endDate ?? ''} onChange={(e) => setV({ ...v, endDate: e.target.value || null })} />
                    </div>
                    <div className="field">
                        <label>Status</label>
                        <select className="input" value={(v.isActive ?? true) ? '1' : '0'} onChange={(e) => setV({ ...v, isActive: e.target.value === '1' })}>
                            <option value="1">aktiv</option>
                            <option value="0">inaktiv</option>
                        </select>
                    </div>
                    <div className="field" style={{ gridColumn: '1 / span 2' }}>
                        <label>Farbe</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {EARMARK_PALETTE.map((c) => (
                                <button key={c} type="button" className="btn" onClick={() => setV({ ...v, color: c })} title={c} style={{ padding: 0, width: 28, height: 28, borderRadius: 6, border: v.color === c ? '2px solid var(--text)' : '2px solid transparent', background: c }}>
                                    <span aria-hidden="true" />
                                </button>
                            ))}
                            <button type="button" className="btn" onClick={() => setV({ ...v, color: null })} title="Keine Farbe" style={{ height: 28 }}>Keine</button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button className="btn" onClick={onClose}>Abbrechen</button>
                    <button className="btn primary" onClick={async () => { await window.api?.bindings.upsert?.(v as any); onSaved(); onClose() }}>Speichern</button>
                </div>
            </div>
        </div>,
        document.body
    )
}

// Budget Modal
function BudgetModal({ value, onClose, onSaved }: { value: { id?: number; year: number; sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; categoryId?: number | null; projectId?: number | null; earmarkId?: number | null; amountPlanned: number }; onClose: () => void; onSaved: () => void }) {
    const [v, setV] = useState(value)
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>{v.id ? 'Budget bearbeiten' : 'Budget anlegen'}</h2>
                    <button className="btn danger" onClick={onClose}>Schließen</button>
                </header>
                <div className="row">
                    <div className="field">
                        <label>Jahr</label>
                        <input className="input" type="number" value={v.year} onChange={(e) => setV({ ...v, year: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                        <label>Sphäre</label>
                        <select className="input" value={v.sphere} onChange={(e) => setV({ ...v, sphere: e.target.value as any })}>
                            <option value="IDEELL">IDEELL</option>
                            <option value="ZWECK">ZWECK</option>
                            <option value="VERMOEGEN">VERMOEGEN</option>
                            <option value="WGB">WGB</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>Budget</label>
                        <input className="input" type="number" step="0.01" value={v.amountPlanned} onChange={(e) => setV({ ...v, amountPlanned: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                        <label>Kategorie-ID</label>
                        <input className="input" type="number" value={v.categoryId ?? ''} onChange={(e) => setV({ ...v, categoryId: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="field">
                        <label>Projekt-ID</label>
                        <input className="input" type="number" value={v.projectId ?? ''} onChange={(e) => setV({ ...v, projectId: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="field">
                        <label>Zweckbindung-ID</label>
                        <input className="input" type="number" value={v.earmarkId ?? ''} onChange={(e) => setV({ ...v, earmarkId: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button className="btn" onClick={onClose}>Abbrechen</button>
                    <button className="btn primary" onClick={async () => { await window.api?.budgets.upsert?.(v as any); onSaved(); onClose() }}>Speichern</button>
                </div>
            </div>
        </div>
    )
}

// Quick-Add state and logic
type QA = {
    date: string
    type: 'IN' | 'OUT' | 'TRANSFER'
    sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    netAmount?: number
    grossAmount?: number
    vatRate: number
    description: string
    paymentMethod?: 'BAR' | 'BANK'
    mode?: 'NET' | 'GROSS'
    tags?: string[]
}

function useQuickAdd(today: string, create: (p: any) => Promise<any>, onOpenFilePicker?: () => void) {
    const [quickAdd, setQuickAdd] = useState(false)
    const [qa, setQa] = useState<QA>({ date: today, type: 'IN', sphere: 'IDEELL', grossAmount: 100, vatRate: 19, description: '', paymentMethod: 'BAR', mode: 'GROSS' })
    const [files, setFiles] = useState<File[]>([])

    function onDropFiles(fileList: FileList | null) {
        if (!fileList) return
        const arr = Array.from(fileList)
        setFiles((prev) => [...prev, ...arr])
    }

    async function onQuickSave() {
        const payload: any = {
            date: qa.date,
            type: qa.type,
            sphere: qa.sphere,
            description: qa.description || undefined,
            vatRate: qa.vatRate,
            paymentMethod: qa.paymentMethod
        }
        if (qa.mode === 'GROSS') payload.grossAmount = qa.grossAmount ?? 0
        else payload.netAmount = qa.netAmount ?? 0
        if ((qa as any).earmarkId !== undefined) payload.earmarkId = (qa as any).earmarkId
        if (Array.isArray((qa as any).tags)) payload.tags = (qa as any).tags

        // Convert attachments to Base64
        if (files.length) {
            const enc = async (f: File) => {
                const buf = await f.arrayBuffer()
                let binary = ''
                const bytes = new Uint8Array(buf)
                const chunk = 0x8000
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
                }
                const dataBase64 = btoa(binary)
                return { name: f.name, dataBase64, mime: f.type || undefined }
            }
            payload.files = await Promise.all(files.map(enc))
        }

        const res = await create(payload)
        if (res) {
            setQuickAdd(false)
            setFiles([])
            setQa({ date: today, type: 'IN', sphere: 'IDEELL', grossAmount: 100, vatRate: 19, description: '', paymentMethod: 'BAR', mode: 'GROSS' })
        }
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null
            const tag = (target?.tagName || '').toLowerCase()
            const inEditable = !!(target && ((target as any).isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'))

            // Search focus (Ctrl+K) only when on Buchungen and not in another input
            if (!inEditable && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                try { const page = localStorage.getItem('activePage') || 'Buchungen'; if (page === 'Buchungen') { (document.querySelector('input[placeholder^="Suche Buchungen"]') as HTMLInputElement | null)?.focus(); e.preventDefault(); return } } catch { }
            }

            // Open Quick-Add robustly via Ctrl+Shift+N (no bare 'n')
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
                setQuickAdd(true); e.preventDefault(); return
            }

            // Save and Upload hotkeys only when Quick-Add is open
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { if (quickAdd) { onQuickSave(); e.preventDefault() } return }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { if (quickAdd) { onOpenFilePicker?.(); e.preventDefault() } return }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [qa, files, quickAdd])

    const openFilePicker = () => onOpenFilePicker?.()

    return { quickAdd, setQuickAdd, qa, setQa, onQuickSave, files, setFiles, openFilePicker, onDropFiles }
}

function TagsEditor({ label, value, onChange, tagDefs }: { label?: string; value: string[]; onChange: (v: string[]) => void; tagDefs: Array<{ id: number; name: string; color?: string | null }> }) {
    const [input, setInput] = useState('')
    const [focused, setFocused] = useState(false)
    const sugg = useMemo(() => {
        const q = input.trim().toLowerCase()
        const existing = new Set((value || []).map(v => v.toLowerCase()))
        return (tagDefs || []).filter(t => !existing.has((t.name || '').toLowerCase()) && (!q || t.name.toLowerCase().includes(q))).slice(0, 8)
    }, [input, tagDefs, value])
    function addTag(name: string) {
        const n = (name || '').trim()
        if (!n) return
        if (!(value || []).includes(n)) onChange([...(value || []), n])
        setInput('')
    }
    function removeTag(name: string) {
        onChange((value || []).filter(v => v !== name))
    }
    const colorFor = (name: string) => (tagDefs || []).find(t => (t.name || '').toLowerCase() === (name || '').toLowerCase())?.color
    return (
        <div className="field" style={{ gridColumn: '1 / span 2' }}>
            {label && <label>{label}</label>}
            <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 34 }}>
                {(value || []).map((t) => {
                    const bg = colorFor(t) || undefined
                    const fg = contrastText(bg)
                    return (
                        <span key={t} className="chip" style={{ background: bg, color: bg ? fg : undefined }}>
                            {t}
                            <button className="chip-x" onClick={() => removeTag(t)} aria-label={`Tag ${t} entfernen`} type="button">×</button>
                        </span>
                    )
                })}
                {/* Quick add via dropdown */}
                <select
                    className="input"
                    value=""
                    onChange={(e) => { const name = e.target.value; if (name) addTag(name) }}
                    style={{ minWidth: 140 }}
                    title="Tag aus Liste hinzufügen"
                >
                    <option value="">+ Tag auswählen…</option>
                    {(tagDefs || []).filter(t => !(value || []).some(v => v.toLowerCase() === (t.name || '').toLowerCase())).map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                </select>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
                        if (e.key === 'Backspace' && !input && (value || []).length) { removeTag((value || [])[value.length - 1]) }
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={(value || []).length ? '' : 'Tag hinzufügen…'}
                    style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent' }}
                />
            </div>
            {focused && sugg.length > 0 && (
                <div className="card" style={{ padding: 6, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sugg.map(s => {
                        const bg = s.color || undefined
                        const fg = contrastText(bg)
                        return <button key={s.id} type="button" className="btn" style={{ background: bg, color: bg ? fg : undefined }} onClick={() => addTag(s.name)}>{s.name}</button>
                    })}
                </div>
            )}
        </div>
    )
}

// Lightweight totals bar for current filters
function FilterTotals({ refreshKey, from, to, paymentMethod, sphere, type, earmarkId }: { refreshKey?: number; from?: string; to?: string; paymentMethod?: 'BAR' | 'BANK'; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; type?: 'IN' | 'OUT' | 'TRANSFER'; earmarkId?: number }) {
    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState<{ inGross: number; outGross: number; diff: number } | null>(null)
    useEffect(() => {
        let alive = true
        async function run() {
            setLoading(true)
            try {
                const res = await window.api?.reports.summary?.({ from, to, paymentMethod, sphere, type, earmarkId })
                if (alive && res) {
                    const t = res.byType || []
                    const inGross = t.find(x => x.key === 'IN')?.gross || 0
                    const outGrossRaw = t.find(x => x.key === 'OUT')?.gross || 0
                    const outGross = Math.abs(outGrossRaw)
                    const diff = Math.round((inGross - outGross) * 100) / 100
                    setValues({ inGross, outGross, diff })
                }
            } finally {
                if (alive) setLoading(false)
            }
        }
        run()
        return () => { alive = false }
    }, [from, to, paymentMethod, sphere, type, earmarkId, refreshKey])
    const fmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    if (!values && !loading) return null
    return (
        <div className="card" style={{ padding: 8, marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
            <strong>Summe der Filterung:</strong>
            <span style={{ color: 'var(--success)' }}>IN: {fmt.format(values?.inGross ?? 0)}</span>
            <span style={{ color: 'var(--danger)' }}>OUT: {fmt.format(values?.outGross ?? 0)}</span>
            <span style={{ color: ((values?.diff ?? 0) >= 0) ? 'var(--success)' : 'var(--danger)' }}>Differenz: {fmt.format(values?.diff ?? 0)}</span>
        </div>
    )
}

function EarmarkUsageCards({ bindings, from, to, sphere }: { bindings: Array<{ id: number; code: string; name: string; color?: string | null }>; from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) {
    const [usage, setUsage] = useState<Record<number, { allocated: number; released: number; balance: number }>>({})
    useEffect(() => {
        let alive = true
        async function run() {
            const res: Record<number, { allocated: number; released: number; balance: number }> = {}
            for (const b of bindings) {
                const u = await window.api?.bindings.usage?.({ earmarkId: b.id, from, to, sphere })
                if (u) res[b.id] = u
            }
            if (alive) setUsage(res)
        }
        run()
        return () => { alive = false }
    }, [bindings, from, to, sphere])
    const fmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    if (!bindings.length) return null
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
            {bindings.map(b => {
                const u = usage[b.id]
                const bg = b.color || undefined
                const fg = contrastText(bg)
                return (
                    <div key={b.id} className="card" style={{ padding: 10, cursor: 'pointer', borderTop: bg ? `4px solid ${bg}` : undefined }} onClick={() => {
                        try { localStorage.setItem('activePage', 'Buchungen') } catch { }
                        // Set earmark filter and navigate by dispatching a custom event the App can react to
                        const ev = new CustomEvent('apply-earmark-filter', { detail: { earmarkId: b.id } })
                        window.dispatchEvent(ev)
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span className="badge" style={{ background: bg, color: fg }}>{b.code}</span>
                            <span style={{ color: 'var(--text-dim)' }}>{b.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                            <span className="badge in">IN: {fmt.format(u?.allocated ?? 0)}</span>
                            <span className="badge out">OUT: {fmt.format(u?.released ?? 0)}</span>
                            <span className="badge">Saldo: {fmt.format(u?.balance ?? 0)}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function ReportsSummary(props: { refreshKey?: number; from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; type?: 'IN' | 'OUT' | 'TRANSFER'; paymentMethod?: 'BAR' | 'BANK' }) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<null | {
        totals: { net: number; vat: number; gross: number }
        bySphere: Array<{ key: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; net: number; vat: number; gross: number }>
        byPaymentMethod: Array<{ key: 'BAR' | 'BANK' | null; net: number; vat: number; gross: number }>
        byType: Array<{ key: 'IN' | 'OUT' | 'TRANSFER'; net: number; vat: number; gross: number }>
    }>(null)
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        window.api?.reports.summary?.({ from: props.from, to: props.to, sphere: props.sphere, type: props.type, paymentMethod: props.paymentMethod })
            .then((res) => { if (!cancelled) setData(res) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [props.from, props.to, props.sphere, props.type, props.paymentMethod, props.refreshKey])

    return (
        <div className="card" style={{ marginTop: 12, padding: 12, display: 'grid', gap: 12 }}>
            <strong>Summen</strong>
            {loading && <div>Lade …</div>}
            {data && (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div><div className="helper">Netto</div><div>{eurFmt.format(data.totals.net)}</div></div>
                        <div><div className="helper">MwSt</div><div>{eurFmt.format(data.totals.vat)}</div></div>
                        <div><div className="helper">Brutto</div><div>{eurFmt.format(data.totals.gross)}</div></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <div>
                            <strong>Nach Sphäre</strong>
                            <ul>
                                {data.bySphere.map((r) => (
                                    <li key={r.key}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key}</span> {eurFmt.format(r.gross)}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <strong>Nach Zahlweg</strong>
                            <ul>
                                {data.byPaymentMethod.map((r, i) => (
                                    <li key={(r.key ?? 'NULL') + i}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key ?? '—'}</span> {eurFmt.format(r.gross)}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <strong>Nach Art</strong>
                            <ul>
                                {data.byType.map((r) => (
                                    <li key={r.key}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key}</span> {eurFmt.format(r.gross)}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ReportsTabs() {
    const [tab, setTab] = useState<string>(() => {
        try { return localStorage.getItem('reportsTab') || 'overview' } catch { return 'overview' }
    })
    useEffect(() => { try { localStorage.setItem('reportsTab', tab) } catch { } }, [tab])
    return (
        <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={() => setTab('overview')} style={{ background: tab === 'overview' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Übersicht</button>
            <button className="btn ghost" onClick={() => setTab('monthly')} style={{ background: tab === 'monthly' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Monatsverlauf</button>
            <button className="btn ghost" onClick={() => setTab('compare')} style={{ background: tab === 'compare' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }} disabled>Vergleich (bald)</button>
        </div>
    )
}

function ReportsMonthlyChart(props: { refreshKey?: number; from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; type?: 'IN' | 'OUT' | 'TRANSFER'; paymentMethod?: 'BAR' | 'BANK' }) {
    const [loading, setLoading] = useState(false)
    const [buckets, setBuckets] = useState<Array<{ month: string; net: number; vat: number; gross: number }>>([])
    const [hoverIdx, setHoverIdx] = useState<number | null>(null)
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    // Measure container width to expand chart to available space
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerW, setContainerW] = useState<number>(0)
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        setContainerW(el.clientWidth)
        const ro = new ResizeObserver((entries) => {
            if (entries[0]) setContainerW(entries[0].contentRect.width)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        window.api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: props.type, paymentMethod: props.paymentMethod })
            .then((res) => { if (!cancelled) setBuckets(res.buckets) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [props.from, props.to, props.sphere, props.type, props.paymentMethod, props.refreshKey])

    const maxGross = Math.max(1, ...buckets.map(b => Math.abs(b.gross)))
    const margin = { top: 22, right: 20, bottom: 42, left: 28 }
    const innerH = 168
    let defaultBarW = 30
    const gap = 16
    const minWidth = Math.max(320, buckets.length * (defaultBarW + gap) + margin.left + margin.right)
    const width = Math.max(containerW || 0, minWidth)
    // Derive bar width to fill available container width when there are few months
    let barWidth = defaultBarW
    if (containerW && buckets.length > 0) {
        const innerW = width - (margin.left + margin.right)
        const computed = Math.floor((innerW - (buckets.length - 1) * gap) / buckets.length)
        barWidth = Math.max(16, Math.min(80, computed))
    }
    const height = innerH + margin.top + margin.bottom
    const yBase = margin.top
    const yAxisX = margin.left - 2
    const monthLabel = (m: string, withYear = false) => {
        const [y, mm] = m.split('-').map(Number)
        const d = new Date(Date.UTC(y, (mm - 1) as number, 1))
        const mon = d.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
        return withYear ? `${mon} ${y}` : mon
    }
    const years = useMemo(() => Array.from(new Set(buckets.map(b => b.month.slice(0, 4)))), [buckets])

    return (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Monatsverlauf (Saldo: IN − OUT)</strong>
                <div className="legend">
                    <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)' }}></span>Saldo (Brutto)</span>
                </div>
            </div>
            {loading && <div>Lade …</div>}
            {!loading && (
                <div ref={containerRef} style={{ overflowX: 'auto' }}>
                    <svg width={width} height={height} role="img" aria-label="Monatsverlauf">
                        {/* grid lines */}
                        {Array.from({ length: 4 }).map((_, i) => {
                            const y = yBase + (innerH / 4) * i
                            return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
                        })}
                        {buckets.map((b, i) => {
                            const x = margin.left + i * (barWidth + gap)
                            const h = Math.round((Math.abs(b.gross) / maxGross) * innerH)
                            const y = yBase + (innerH - h)
                            return (
                                <g key={b.month} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                                    <rect x={x} y={y} width={barWidth} height={h} fill="var(--accent)" rx={3} />
                                    {hoverIdx === i && (
                                        <text x={x + barWidth / 2} y={Math.max(yBase + 10, y - 6)} textAnchor="middle" fontSize="10">{eurFmt.format(b.gross)}</text>
                                    )}
                                    <text x={x + barWidth / 2} y={yBase + innerH + 18} textAnchor="middle" fontSize="10">{monthLabel(b.month, false)}</text>
                                    <title>{`${monthLabel(b.month, true)}: ${eurFmt.format(b.gross)}`}</title>
                                </g>
                            )
                        })}
                        {/* y-axis line */}
                        <line x1={yAxisX} y1={yBase} x2={yAxisX} y2={yBase + innerH} stroke="var(--border)" />
                        {/* centered year caption */}
                        {years.length > 0 && (
                            <text x={Math.round(width / 2)} y={yBase + innerH + 34} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
                                {years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`}
                            </text>
                        )}
                        {/* legend moved outside */}
                    </svg>
                </div>
            )}
        </div>
    )
}

function ReportsSphereBars(props: { refreshKey?: number; from?: string; to?: string }) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<{ [k in 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB']?: { inGross: number; outGross: number } }>({})
    const [hover, setHover] = useState<null | { idx: number; which: 'IN' | 'OUT' }>(null)
    const spheres: Array<'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'> = ['IDEELL', 'ZWECK', 'VERMOEGEN', 'WGB']
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        Promise.all([
            window.api?.reports.summary?.({ from: props.from, to: props.to, type: 'IN' }),
            window.api?.reports.summary?.({ from: props.from, to: props.to, type: 'OUT' })
        ]).then(([sumIn, sumOut]) => {
            if (cancelled) return
            const map: any = {}
            for (const s of spheres) map[s] = { inGross: 0, outGross: 0 }
            sumIn?.bySphere.forEach(r => { map[r.key].inGross = r.gross })
            sumOut?.bySphere.forEach(r => { map[r.key].outGross = r.gross })
            setData(map)
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [props.from, props.to, props.refreshKey])
    const entries = spheres.map(s => ({ sphere: s, inGross: data[s]?.inGross || 0, outGross: data[s]?.outGross || 0 }))
    const maxVal = Math.max(1, ...entries.map(e => Math.max(e.inGross, Math.abs(e.outGross))))
    const margin = { top: 22, right: 16, bottom: 30, left: 24 }
    const innerH = 160
    const groupWidth = 46
    const gap = 18
    const barW = 18
    const width = Math.max(280, entries.length * (groupWidth + gap) + margin.left + margin.right)
    const height = innerH + margin.top + margin.bottom
    const yBase = margin.top
    const yAxisX = margin.left - 2
    return (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Gruppen-Bars pro Sphäre (IN/OUT, Brutto)</strong>
                <div className="legend">
                    <span className="legend-item"><span className="legend-swatch" style={{ background: '#2e7d32' }}></span>IN</span>
                    <span className="legend-item"><span className="legend-swatch" style={{ background: '#c62828' }}></span>OUT</span>
                </div>
            </div>
            {loading && <div>Lade …</div>}
            {!loading && (
                <div style={{ overflowX: 'auto' }}>
                    <svg width={width} height={height} role="img" aria-label="Gruppen-Bars pro Sphäre">
                        {/* grid lines */}
                        {Array.from({ length: 4 }).map((_, i) => {
                            const y = yBase + (innerH / 4) * i
                            return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
                        })}
                        {entries.map((e, i) => {
                            const gx = margin.left + i * (groupWidth + gap)
                            const hIn = Math.round((Math.abs(e.inGross) / maxVal) * innerH)
                            const hOut = Math.round((Math.abs(e.outGross) / maxVal) * innerH)
                            const yIn = yBase + (innerH - hIn)
                            const yOut = yBase + (innerH - hOut)
                            return (
                                <g key={e.sphere}>
                                    <g onMouseEnter={() => setHover({ idx: i, which: 'IN' })} onMouseLeave={() => setHover(null)}>
                                        <rect x={gx} y={yIn} width={barW} height={hIn} fill="#2e7d32" rx={3} />
                                        {hover && hover.idx === i && hover.which === 'IN' && (
                                            <text x={gx + barW / 2} y={Math.max(yBase + 10, yIn - 6)} textAnchor="middle" fontSize="10">{eurFmt.format(e.inGross)}</text>
                                        )}
                                    </g>
                                    <g onMouseEnter={() => setHover({ idx: i, which: 'OUT' })} onMouseLeave={() => setHover(null)}>
                                        <rect x={gx + barW + 4} y={yOut} width={barW} height={hOut} fill="#c62828" rx={3} />
                                        {hover && hover.idx === i && hover.which === 'OUT' && (
                                            <text x={gx + barW + 4 + barW / 2} y={Math.max(yBase + 10, yOut - 6)} textAnchor="middle" fontSize="10">{eurFmt.format(e.outGross)}</text>
                                        )}
                                    </g>
                                    <text x={gx + barW} y={yBase + innerH + 18} textAnchor="middle" fontSize="10">{e.sphere.slice(0, 3)}</text>
                                    <title>{`${e.sphere}\nIN: ${eurFmt.format(e.inGross)}\nOUT: ${eurFmt.format(e.outGross)}`}</title>
                                </g>
                            )
                        })}
                        <line x1={yAxisX} y1={yBase} x2={yAxisX} y2={yBase + innerH} stroke="var(--border)" />
                        {/* legend moved outside */}
                    </svg>
                </div>
            )}
        </div>
    )
}

function ReportsCashBars(props: { refreshKey?: number; from?: string; to?: string }) {
    const [loading, setLoading] = useState(false)
    const [bar, setBar] = useState(0)
    const [bank, setBank] = useState(0)
    const [hover, setHover] = useState<null | 'BAR' | 'BANK'>(null)
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        window.api?.reports.cashBalance?.({ to: props.to })
            .then((res) => {
                if (cancelled || !res) return
                setBar(res.BAR || 0)
                setBank(res.BANK || 0)
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [props.to, props.refreshKey])
    const maxVal = Math.max(1, Math.abs(bar), Math.abs(bank))
    const margin = { top: 22, right: 16, bottom: 30, left: 24 }
    const innerH = 140
    const height = innerH + margin.top + margin.bottom
    const width = 200
    const barW = 36
    const gap = 36
    const yBase = margin.top
    const yBar = yBase + (innerH - Math.round((Math.abs(bar) / maxVal) * innerH))
    const hBar = innerH - (yBar - yBase)
    const yBank = yBase + (innerH - Math.round((Math.abs(bank) / maxVal) * innerH))
    const hBank = innerH - (yBank - yBase)
    return (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <strong>Kassenstand: Bar vs. Bank – Bestand{props.to ? ` (Stand: ${props.to})` : ''}</strong>
            {loading && <div>Lade …</div>}
            {!loading && (
                <svg width={width} height={height} role="img" aria-label="Bar und Bank">
                    {/* grid lines */}
                    {Array.from({ length: 4 }).map((_, i) => {
                        const y = yBase + (innerH / 4) * i
                        return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
                    })}
                    <g onMouseEnter={() => setHover('BAR')} onMouseLeave={() => setHover(null)}>
                        <rect x={40} y={yBar} width={barW} height={hBar} fill="#2e7d32" rx={3} />
                        {hover === 'BAR' && (
                            <text x={40 + barW / 2} y={Math.max(yBase + 10, yBar - 6)} textAnchor="middle" fontSize="10">{eurFmt.format(bar)}</text>
                        )}
                        <text x={40 + barW / 2} y={yBase + innerH + 18} textAnchor="middle" fontSize="10">Bar</text>
                        <title>{`Bar: ${eurFmt.format(bar)}`}</title>
                    </g>
                    <g onMouseEnter={() => setHover('BANK')} onMouseLeave={() => setHover(null)}>
                        <rect x={40 + barW + gap} y={yBank} width={barW} height={hBank} fill="#1565c0" rx={3} />
                        {hover === 'BANK' && (
                            <text x={40 + barW + gap + barW / 2} y={Math.max(yBase + 10, yBank - 6)} textAnchor="middle" fontSize="10">{eurFmt.format(bank)}</text>
                        )}
                        <text x={40 + barW + gap + barW / 2} y={yBase + innerH + 18} textAnchor="middle" fontSize="10">Bank</text>
                        <title>{`Bank: ${eurFmt.format(bank)}`}</title>
                    </g>
                    <line x1={margin.left - 2} y1={yBase} x2={margin.left - 2} y2={yBase + innerH} stroke="var(--border)" />
                </svg>
            )}
        </div>
    )
}

function ReportsInOutLines(props: { refreshKey?: number; from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' }) {
    const [loading, setLoading] = useState(false)
    const [inBuckets, setInBuckets] = useState<Array<{ month: string; gross: number }>>([])
    const [outBuckets, setOutBuckets] = useState<Array<{ month: string; gross: number }>>([])
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    const [hoverIdx, setHoverIdx] = useState<number | null>(null)
    // Responsive: measure container width to expand chart
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerW, setContainerW] = useState<number>(0)
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        setContainerW(el.clientWidth)
        const ro = new ResizeObserver((entries) => {
            if (entries[0]) setContainerW(entries[0].contentRect.width)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        Promise.all([
            window.api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'IN' }),
            window.api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'OUT' })
        ]).then(([inRes, outRes]) => {
            if (cancelled) return
            setInBuckets((inRes?.buckets || []).map(b => ({ month: b.month, gross: b.gross })))
            setOutBuckets((outRes?.buckets || []).map(b => ({ month: b.month, gross: b.gross })))
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [props.from, props.to, props.sphere, props.refreshKey])
    const months = Array.from(new Set([...(inBuckets.map(b => b.month)), ...(outBuckets.map(b => b.month))])).sort()
    const maxVal = Math.max(1, ...months.map(m => Math.max(Math.abs(inBuckets.find(b => b.month === m)?.gross || 0), Math.abs(outBuckets.find(b => b.month === m)?.gross || 0))))
    const margin = { top: 22, right: 22, bottom: 42, left: 30 }
    const innerH = 188
    const height = innerH + margin.top + margin.bottom
    // Base step for minimum width, but expand to container
    let baseStep = 54
    const minWidth = Math.max(340, months.length * baseStep + margin.left + margin.right)
    const width = Math.max(containerW || 0, minWidth)
    let step = baseStep
    if (containerW && months.length > 1) {
        const innerW = width - (margin.left + margin.right)
        step = Math.max(40, Math.min(140, Math.floor(innerW / (months.length - 1))))
    }
    const xFor = (idx: number) => margin.left + idx * step
    const yFor = (val: number) => margin.top + (innerH - Math.round((Math.abs(val) / maxVal) * innerH))
    const monthLabel = (m: string, withYear = false) => {
        const [y, mm] = m.split('-').map(Number)
        const d = new Date(Date.UTC(y, (mm - 1) as number, 1))
        const mon = d.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
        return withYear ? `${mon} ${y}` : mon
    }
    const years = useMemo(() => Array.from(new Set(months.map(m => m.slice(0, 4)))), [months])
    const points = (arr: Array<{ month: string; gross: number }>) => months.map((m, i) => `${xFor(i)},${yFor(arr.find(b => b.month === m)?.gross || 0)}`).join(' ')
    return (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Linienverlauf Einnahmen (IN) vs. Ausgaben (OUT) – Brutto</strong>
                <div className="legend">
                    <span className="legend-item"><span className="legend-swatch" style={{ background: '#2e7d32' }}></span>IN</span>
                    <span className="legend-item"><span className="legend-swatch" style={{ background: '#c62828' }}></span>OUT</span>
                </div>
            </div>
            {loading && <div>Lade …</div>}
            {!loading && (
                <div ref={containerRef} style={{ overflowX: 'auto' }}>
                    <svg width={width} height={height} role="img" aria-label="IN vs OUT">
                        {/* grid lines */}
                        {Array.from({ length: 4 }).map((_, i) => {
                            const y = margin.top + (innerH / 4) * i
                            return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
                        })}
                        <polyline fill="none" stroke="#2e7d32" strokeWidth="2" points={points(inBuckets)} />
                        <polyline fill="none" stroke="#c62828" strokeWidth="2" points={points(outBuckets)} />
                        {months.map((m, i) => (
                            <g key={m} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                                {/* interactive points */}
                                <circle cx={xFor(i)} cy={yFor(inBuckets.find(b => b.month === m)?.gross || 0)} r={3} fill="#2e7d32">
                                    <title>{`IN ${monthLabel(m, true)}: ${eurFmt.format(inBuckets.find(b => b.month === m)?.gross || 0)}`}</title>
                                </circle>
                                <circle cx={xFor(i)} cy={yFor(outBuckets.find(b => b.month === m)?.gross || 0)} r={3} fill="#c62828">
                                    <title>{`OUT ${monthLabel(m, true)}: ${eurFmt.format(outBuckets.find(b => b.month === m)?.gross || 0)}`}</title>
                                </circle>
                                {/* hover value */}
                                {hoverIdx === i && (
                                    <g>
                                        <text x={xFor(i) + 8} y={Math.max(margin.top + 10, yFor(inBuckets.find(b => b.month === m)?.gross || 0) - 6)} fontSize="10" fill="#2e7d32">{eurFmt.format(inBuckets.find(b => b.month === m)?.gross || 0)}</text>
                                        <text x={xFor(i) + 8} y={Math.max(margin.top + 10, yFor(outBuckets.find(b => b.month === m)?.gross || 0) - 6)} fontSize="10" fill="#c62828">{eurFmt.format(outBuckets.find(b => b.month === m)?.gross || 0)}</text>
                                    </g>
                                )}
                                <text x={xFor(i)} y={margin.top + innerH + 18} textAnchor="middle" fontSize="10">{monthLabel(m, false)}</text>
                            </g>
                        ))}
                        {/* centered year caption */}
                        {years.length > 0 && (
                            <text x={Math.round(width / 2)} y={margin.top + innerH + 34} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
                                {years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`}
                            </text>
                        )}
                        {/* legend moved outside */}
                    </svg>
                </div>
            )}
        </div>
    )
}

function ReportsComparison(props: { refreshKey?: number; from?: string; to?: string; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; type?: 'IN' | 'OUT' | 'TRANSFER'; paymentMethod?: 'BAR' | 'BANK' }) {
    const [loading, setLoading] = useState(false)
    const [a, setA] = useState<null | { totals: { net: number; vat: number; gross: number } }>(null)
    const [b, setB] = useState<null | { totals: { net: number; vat: number; gross: number } }>(null)
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

    // Compute A = given range; B = previous period with same length
    const [rangeA, rangeB] = useMemo(() => {
        const from = props.from ? new Date(props.from) : null
        const to = props.to ? new Date(props.to) : null
        if (from && to) {
            const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1)
            const bTo = new Date(from.getTime() - 24 * 60 * 60 * 1000)
            const bFrom = new Date(bTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
            const fmt = (d: Date) => d.toISOString().slice(0, 10)
            return [{ from: fmt(from), to: fmt(to) }, { from: fmt(bFrom), to: fmt(bTo) }]
        }
        // Fallback: use current month as A
        const now = new Date()
        const aFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const aTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
        const bTo = new Date(aFrom.getTime() - 24 * 60 * 60 * 1000)
        const bFrom = new Date(Date.UTC(bTo.getUTCFullYear(), bTo.getUTCMonth(), 1))
        const fmt = (d: Date) => d.toISOString().slice(0, 10)
        return [{ from: fmt(aFrom), to: fmt(aTo) }, { from: fmt(bFrom), to: fmt(bTo) }]
    }, [props.from, props.to])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        Promise.all([
            window.api?.reports.summary?.({ from: rangeA.from, to: rangeA.to, sphere: props.sphere, type: props.type, paymentMethod: props.paymentMethod }),
            window.api?.reports.summary?.({ from: rangeB.from, to: rangeB.to, sphere: props.sphere, type: props.type, paymentMethod: props.paymentMethod })
        ]).then(([sa, sb]) => {
            if (cancelled) return
            setA(sa as any)
            setB(sb as any)
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [rangeA.from, rangeA.to, rangeB.from, rangeB.to, props.sphere, props.type, props.paymentMethod, props.refreshKey])

    const delta = useMemo(() => {
        if (!a || !b) return null
        return {
            net: (a.totals.net - b.totals.net),
            vat: (a.totals.vat - b.totals.vat),
            gross: (a.totals.gross - b.totals.gross)
        }
    }, [a, b])

    return (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <strong>Vergleich</strong>
            <div className="helper" style={{ marginTop: 4 }}>A: {rangeA.from} – {rangeA.to} | B: {rangeB.from} – {rangeB.to}</div>
            {loading && <div>Lade …</div>}
            {!loading && a && b && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
                    <div className="card" style={{ padding: 12 }}>
                        <div className="helper">A (Summe Brutto)</div>
                        <div style={{ fontWeight: 600 }}>{eurFmt.format(a.totals.gross)}</div>
                    </div>
                    <div className="card" style={{ padding: 12 }}>
                        <div className="helper">B (Summe Brutto)</div>
                        <div style={{ fontWeight: 600 }}>{eurFmt.format(b.totals.gross)}</div>
                    </div>
                    <div className="card" style={{ padding: 12 }}>
                        <div className="helper">Delta (A − B)</div>
                        <div style={{ fontWeight: 600, color: (delta!.gross >= 0 ? 'var(--success)' : 'var(--danger)') }}>{eurFmt.format(delta!.gross)}</div>
                    </div>
                </div>
            )}
        </div>
    )
}

// JournalTable with in-place header drag-and-drop reordering
function JournalTable({ rows, order, cols, onReorder, earmarks, tagDefs, eurFmt, fmtDate, onEdit, onDelete, onToggleSort, sortDir, onTagClick }: {
    rows: Array<{ id: number; voucherNo: string; date: string; type: 'IN' | 'OUT' | 'TRANSFER'; sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; description?: string | null; paymentMethod?: 'BAR' | 'BANK' | null; netAmount: number; vatRate: number; vatAmount: number; grossAmount: number; fileCount?: number; earmarkId?: number | null; earmarkCode?: string | null; tags?: string[] }>
    order: string[]
    cols: Record<string, boolean>
    onReorder: (o: string[]) => void
    earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
    tagDefs: Array<{ id: number; name: string; color?: string | null }>
    eurFmt: Intl.NumberFormat
    fmtDate: (s?: string) => string
    onEdit: (r: { id: number; date: string; description: string | null; paymentMethod: 'BAR' | 'BANK' | null; type?: 'IN' | 'OUT' | 'TRANSFER'; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; earmarkId?: number | null; tags?: string[] }) => void
    onDelete: (r: { id: number; voucherNo: string }) => void
    onToggleSort: () => void
    sortDir: 'ASC' | 'DESC'
    onTagClick?: (name: string) => void
}) {
    const dragIdx = useRef<number | null>(null)
    const visibleOrder = order.filter(k => cols[k])
    function onHeaderDragStart(e: React.DragEvent<HTMLTableCellElement>, idx: number) {
        dragIdx.current = idx
        e.dataTransfer.effectAllowed = 'move'
    }
    function onHeaderDragOver(e: React.DragEvent<HTMLTableCellElement>) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'
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
    const thFor = (k: string) => (
        k === 'actions' ? <th key={k} align="center" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Aktionen</th>
            : k === 'date' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))} onClick={onToggleSort} style={{ cursor: 'pointer' }}>Datum {sortDir === 'DESC' ? '↓' : '↑'}</th>
                : k === 'voucherNo' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Nr.</th>
                    : k === 'type' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Typ</th>
                        : k === 'sphere' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Sphäre</th>
                            : k === 'description' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Beschreibung</th>
                                : k === 'earmark' ? <th key={k} align="center" title="Zweckbindung" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>🎯</th>
                                    : k === 'paymentMethod' ? <th key={k} align="left" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Zahlweg</th>
                                        : k === 'attachments' ? <th key={k} align="center" title="Anhänge" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>📎</th>
                                            : k === 'net' ? <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Netto</th>
                                                : k === 'vat' ? <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>MwSt</th>
                                                    : <th key={k} align="right" draggable onDragStart={(e) => onHeaderDragStart(e, visibleOrder.indexOf(k))} onDragOver={onHeaderDragOver} onDrop={(e) => onHeaderDrop(e, visibleOrder.indexOf(k))}>Brutto</th>
    )
    const colorFor = (name: string) => (tagDefs || []).find(t => (t.name || '').toLowerCase() === (name || '').toLowerCase())?.color
    const tdFor = (k: string, r: any) => (
        k === 'actions' ? (
            <td key={k} align="center" style={{ whiteSpace: 'nowrap' }}>
                <button className="btn" title="Bearbeiten" onClick={() => onEdit({ id: r.id, date: r.date, description: r.description ?? '', paymentMethod: r.paymentMethod ?? null, type: r.type, sphere: r.sphere, earmarkId: r.earmarkId ?? null, tags: r.tags || [] })}>✎</button>
                <button className="btn" title="Löschen" onClick={() => onDelete({ id: r.id, voucherNo: r.voucherNo })}>🗑</button>
            </td>
        ) : k === 'date' ? (
            <td key={k}>{fmtDate(r.date)}</td>
        ) : k === 'voucherNo' ? (
            <td key={k}>{r.voucherNo}</td>
        ) : k === 'type' ? (
            <td key={k}><span className={`badge ${r.type.toLowerCase()}`}>{r.type}</span></td>
        ) : k === 'sphere' ? (
            <td key={k}><span className={`badge sphere-${r.sphere.toLowerCase()}`}>{r.sphere}</span></td>
        ) : k === 'description' ? (
            <td key={k}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ minWidth: 160, flex: '1 1 auto' }}>{r.description || ''}</span>
                    {(r.tags || []).map((t: string) => {
                        const bg = colorFor(t) || undefined
                        const fg = contrastText(bg)
                        return (
                            <button
                                key={t}
                                className="chip"
                                style={{ background: bg, color: bg ? fg : undefined, cursor: 'pointer' }}
                                title={`Nach Tag "${t}" filtern`}
                                onClick={() => onTagClick?.(t)}
                            >
                                {t}
                            </button>
                        )
                    })}
                </div>
            </td>
        ) : k === 'earmark' ? (
            <td key={k} align="center">{r.earmarkCode ? (() => {
                const em = earmarks.find(e => e.code === r.earmarkCode)
                const bg = em?.color
                const fg = contrastText(bg)
                return <span className="badge" title={`Zweckbindung ${r.earmarkCode}`} style={{ background: bg || undefined, color: bg ? fg : undefined }}>{r.earmarkCode}</span>
            })() : ''}</td>
        ) : k === 'paymentMethod' ? (
            <td key={k}>{r.paymentMethod ? <span className={`badge pm-${(r.paymentMethod || '').toLowerCase()}`}>{r.paymentMethod}</span> : ''}</td>
        ) : k === 'attachments' ? (
            <td key={k} align="center">{typeof r.fileCount === 'number' && r.fileCount > 0 ? (<span className="badge" title={`${r.fileCount} Anhang/Anhänge`}>📎 {r.fileCount}</span>) : ''}</td>
        ) : k === 'net' ? (
            <td key={k} align="right">{eurFmt.format(r.netAmount)}</td>
        ) : k === 'vat' ? (
            <td key={k} align="right">{eurFmt.format(r.vatAmount)}</td>
        ) : (
            <td key={k} align="right" className={r.type === 'IN' ? 'gross-in' : r.type === 'OUT' ? 'gross-out' : undefined}>{eurFmt.format(r.grossAmount)}</td>
        )
    )
    return (
        <table className="journal-table" cellPadding={6}>
            <thead>
                <tr>
                    {visibleOrder.map((k) => thFor(k))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                    <tr key={r.id}>
                        {visibleOrder.map((k) => tdFor(k, r))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

// SettingsView: Windows-like tile layout
function SettingsView({
    defaultCols,
    defaultOrder,
    cols,
    setCols,
    order,
    setOrder,
    journalLimit,
    setJournalLimit,
    dateFmt,
    setDateFmt,
    tagDefs,
    setTagDefs,
    notify,
    bumpDataVersion,
    openTagsManager,
}: {
    defaultCols: Record<string, boolean>
    defaultOrder: string[]
    cols: Record<string, boolean>
    setCols: (c: Record<string, boolean>) => void
    order: string[]
    setOrder: (o: string[]) => void
    journalLimit: number
    setJournalLimit: (n: number) => void
    dateFmt: 'ISO' | 'PRETTY'
    setDateFmt: (f: 'ISO' | 'PRETTY') => void
    tagDefs: Array<{ id: number; name: string; color?: string | null; usage?: number }>
    setTagDefs: React.Dispatch<React.SetStateAction<Array<{ id: number; name: string; color?: string | null; usage?: number }>>>
    notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
    bumpDataVersion: () => void
    openTagsManager?: () => void
}) {
    type TileKey = 'general' | 'table' | 'import' | 'tags'
    const [active, setActive] = useState<TileKey>('general')

    function GeneralPane() {
        const sample = '2025-09-11'
        const pretty = '11 Sep 2025'
        const [showDeleteAll, setShowDeleteAll] = useState(false)
        const [deleteConfirmText, setDeleteConfirmText] = useState('')
        const canDeleteAll = deleteConfirmText === 'LÖSCHEN'
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <strong>Allgemein</strong>
                    <div className="helper">Basiseinstellungen für Listen und Anzeige.</div>
                </div>
                <div className="row">
                    <div className="field">
                        <label>Journal: Anzahl der Einträge</label>
                        <select className="input" value={journalLimit} onChange={(e) => setJournalLimit(Number(e.target.value))}>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>Datumsformat</label>
                        <select className="input" value={dateFmt} onChange={(e) => setDateFmt(e.target.value as any)}>
                            <option value="ISO">ISO (z.B. {sample})</option>
                            <option value="PRETTY">Lesbar (z.B. {pretty})</option>
                        </select>
                        <div className="helper">Wirkt u.a. in Buchungen (Datumsspalte) und Filter-Chips.</div>
                    </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                            <strong>Datenbank</strong>
                            <div className="helper">Exportiere eine Sicherung oder importiere eine bestehende SQLite-Datei.</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={async () => {
                                try {
                                    const res = await window.api?.db.export?.()
                                    if (res?.filePath) notify('success', `Datenbank exportiert: ${res.filePath}`)
                                } catch (e: any) {
                                    notify('error', e?.message || String(e))
                                }
                            }}>Exportieren</button>
                            <button className="btn danger" onClick={async () => {
                                if (!confirm('Achtung: Die aktuelle Datenbank wird überschrieben. Fortfahren?')) return
                                try {
                                    const res = await window.api?.db.import?.()
                                    if (res?.ok) {
                                        notify('success', 'Datenbank importiert. Die App wird neu geladen …')
                                        // dispatch event for any listeners before reload
                                        window.dispatchEvent(new Event('data-changed'))
                                        bumpDataVersion()
                                        window.setTimeout(() => window.location.reload(), 600)
                                    }
                                } catch (e: any) {
                                    notify('error', e?.message || String(e))
                                }
                            }}>Importieren…</button>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: 12, borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div>
                            <strong>Gefährliche Aktion</strong>
                            <div className="helper">Alle Buchungen löschen (inkl. Anhänge). Dies kann nicht rückgängig gemacht werden.</div>
                        </div>
                        <div>
                            <button className="btn danger" onClick={() => { setDeleteConfirmText(''); setShowDeleteAll(true) }}>Alle Buchungen löschen…</button>
                        </div>
                    </div>
                </div>

                {showDeleteAll && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                        <div className="modal" style={{ display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0 }}>Alle Buchungen löschen</h2>
                                <button className="btn ghost" onClick={() => setShowDeleteAll(false)}>✕</button>
                            </div>
                            <div className="helper">Dieser Vorgang löscht ALLE Buchungen und zugehörige Anhänge dauerhaft. Dies kann nicht rückgängig gemacht werden.</div>
                            <div className="field">
                                <label>Zur Bestätigung bitte exakt "LÖSCHEN" eingeben</label>
                                <input className="input" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.currentTarget.value)} placeholder="LÖSCHEN" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn" onClick={() => setShowDeleteAll(false)}>Abbrechen</button>
                                <button className="btn danger" disabled={!canDeleteAll} onClick={async () => {
                                    try {
                                        const res = await window.api?.vouchers.clearAll?.()
                                        const n = res?.deleted ?? 0
                                        setShowDeleteAll(false)
                                        notify('success', `${n} Buchung(en) gelöscht.`)
                                        window.dispatchEvent(new Event('data-changed'))
                                        bumpDataVersion()
                                    } catch (e: any) {
                                        notify('error', e?.message || String(e))
                                    }
                                }}>Ja, alles löschen</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    function TablePane() {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <strong>Tabelle & Darstellung</strong>
                    <div className="helper">Sichtbarkeit der Spalten und Reihenfolge. Drag & Drop zum Umordnen.</div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {Object.keys(defaultCols).map(k => (
                        <label key={k} title={k === 'actions' ? 'Empfohlen aktiviert' : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={!!cols[k]} onChange={(e) => setCols({ ...cols, [k]: e.target.checked })} /> {k}
                        </label>
                    ))}
                </div>
                {!cols['actions'] && (
                    <div className="helper" style={{ color: 'var(--danger)' }}>Ohne „Aktionen“ kannst du Zeilen nicht bearbeiten oder löschen.</div>
                )}
                <div>
                    <div className="helper">Reihenfolge:</div>
                    <DnDOrder order={order as any} cols={cols as any} onChange={(o) => setOrder(o as any)} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => { setCols(defaultCols); setOrder(defaultOrder) }}>Preset: Standard</button>
                    <button className="btn" onClick={() => { setCols({ actions: true, date: true, voucherNo: false, type: false, sphere: false, description: true, earmark: false, paymentMethod: false, attachments: false, net: false, vat: false, gross: true } as any); setOrder(['actions', 'date', 'description', 'gross', 'voucherNo', 'type', 'sphere', 'earmark', 'paymentMethod', 'attachments', 'net', 'vat']) }}>Preset: Minimal</button>
                    <button className="btn" onClick={() => { setCols({ ...defaultCols }); setOrder(['actions', 'date', 'voucherNo', 'type', 'sphere', 'description', 'earmark', 'paymentMethod', 'attachments', 'net', 'vat', 'gross']) }}>Preset: Details</button>
                    <button className="btn" onClick={() => { setCols(defaultCols); setOrder(defaultOrder); setJournalLimit(20) }}>Zurücksetzen</button>
                </div>
            </div>
        )
    }

    function ImportPane() {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div>
                            <strong>Datenimport</strong>
                            <div className="helper">XLSX-Datei mit Kopfzeile (erste Zeile). Vorschau → Zuordnung prüfen → Import.</div>
                        </div>
                        <details>
                            <summary className="chip" title="Hinweise zur Datei-Struktur">ⓘ</summary>
                            <div className="helper" style={{ marginTop: 6 }}>
                                <ul style={{ margin: '4px 0 0 16px' }}>
                                    <li>Empfohlen: Kopfzeile in Zeile 1, Daten ab Zeile 2. Keine zusammengeführten Zellen.</li>
                                    <li>Ein Datensatz pro Zeile. Summen-/Saldo-Zeilen werden ignoriert.</li>
                                    <li>Mindestens: Datum und Betrag (Brutto oder Netto+USt). Optional: Art, Sphäre, Zweckbindung, Zahlweg.</li>
                                    <li>Bank-/Bar-Split: Alternativ die vier Spalten Bank+/-, Bar+/- verwenden (erzeugt ggf. mehrere Buchungen pro Zeile).</li>
                                    <li>Nutze „Vorlage herunterladen“ oder „Testdatei erzeugen“ als Referenz.</li>
                                </ul>
                            </div>
                        </details>
                    </div>
                </div>
                <ImportXlsxCard />
            </div>
        )
    }


    const tiles: Array<{ key: TileKey; title: string; desc: string; icon: React.ReactNode }> = [
        { key: 'general', title: 'Allgemein', desc: 'Basis & Listenverhalten', icon: <span>⚙️</span> },
        { key: 'table', title: 'Tabelle & Darstellung', desc: 'Spalten, Reihenfolge, Presets', icon: <span>📋</span> },
        { key: 'import', title: 'Datenimport', desc: 'Excel (XLSX) einlesen', icon: <span>⬇️</span> },
        { key: 'tags', title: 'Tags', desc: 'Farben & Namen verwalten', icon: <span>🏷️</span> },
    ]

    return (
        <div className="card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <h2 style={{ margin: 0 }}>Einstellungen</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {tiles.map(t => (
                        <button key={t.key} className="btn ghost" onClick={() => {
                            if (t.key === 'tags' && openTagsManager) { openTagsManager(); return }
                            setActive(t.key)
                        }} style={{ textAlign: 'left', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: active === t.key ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : undefined }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, var(--accent) 20%, transparent)' }}>{t.icon}</div>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                                    <div className="helper">{t.desc}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                {active === 'general' && <GeneralPane />}
                {active === 'table' && <TablePane />}
                {active === 'import' && <ImportPane />}
                {/* Tags pane disabled – use global modal instead */}
            </div>
        </div>
    )
}

function TagModal({ value, onClose, onSaved, notify }: { value: { id?: number; name: string; color?: string | null }; onClose: () => void; onSaved: () => void; notify?: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void }) {
    const [v, setV] = useState(value)
    const PALETTE = ['#7C4DFF', '#2962FF', '#00B8D4', '#00C853', '#AEEA00', '#FFD600', '#FF9100', '#FF3D00', '#F50057', '#9C27B0']
    const canSave = (v.name || '').trim().length > 0
    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>{v.id ? 'Tag bearbeiten' : 'Tag anlegen'}</h2>
                    <button className="btn danger" onClick={onClose}>Schließen</button>
                </header>
                <div className="row">
                    <div className="field">
                        <label>Name</label>
                        <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
                    </div>
                    <div className="field" style={{ gridColumn: '1 / span 2' }}>
                        <label>Farbe</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {PALETTE.map((c) => (
                                <button key={c} type="button" className="btn" onClick={() => setV({ ...v, color: c })} title={c} style={{ padding: 0, width: 28, height: 28, borderRadius: 6, border: v.color === c ? '2px solid var(--text)' : '2px solid transparent', background: c }}>
                                    <span aria-hidden="true" />
                                </button>
                            ))}
                            <button type="button" className="btn" onClick={() => setV({ ...v, color: null })} title="Keine Farbe" style={{ height: 28 }}>Keine</button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button className="btn" onClick={onClose}>Abbrechen</button>
                    <button className="btn primary" disabled={!canSave} onClick={async () => {
                        try {
                            const payload = { ...v, name: (v.name || '').trim() }
                            if (!payload.name) { notify?.('error', 'Bitte einen Namen eingeben'); return }
                            await window.api?.tags?.upsert?.(payload as any)
                            window.dispatchEvent(new Event('tags-changed'))
                            onSaved()
                        } catch (e: any) {
                            const msg = e?.message || String(e)
                            if (notify) notify('error', msg)
                            else alert(msg)
                        }
                    }}>Speichern</button>
                </div>
            </div>
        </div>,
        document.body
    )
}

// Global Tags Manager Modal
function TagsManagerModal({ onClose, notify, onChanged }: { onClose: () => void; notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void; onChanged?: () => void }) {
    const [tags, setTags] = useState<Array<{ id: number; name: string; color?: string | null; usage?: number }>>([])
    const [edit, setEdit] = useState<null | { id?: number; name: string; color?: string | null }>(null)
    const [busy, setBusy] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<null | { id: number; name: string }>(null)
    async function refresh() {
        try {
            setBusy(true)
            const res = await window.api?.tags?.list?.({ includeUsage: true })
            if (res?.rows) setTags(res.rows)
        } finally { setBusy(false) }
    }
    useEffect(() => { refresh() }, [])
    const PALETTE = ['#7C4DFF', '#2962FF', '#00B8D4', '#00C853', '#AEEA00', '#FFD600', '#FF9100', '#FF3D00', '#F50057', '#9C27B0']
    const colorSwatch = (c?: string | null) => c ? (<span title={c} style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c, verticalAlign: 'middle' }} />) : '—'
    return createPortal(
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(860px, 96vw)' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>Tags verwalten</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={refresh} disabled={busy}>Aktualisieren</button>
                        <button className="btn primary" onClick={() => setEdit({ name: '', color: null })}>+ Neu</button>
                        <button className="btn danger" onClick={onClose}>Schließen</button>
                    </div>
                </header>
                {busy && <div className="helper">Lade …</div>}
                <table cellPadding={6} style={{ marginTop: 4, width: '100%' }}>
                    <thead>
                        <tr>
                            <th align="left">Tag</th>
                            <th align="left">Farbe</th>
                            <th align="right">Nutzung</th>
                            <th align="center">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tags.map(t => (
                            <tr key={t.id}>
                                <td>{t.name}</td>
                                <td>{colorSwatch(t.color)}</td>
                                <td align="right">{t.usage ?? '—'}</td>
                                <td align="center" style={{ whiteSpace: 'nowrap' }}>
                                    <button className="btn" onClick={() => setEdit({ id: t.id, name: t.name, color: t.color ?? null })}>✎</button>
                                    <button className="btn danger" onClick={() => setDeleteConfirm({ id: t.id, name: t.name })}>🗑</button>
                                </td>
                            </tr>
                        ))}
                        {tags.length === 0 && (
                            <tr><td colSpan={4} style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Keine Tags vorhanden.</td></tr>
                        )}
                    </tbody>
                </table>
                {edit && (
                    <TagModal
                        value={edit}
                        onClose={() => setEdit(null)}
                        onSaved={async () => { await refresh(); setEdit(null); notify('success', 'Tag gespeichert'); onChanged?.() }}
                        notify={notify}
                    />
                )}
                {deleteConfirm && (
                    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDeleteConfirm(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0 }}>Tag löschen</h2>
                                <button className="btn ghost" onClick={() => setDeleteConfirm(null)}>✕</button>
                            </div>
                            <div>Den Tag <strong>{deleteConfirm.name}</strong> wirklich löschen?</div>
                            <div className="helper">Hinweis: Der Tag wird aus allen Buchungen entfernt.</div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn" onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
                                <button className="btn danger" onClick={async () => {
                                    try {
                                        await window.api?.tags?.delete?.({ id: deleteConfirm.id })
                                        notify('success', `Tag "${deleteConfirm.name}" gelöscht`)
                                        setDeleteConfirm(null)
                                        await refresh()
                                        window.dispatchEvent(new Event('tags-changed'))
                                        onChanged?.()
                                    } catch (e: any) {
                                        notify('error', e?.message || String(e))
                                    }
                                }}>Ja, löschen</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="helper" style={{ marginTop: 8 }}>Tipp: Farben schnell wählen:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {PALETTE.map(c => <span key={c} title={c} style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 6, background: c, border: '1px solid var(--border)' }} />)}
                </div>
            </div>
        </div>,
        document.body
    )
}

function ImportXlsxCard() {
    const [fileName, setFileName] = useState<string>('')
    const [base64, setBase64] = useState<string>('')
    const [headers, setHeaders] = useState<string[]>([])
    const [sample, setSample] = useState<Array<Record<string, any>>>([])
    const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)
    const [mapping, setMapping] = useState<Record<string, string | null>>({ date: null, type: null, sphere: null, description: null, paymentMethod: null, netAmount: null, vatRate: null, grossAmount: null, inGross: null, outGross: null, earmarkCode: null, bankIn: null, bankOut: null, cashIn: null, cashOut: null, defaultSphere: 'IDEELL' })
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<null | { imported: number; skipped: number; errors: Array<{ row: number; message: string }>; rowStatuses?: Array<{ row: number; ok: boolean; message?: string }> }>(null)
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [error, setError] = useState<string>('')

    function bufferToBase64(buf: ArrayBuffer) {
        const bytes = new Uint8Array(buf)
        const chunk = 0x8000
        let binary = ''
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
        }
        return btoa(binary)
    }
    async function processFile(f: File) {
        setError('')
        setResult(null)
        setFileName(f.name)
        try {
            const buf = await f.arrayBuffer()
            const b64 = bufferToBase64(buf)
            setBase64(b64)
            setBusy(true)
            try {
                const prev = await window.api?.imports.preview?.({ fileBase64: b64 })
                if (prev) {
                    setHeaders(prev.headers)
                    setSample(prev.sample as any)
                    setMapping(prev.suggestedMapping)
                    setHeaderRowIndex((prev as any).headerRowIndex ?? null)
                }
            } finally { setBusy(false) }
        } catch (e: any) {
            setError('Datei konnte nicht gelesen werden: ' + (e?.message || String(e)))
        }
    }
    async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        if (!f) return
        await processFile(f)
    }
    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault(); e.stopPropagation()
        const f = e.dataTransfer?.files?.[0]
        if (f) processFile(f)
    }

    async function onImport() {
        setError('')
        if (!base64) { setError('Bitte zuerst eine XLSX-Datei auswählen.'); return }
        setBusy(true)
        try {
            const res = await window.api?.imports.execute?.({ fileBase64: base64, mapping })
            if (res) {
                setResult(res)
                // let app know data changed
                window.dispatchEvent(new Event('data-changed'))
            }
        } catch (e: any) {
            setResult(null)
            setError('Import fehlgeschlagen: ' + (e?.message || String(e)))
        } finally { setBusy(false) }
    }

    const fieldKeys: Array<{ key: string; label: string; required?: boolean; enumValues?: string[] }> = [
        { key: 'date', label: 'Datum', required: true },
        { key: 'type', label: 'Art (IN/OUT/TRANSFER)' },
        { key: 'sphere', label: 'Sphäre (IDEELL/ZWECK/VERMOEGEN/WGB)', required: true },
        { key: 'description', label: 'Beschreibung' },
        { key: 'paymentMethod', label: 'Zahlweg (BAR/BANK)' },
        { key: 'netAmount', label: 'Netto' },
        { key: 'vatRate', label: 'USt %' },
        { key: 'grossAmount', label: 'Brutto' },
        { key: 'inGross', label: 'Einnahmen (Brutto)' },
        { key: 'outGross', label: 'Ausgaben (Brutto)' },
        { key: 'earmarkCode', label: 'Zweckbindung-Code' },
        { key: 'bankIn', label: 'Bankkonto + (Einnahmen)' },
        { key: 'bankOut', label: 'Bankkonto - (Ausgaben)' },
        { key: 'cashIn', label: 'Barkonto + (Einnahmen)' },
        { key: 'cashOut', label: 'Barkonto - (Ausgaben)' },
        { key: 'defaultSphere', label: 'Standard-Sphäre (Fallback)', enumValues: ['IDEELL', 'ZWECK', 'VERMOEGEN', 'WGB'] }
    ]

    // Helper to render a single mapping field with label and select
    const Field = ({ keyName, tooltip }: { keyName: string; tooltip?: string }) => {
        const f = fieldKeys.find(k => k.key === keyName)!
        const current = mapping[f.key] || ''
        const requiredMark = f.required ? ' *' : ''
        return (
            <label key={f.key} title={tooltip} className="field-row">
                <span className="field-label">
                    {f.label}{requiredMark}
                </span>
                {f.enumValues ? (
                    <select className="input" value={current} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}>
                        {f.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                ) : (
                    <select className="input" value={current} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}>
                        <option value="">— nicht zuordnen —</option>
                        {headers.map(h => <option key={h} value={h}>{h || '(leer)'}</option>)}
                    </select>
                )}
            </label>
        )
    }

    return (
        <div className="card" style={{ padding: 12 }}>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
            <div
                className="input"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={onDrop}
                style={{
                    marginTop: 4,
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderRadius: 12,
                    border: '1px dashed var(--border)'
                }}
                title="Datei hier ablegen oder auswählen"
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Datei auswählen</button>
                    <span className="helper">{fileName || 'Keine ausgewählt'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={async () => {
                        try {
                            const res = await window.api?.imports.template?.()
                            if (res) {
                                setError('')
                                setResult(null)
                                alert(`Vorlage gespeichert unter: ${res.filePath}`)
                            }
                        } catch (e: any) {
                            const msg = e?.message || String(e)
                            if (msg && /abbruch/i.test(msg)) return // user canceled save dialog
                            setError('Vorlage konnte nicht erstellt werden: ' + msg)
                        }
                    }}>Vorlage herunterladen</button>
                    <button className="btn" onClick={async () => {
                        try {
                            const res = await window.api?.imports.testdata?.()
                            if (res) {
                                setError('')
                                setResult(null)
                                alert(`Testdatei gespeichert unter: ${res.filePath}`)
                            }
                        } catch (e: any) {
                            const msg = e?.message || String(e)
                            if (msg && /abbruch/i.test(msg)) return
                            setError('Testdatei konnte nicht erstellt werden: ' + msg)
                        }
                    }}>Testdatei erzeugen</button>
                    {/* Import-Button wandert nach unten, erscheint erst nach geladener Vorschau */}
                </div>
            </div>
            {busy && <div style={{ marginTop: 8 }}>Lade …</div>}
            {error && <div style={{ marginTop: 8, color: 'var(--danger)' }}>{error}</div>}
            {headers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>Zuordnung</strong>
                        <details>
                            <summary className="chip" title="Hinweise zur Datei-Struktur">ⓘ</summary>
                            <div className="helper" style={{ marginTop: 6 }}>
                                <ul style={{ margin: '4px 0 0 16px' }}>
                                    <li>Beste Lesbarkeit: Kopfzeile in Zeile 1, Daten ab Zeile 2.</li>
                                    <li>Erkannte Kopfzeile: Zeile {headerRowIndex || 1}.</li>
                                    <li>Keine zusammengeführten Zellen oder Leerzeilen im Kopfbereich.</li>
                                    <li>Ein Datensatz pro Zeile. Summen-/Saldo-Zeilen werden automatisch ignoriert.</li>
                                    <li>Mindestens Datum und ein Betrag (Brutto oder Netto+USt). Optional: Art (IN/OUT/TRANSFER), Sphäre, Zweckbindung, Zahlweg.</li>
                                    <li>Tipp: Nutze „Vorlage herunterladen“ bzw. „Testdatei erzeugen“ als Referenz.</li>
                                </ul>
                            </div>
                        </details>
                    </div>
                    <div className="helper">Ordne die Felder den Spaltenüberschriften deiner Datei zu.</div>
                    <div className="group-grid" style={{ marginTop: 8 }}>
                        <div className="field-group fg-meta">
                            <div className="group-title">📋 Basisdaten</div>
                            <Field keyName="date" tooltip="Datum der Buchung" />
                            <Field keyName="description" tooltip="Beschreibung / Verwendungszweck" />
                            <Field keyName="type" tooltip="Art der Buchung: Einnahme (IN), Ausgabe (OUT), Umbuchung (TRANSFER)" />
                            <Field keyName="sphere" tooltip="Sphäre aus der Datei. Wenn leer, wird die Standard-Sphäre genutzt." />
                            <Field keyName="earmarkCode" tooltip="Zweckbindung als Code/Abkürzung" />
                        </div>
                        <div className="field-group fg-amounts">
                            <div className="group-title">💶 Beträge</div>
                            <Field keyName="netAmount" tooltip="Netto-Betrag" />
                            <Field keyName="vatRate" tooltip="Umsatzsteuersatz in Prozent" />
                            <Field keyName="grossAmount" tooltip="Brutto-Betrag" />
                            <Field keyName="inGross" tooltip="Einnahmen (Brutto) – alternative Spalte" />
                            <Field keyName="outGross" tooltip="Ausgaben (Brutto) – alternative Spalte" />
                        </div>
                        <div className="field-group fg-payment">
                            <div className="group-title">💳 Zahlungsart</div>
                            <Field keyName="paymentMethod" tooltip="Zahlweg: BAR oder BANK" />
                        </div>
                        <div className="field-group fg-accounts">
                            <div className="group-title">🏦 Kontenspalten</div>
                            <Field keyName="bankIn" tooltip="Bankkonto Einnahmen (+)" />
                            <Field keyName="bankOut" tooltip="Bankkonto Ausgaben (-)" />
                            <Field keyName="cashIn" tooltip="Barkonto Einnahmen (+)" />
                            <Field keyName="cashOut" tooltip="Barkonto Ausgaben (-)" />
                        </div>
                        <div className="field-group fg-defaults">
                            <div className="group-title">⚙️ Standardwerte</div>
                            <div className="field-row" style={{ alignItems: 'center' }}>
                                <Field keyName="defaultSphere" tooltip="Fallback Sphäre, wenn keine Sphäre-Spalte zugeordnet ist" />
                                <span className="badge badge-default" title="Wird verwendet, wenn keine Sphäre-Spalte gewählt ist">Fallback</span>
                            </div>
                        </div>
                    </div>
                    <details className="mapping-summary" style={{ marginTop: 8 }}>
                        <summary>Zuordnungsübersicht</summary>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                            {fieldKeys.map(f => (
                                <div key={f.key} className="pair">
                                    <span className="k">{f.label}</span>
                                    <span className="v">{mapping[f.key] || '—'}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                    <div className="helper" style={{ marginTop: 6 }}>
                        Hinweise:
                        <ul style={{ margin: '4px 0 0 16px' }}>
                            <li>Entweder Netto+USt oder Brutto muss zugeordnet sein – oder nutze die vier Spalten Bankkonto+/-, Barkonto+/-. Bei letzteren werden automatisch mehrere Buchungen je Zeile erzeugt.</li>
                            <li>„Standard-Sphäre“ wird verwendet, wenn keine Sphäre-Spalte vorhanden ist.</li>
                            <li>Summenzeilen wie „Ergebnis/Summe/Saldo“ werden automatisch übersprungen.</li>
                        </ul>
                    </div>
                </div>
            )}
            {/* Bottom-only Import button, shown once headers/preview are available */}
            {headers.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn" onClick={onImport} disabled={!base64 || busy}>Import starten</button>
                </div>
            )}
            {sample.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <strong>Vorschau (erste 20 Zeilen)</strong>
                    <div style={{ overflowX: 'auto', marginTop: 6 }}>
                        <table cellPadding={6}>
                            <thead>
                                <tr>
                                    {headers.map(h => <th key={h} align="left">{h || '(leer)'}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {sample.map((row, i) => {
                                    // If we have a recent result, color-code by status: green for imported, dim/red for skipped/errors.
                                    const st = result?.rowStatuses?.find(rs => rs.row === ((headerRowIndex || 1) + 1 + i))
                                    const bg = st ? (st.ok ? 'color-mix(in oklab, var(--success) 12%, transparent)' : 'color-mix(in oklab, var(--danger) 10%, transparent)') : undefined
                                    const title = st?.message
                                    return (
                                        <tr key={i} style={{ background: bg }} title={title}>
                                            {headers.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {result && (
                <div className="card" style={{ marginTop: 8, padding: 10 }}>
                    <strong>Ergebnis</strong>
                    <div className="helper">Importiert: {result.imported} | Übersprungen: {result.skipped}</div>
                    {result.errors?.length ? (
                        <details style={{ marginTop: 6 }}>
                            <summary>Fehlerdetails anzeigen ({result.errors.length})</summary>
                            <ul style={{ marginTop: 6 }}>
                                {result.errors.slice(0, 20).map((e, idx) => (
                                    <li key={idx}>Zeile {e.row}: {e.message}</li>
                                ))}
                                {result.errors.length > 20 && (
                                    <li>… weitere {result.errors.length - 20} Fehler</li>
                                )}
                            </ul>
                        </details>
                    ) : null}
                </div>
            )}
        </div>
    )
}
// Simple drag-and-drop order list for columns
function DnDOrder({ order, cols, onChange }: { order: string[]; cols: Record<string, boolean>; onChange: (o: string[]) => void }) {
    const dragIndex = useRef<number | null>(null)
    function onDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
        dragIndex.current = idx
        e.dataTransfer.effectAllowed = 'move'
    }
    function onDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }
    function onDrop(e: React.DragEvent<HTMLDivElement>, idx: number) {
        e.preventDefault()
        const from = dragIndex.current
        dragIndex.current = null
        if (from == null || from === idx) return
        const next = order.slice()
        const [moved] = next.splice(from, 1)
        next.splice(idx, 0, moved)
        onChange(next)
    }
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {order.map((k, idx) => {
                const visible = !!cols[k]
                return (
                    <div
                        key={k}
                        draggable
                        onDragStart={(e) => onDragStart(e, idx)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, idx)}
                        title={visible ? 'Sichtbar' : 'Ausgeblendet – Reihenfolge bleibt erhalten'}
                        style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: visible ? 'var(--surface)' : 'color-mix(in oklab, var(--surface) 60%, transparent)',
                            opacity: visible ? 1 : 0.6,
                            cursor: 'grab',
                            userSelect: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <span aria-hidden>☰</span>
                        <span>{k}</span>
                    </div>
                )
            })}
        </div>
    )
}

function ReceiptsView() {
    const [rows, setRows] = useState<Array<{ id: number; voucherNo: string; date: string; description?: string | null; fileCount?: number }>>([])
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(20)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [attachmentsModal, setAttachmentsModal] = useState<null | { voucherId: number; voucherNo: string; date: string; description: string }>(null)

    async function load() {
        setLoading(true)
        try {
            const res = await window.api?.vouchers.list?.({ limit, offset: (page - 1) * limit, sort: 'DESC' })
            if (res) {
                const withFiles = res.rows.filter(r => (r.fileCount || 0) > 0)
                setRows(withFiles.map(r => ({ id: r.id, voucherNo: r.voucherNo, date: r.date, description: r.description || '', fileCount: r.fileCount || 0 })))
                setTotal(res.total)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [page, limit])

    // AttachmentsModal handles listing, preview and download

    return (
        <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Belege</strong>
                <div className="helper">Buchungen mit angehängten Dateien</div>
            </div>
            {loading && <div>Lade …</div>}
            {!loading && (
                <table cellPadding={6} style={{ marginTop: 8, width: '100%' }}>
                    <thead>
                        <tr>
                            <th align="left">Datum</th>
                            <th align="left">Nr.</th>
                            <th align="left">Beschreibung</th>
                            <th align="center">Belege</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id}>
                                <td>{r.date}</td>
                                <td>{r.voucherNo}</td>
                                <td>{r.description}</td>
                                <td align="center">
                                    <button
                                        className="btn"
                                        onClick={() => setAttachmentsModal({ voucherId: r.id, voucherNo: r.voucherNo, date: r.date, description: r.description || '' })}
                                        title="Belege anzeigen"
                                    >📎 {r.fileCount}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {attachmentsModal && (
                <AttachmentsModal
                    voucher={attachmentsModal}
                    onClose={() => setAttachmentsModal(null)}
                />
            )}
        </div>
    )
}

function AttachmentsModal({ voucher, onClose }: { voucher: { voucherId: number; voucherNo: string; date: string; description: string }; onClose: () => void }) {
    const [files, setFiles] = useState<Array<{ id: number; fileName: string; mimeType?: string | null }>>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string>('')

    useEffect(() => {
        let alive = true
        setLoading(true); setError('')
        window.api?.attachments.list?.({ voucherId: voucher.voucherId })
            .then(res => {
                if (!alive) return
                const rows = res?.files || []
                setFiles(rows)
                setSelectedId(rows[0]?.id ?? null)
            })
            .catch(e => setError(e?.message || String(e)))
            .finally(() => { if (alive) setLoading(false) })
        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => { alive = false; window.removeEventListener('keydown', onKey) }
    }, [voucher.voucherId])

    async function refreshPreview(id: number | null) {
        setPreviewUrl('')
        if (id == null) return
        const f = files.find(x => x.id === id)
        if (!f) return
        const name = f.fileName || ''
        const mt = (f.mimeType || '').toLowerCase()
        const isImg = mt.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(name)
        if (!isImg) return
        try {
            const res = await window.api?.attachments.read?.({ fileId: id })
            if (res) setPreviewUrl(`data:${res.mimeType || 'image/*'};base64,${res.dataBase64}`)
        } catch (e: any) {
            setError('Vorschau nicht möglich: ' + (e?.message || String(e)))
        }
    }

    useEffect(() => { refreshPreview(selectedId) }, [selectedId])

    const selected = files.find(f => f.id === selectedId) || null

    return createPortal(
        <div
            className="modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                background: 'color-mix(in oklab, var(--surface) 65%, transparent)',
                padding: '24px 16px', zIndex: 9999, overflowY: 'auto'
            }}
        >
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ width: 'min(980px, 96vw)', maxHeight: '92vh', overflow: 'hidden', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', background: 'var(--surface)' }}
            >
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ overflow: 'hidden' }}>
                        <h2 style={{ margin: 0, fontSize: 16 }}>Belege zu #{voucher.voucherNo} – {voucher.date}</h2>
                        <div className="helper" title={voucher.description} style={{ maxWidth: '75ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voucher.description || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn danger" onClick={onClose}>Schließen</button>
                        <button className="btn" disabled={!selected} onClick={() => selected && window.api?.attachments.open?.({ fileId: selected.id })}>Extern öffnen</button>
                        <button
                            className="btn"
                            disabled={!selected}
                            onClick={async () => {
                                if (!selected) return
                                try {
                                    const r = await window.api?.attachments.saveAs?.({ fileId: selected.id })
                                    if (r) alert('Gespeichert: ' + r.filePath)
                                } catch (e: any) {
                                    const m = e?.message || String(e)
                                    if (/Abbruch/i.test(m)) return
                                    alert('Speichern fehlgeschlagen: ' + m)
                                }
                            }}
                        >Herunterladen</button>
                    </div>
                </header>
                {error && <div style={{ color: 'var(--danger)', margin: '0 8px 8px' }}>{error}</div>}
                {loading && <div style={{ margin: '0 8px 8px' }}>Lade …</div>}
                {!loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: 12, minHeight: 320, padding: 8, boxSizing: 'border-box' }}>
                        <div className="card" style={{ padding: 8, overflow: 'auto', maxHeight: 'calc(92vh - 120px)' }}>
                            {files.length === 0 && <div className="helper">Keine Dateien vorhanden</div>}
                            {files.map(f => (
                                <button key={f.id} className="btn" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, background: selectedId === f.id ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }} onClick={() => setSelectedId(f.id)}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                                </button>
                            ))}
                        </div>
                        <div className="card" style={{ padding: 8, display: 'grid', placeItems: 'center', background: 'var(--muted)', maxHeight: 'calc(92vh - 120px)', overflow: 'auto' }}>
                            {selected && previewUrl && (
                                <img src={previewUrl} alt={selected.fileName} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }} />
                            )}
                            {selected && !previewUrl && (
                                <div className="helper">Keine Vorschau verfügbar. Nutze „Extern öffnen“ oder „Herunterladen“.</div>
                            )}
                            {!selected && <div className="helper">Wähle eine Datei links aus.</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}

// DomDebugger removed for release