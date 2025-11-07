/*
Backup of inline InvoicesView (and related bits) extracted from src/renderer/App.tsx.
This file is for reference only and is intentionally non-executable to avoid build interference.

----- BEGIN ORIGINAL SNIPPET -----
// Invoices list with filters, pagination, and basic actions (add payment / mark paid / delete)
function InvoicesView() {
    // Filters and pagination
    const [q, setQ] = useState<string>('')
    const [status, setStatus] = useState<'ALL' | 'OPEN' | 'PARTIAL' | 'PAID'>('ALL')
    const [sphere, setSphere] = useState<'' | 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'>('')
    const [dueFrom, setDueFrom] = useState<string>('')
    const [dueTo, setDueTo] = useState<string>('')
    const [budgetId, setBudgetId] = useState<number | ''>('')
    const [tag, setTag] = useState<string>('')
    const [limit, setLimit] = useState<number>(20)
    const [offset, setOffset] = useState<number>(0)
    const [total, setTotal] = useState<number>(0)
    const [summary, setSummary] = useState<{ count: number; gross: number; paid: number; remaining: number } | null>(null)
    // Sorting (persist to localStorage)
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(() => { try { return ((localStorage.getItem('invoices.sort') as 'ASC' | 'DESC') || 'ASC') } catch { return 'ASC' } })
    const [sortBy, setSortBy] = useState<'date' | 'due' | 'amount'>(() => { try { return ((localStorage.getItem('invoices.sortBy') as 'date' | 'due' | 'amount') || 'due') } catch { return 'due' } })
    // Due date modal state and available years
    const [showDueFilter, setShowDueFilter] = useState<boolean>(false)
    const [yearsAvail, setYearsAvail] = useState<number[]>([])

    // Data
    const [loading, setLoading] = useState<boolean>(true)
    const [rows, setRows] = useState<any[]>([])
    const [error, setError] = useState<string>('')
    const [tags, setTags] = useState<Array<{ id: number; name: string; color?: string | null }>>([])
    const [budgets, setBudgets] = useState<Array<{ id: number; name?: string | null; year: number }>>([])
    const [earmarks, setEarmarks] = useState<Array<{ id: number; code: string; name: string; color?: string | null }>>([])

    // Currency/date formatters (respect global date preference if set)
    const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    const dateFmtPref = useMemo(() => {
        try { return (localStorage.getItem('ui.dateFmt') as 'ISO' | 'PRETTY') || 'ISO' } catch { return 'ISO' }
    }, [])
    const fmtDateLocal = useMemo(() => {
        const pretty = (s?: string) => {
            if (!s) return ''
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
            if (!m) return s || ''
            const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
            const dt = new Date(Date.UTC(y, mo - 1, d))
            const mon = dt.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
            const dd = String(d).padStart(2, '0')
            return `${dd} ${mon} ${y}`
        }
        return (s?: string) => dateFmtPref === 'PRETTY' ? pretty(s) : (s || '')
    }, [dateFmtPref])

    // Debounce search
    const [qDebounced, setQDebounced] = useState('')
    useEffect(() => {
        const t = setTimeout(() => setQDebounced(q.trim()), 250)
        return () => clearTimeout(t)
    }, [q])

    // Load tags, budgets, earmarks (for filters/forms)
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const t = await window.api?.tags?.list?.({})
                if (!cancelled) setTags((t?.rows || []).map(r => ({ id: r.id, name: r.name, color: r.color ?? null })))
            } catch { }
            try {
                const b = await window.api?.budgets?.list?.({})
                if (!cancelled) setBudgets((b?.rows || []).map(r => ({ id: r.id, name: r.name || r.categoryName || r.projectName || undefined, year: r.year })))
            } catch { }
            try {
                const em = await window.api?.bindings?.list?.({ activeOnly: true })
                if (!cancelled) setEarmarks((em?.rows || []).map(r => ({ id: r.id, code: r.code, name: r.name, color: r.color ?? null })))
            } catch { }
            try {
                const y = await window.api?.reports?.years?.()
                if (!cancelled && y?.years) setYearsAvail(y.years)
            } catch { }
        })()
        return () => { cancelled = true }
    }, [])

    const [flashId, setFlashId] = useState<number | null>(null)

    async function load() { // omitted }
    async function loadSummary() { // omitted }
    useEffect(() => { load() }, [limit, offset, status, sphere, budgetId, qDebounced, dueFrom, dueTo, tag, sortDir, sortBy])
    useEffect(() => { loadSummary() }, [status, sphere, budgetId, qDebounced, dueFrom, dueTo, tag])
    useEffect(() => { const onChanged = () => { loadSummary() }; try { window.addEventListener('data-changed', onChanged) } catch {}; return () => { try { window.removeEventListener('data-changed', onChanged) } catch {} } }, [status, sphere, budgetId, qDebounced, dueFrom, dueTo, tag])
    useEffect(() => { try { localStorage.setItem('invoices.sort', sortDir) } catch {} }, [sortDir])
    useEffect(() => { try { localStorage.setItem('invoices.sortBy', sortBy) } catch {} }, [sortBy])

    function clearFilters() { // omitted }

    // Inline actions, detail modal, create/edit modal, etc...
    // [Full content preserved in original App.tsx; omitted here to keep backup light]

    return (<div>[omitted]</div>)
}
----- END ORIGINAL SNIPPET -----

*/

export {}
