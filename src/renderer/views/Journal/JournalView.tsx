import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import FilterTotals from './components/FilterTotals'
import JournalTable from './components/JournalTable'
import VoucherInfoModal from '../../components/modals/VoucherInfoModal'
import TagsEditor from '../../components/TagsEditor'
import { TimeFilterDropdown, MetaFilterDropdown, BatchAssignDropdown, ColumnSelectDropdown } from '../../components/dropdowns'
import { useModules } from '../../context/moduleHooks'
import { useAuth } from '../../context/authHooks'

// Type für Voucher-Zeilen
type BudgetAssignment = { id?: number; budgetId: number; amount: number; label?: string }
type EarmarkAssignment = { id?: number; earmarkId: number; amount: number; code?: string; name?: string }

type VoucherRow = {
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
    hasFiles?: boolean
    earmarkId?: number | null
    earmarkCode?: string | null
    earmarkAmount?: number | null
    budgetId?: number | null
    budgetLabel?: string | null
    budgetAmount?: number | null
    budgetColor?: string | null
    fileCount?: number
    tags?: string[]
    // Multiple assignments
    budgets?: BudgetAssignment[]
    earmarksAssigned?: EarmarkAssignment[]

    // Taxonomy term badges (for table display)
    taxonomyTerms?: Array<{ taxonomyId: number; taxonomyName: string; termId: number; termName: string; termColor?: string | null }>
}

type BudgetUsageInfo = {
    planned: number
    spent: number
    inflow: number
    remaining: number
    percent: number
    color?: string | null
}

type ColKey = 'actions' | 'date' | 'voucherNo' | 'type' | 'sphere' | 'description' | 'earmark' | 'budget' | 'paymentMethod' | 'attachments' | 'net' | 'vat' | 'gross'

interface JournalViewProps {
    // Props die von App.tsx kommen
    flashId: number | null
    setFlashId: (id: number | null | ((prev: number | null) => number | null)) => void
    periodLock: { closedUntil: string } | null
    refreshKey: number
    notify: (type: 'info' | 'success' | 'error', text: string, duration?: number, action?: { label: string; onClick: () => void }) => void
    bumpDataVersion: () => void
    fmtDate: (d: string) => string
    setActivePage: (page: 'Dashboard' | 'Buchungen' | 'Zweckbindungen' | 'Budgets' | 'Reports' | 'Belege' | 'Verbindlichkeiten' | 'Mitglieder' | 'Einstellungen') => void
    // Deprecated: kept for compatibility but dropdowns are now inline
    setShowTimeFilter?: (show: boolean) => void
    setShowMetaFilter?: (show: boolean) => void
    // Dropdown filter data
    yearsAvail: number[]
    budgets: Array<{ id: number; year: number; name?: string | null; categoryName?: string | null; projectName?: string | null }>
    categories: Array<{ id: number; name: string; color?: string | null }>
    onTimeFilterChange: (from: string, to: string) => void
    // Shared global state
    earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
    tagDefs: Array<{ id: number; name: string; color?: string | null; usage?: number }>
    budgetsForEdit: Array<{ id: number; label: string }>
    budgetNames: Map<number, string>
    // Helpers
    eurFmt: Intl.NumberFormat
    friendlyError: (e: any) => string
    bufferToBase64Safe: (buf: ArrayBuffer) => string
    // Settings from App
    journalLimit: number
    setJournalLimit: (n: number) => void
    dateFmt: 'ISO' | 'PRETTY'
    // Column visibility & order (shared with Settings)
    cols: Record<ColKey, boolean>
    setCols: (cols: Record<ColKey, boolean>) => void
    order: ColKey[]
    setOrder: (order: ColKey[]) => void
    labelForCol: (k: string) => string
    // Filter states from App
    from?: string
    to?: string
    filterSphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' | null
    filterCategoryId?: number | null
    filterType?: 'IN' | 'OUT' | 'TRANSFER' | null
    filterPM?: 'BAR' | 'BANK' | null
    filterEarmark?: number | null
    filterBudgetId?: number | null
    filterTag?: string | null
    q?: string
    setFrom?: (v: string) => void
    setTo?: (v: string) => void
    clearTimeFilter?: () => void
    setFilterSphere?: (v: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' | null) => void
    setFilterCategoryId?: (v: number | null) => void
    setFilterType?: (v: 'IN' | 'OUT' | 'TRANSFER' | null) => void
    setFilterPM?: (v: 'BAR' | 'BANK' | null) => void
    setFilterEarmark?: (v: number | null) => void
    setFilterBudgetId?: (v: number | null) => void
    setFilterTag?: (v: string | null) => void
    setQ?: (v: string) => void
    page?: number
    setPage?: (v: number) => void
    // Archive mode (server-side filtering)
    workYear?: number
    showArchived?: boolean
    archiveSettingsReady?: boolean
}

export default function JournalView({
    flashId,
    setFlashId,
    periodLock,
    refreshKey,
    notify,
    bumpDataVersion,
    fmtDate,
    setActivePage,
    // Deprecated modal triggers (kept for compatibility)
    setShowTimeFilter: _setShowTimeFilter,
    setShowMetaFilter: _setShowMetaFilter,
    // Dropdown data
    yearsAvail,
    budgets,
    categories,
    onTimeFilterChange,
    earmarks,
    tagDefs,
    budgetsForEdit,
    budgetNames,
    eurFmt,
    friendlyError,
    bufferToBase64Safe,
    journalLimit: journalLimitProp,
    setJournalLimit: setJournalLimitProp,
    dateFmt,
    // Column visibility & order from App
    cols,
    setCols,
    order,
    setOrder,
    labelForCol,
    // Filter props from App
    from: fromProp,
    to: toProp,
    filterSphere: filterSphereProp,
    filterCategoryId: filterCategoryIdProp,
    filterType: filterTypeProp,
    filterPM: filterPMProp,
    filterEarmark: filterEarmarkProp,
    filterBudgetId: filterBudgetIdProp,
    filterTag: filterTagProp,
    q: qProp,
    setFrom: setFromProp,
    setTo: setToProp,
    clearTimeFilter,
    setFilterSphere: setFilterSphereProp,
    setFilterCategoryId: setFilterCategoryIdProp,
    setFilterType: setFilterTypeProp,
    setFilterPM: setFilterPMProp,
    setFilterEarmark: setFilterEarmarkProp,
    setFilterBudgetId: setFilterBudgetIdProp,
    setFilterTag: setFilterTagProp,
    setQ: setQProp,
    page: pageProp,
    setPage: setPageProp,
    // Archive mode
    workYear,
    showArchived,
    archiveSettingsReady
}: JournalViewProps) {
    const { authEnforced, isAuthenticated, canWrite } = useAuth()
    const allowData = !authEnforced || isAuthenticated
    // ==================== STATE ====================
    // Pagination & Sorting
    const [rows, setRows] = useState<VoucherRow[]>([])
    const [totalRows, setTotalRows] = useState<number>(0)
    const [page, setPage] = useState<number>(() => { 
        try { return Number(localStorage.getItem('journal.page') || '1') } 
        catch { return 1 } 
    })
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(() => { 
        try { return (localStorage.getItem('journal.sort') as any) || 'DESC' } 
        catch { return 'DESC' } 
    })
    const [sortBy, setSortBy] = useState<'date' | 'gross' | 'net' | 'budget' | 'earmark' | 'payment' | 'sphere'>(() => { 
        try { return (localStorage.getItem('journal.sortBy') as any) || 'date' } 
        catch { return 'date' } 
    })
    
    // Nutze journalLimit aus Props (von Settings)
    const journalLimit = journalLimitProp

    // Filter states - use from props if available, otherwise local state
    const [from, setFrom] = useState<string>('')
    const [to, setTo] = useState<string>('')
    const [filterSphere, setFilterSphere] = useState<'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB' | null>(null)
    const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null)
    const [filterType, setFilterType] = useState<'IN' | 'OUT' | 'TRANSFER' | null>(null)
    const [filterPM, setFilterPM] = useState<'BAR' | 'BANK' | null>(null)
    const [filterEarmark, setFilterEarmark] = useState<number | null>(null)
    const [filterBudgetId, setFilterBudgetId] = useState<number | null>(null)
    const [filterTag, setFilterTag] = useState<string | null>(null)
    const [filterTaxonomyTerm, setFilterTaxonomyTerm] = useState<null | { termId: number; taxonomyName?: string; termName?: string }>(null)
    const [q, setQ] = useState<string>('')
    
    // Use props if provided, otherwise use local state
    const activeFrom = fromProp !== undefined ? fromProp : from
    const activeTo = toProp !== undefined ? toProp : to
    const activeFilterSphere = filterSphereProp !== undefined ? filterSphereProp : filterSphere
    const activeFilterCategoryId = filterCategoryIdProp !== undefined ? filterCategoryIdProp : filterCategoryId
    const activeFilterType = filterTypeProp !== undefined ? filterTypeProp : filterType
    const activeFilterPM = filterPMProp !== undefined ? filterPMProp : filterPM
    const activeFilterEarmark = filterEarmarkProp !== undefined ? filterEarmarkProp : filterEarmark
    const activeFilterBudgetId = filterBudgetIdProp !== undefined ? filterBudgetIdProp : filterBudgetId
    const activeFilterTag = filterTagProp !== undefined ? filterTagProp : filterTag
    const activeFilterTaxonomyTerm = filterTaxonomyTerm
    const activeQ = qProp !== undefined ? qProp : q
    const activePage = pageProp !== undefined ? pageProp : page
    
    // Setters that use props if available
    const activeSetFrom = setFromProp || setFrom
    const activeSetTo = setToProp || setTo
    const activeSetFilterSphere = setFilterSphereProp || setFilterSphere
    const activeSetFilterCategoryId = setFilterCategoryIdProp || setFilterCategoryId
    const activeSetFilterType = setFilterTypeProp || setFilterType
    const activeSetFilterPM = setFilterPMProp || setFilterPM
    const activeSetFilterEarmark = setFilterEarmarkProp || setFilterEarmark
    const activeSetFilterBudgetId = setFilterBudgetIdProp || setFilterBudgetId
    const activeSetFilterTag = setFilterTagProp || setFilterTag
    const activeSetQ = setQProp || setQ
    const activeSetPage = setPageProp || setPage

    // Column preferences now come from props (shared with Settings)

    // Modal states
    const [infoVoucher, setInfoVoucher] = useState<VoucherRow | null>(null)
    const [editRow, setEditRow] = useState<(VoucherRow & { mode?: 'NET' | 'GROSS'; transferFrom?: 'BAR' | 'BANK' | null; transferTo?: 'BAR' | 'BANK' | null }) | null>(null)
    const [deleteRow, setDeleteRow] = useState<null | { id: number; voucherNo?: string | null; description?: string | null; fromEdit?: boolean }>(null)
    const editFileInputRef = useRef<HTMLInputElement | null>(null)
    const [editRowFilesLoading, setEditRowFilesLoading] = useState<boolean>(false)
    const [editRowFiles, setEditRowFiles] = useState<Array<{ id: number; fileName: string }>>([])

    // ==================== TAXONOMIES (Voucher Edit Modal) ====================
    const [taxonomiesForEdit, setTaxonomiesForEdit] = useState<Array<{ id: number; name: string }>>([])
    const [taxonomyTermsById, setTaxonomyTermsById] = useState<Record<number, Array<{ id: number; name: string }>>>({})
    const [taxonomySelectionById, setTaxonomySelectionById] = useState<Record<number, number | ''>>({})
    const [loadingTaxonomiesForEdit, setLoadingTaxonomiesForEdit] = useState<boolean>(false)

    // Readonly UX: never keep edit modal open
    useEffect(() => {
        if (editRow && !canWrite) setEditRow(null)
    }, [editRow, canWrite])
    const [confirmDeleteAttachment, setConfirmDeleteAttachment] = useState<null | { id: number; fileName: string; voucherId: number }>(null)

    // ==================== CUSTOM CATEGORIES ====================
    const { isModuleEnabled } = useModules()
    const useCategoriesModule = isModuleEnabled('custom-categories')
    const [customCategories, setCustomCategories] = useState<Array<{ id: number; name: string; color?: string | null }>>([])
    const categoryMap = useMemo(() => {
        const map = new Map<number, { id: number; name: string; color?: string | null }>()
        const list = Array.isArray(customCategories) ? customCategories : []
        list.forEach((c) => map.set(c.id, c))
        return map
    }, [customCategories])
    
    useEffect(() => {
        if (!useCategoriesModule) return
        const loadCategories = () => {
            ;(window as any).api?.customCategories?.list?.()?.then((cats: any) => {
                const fromCategories = Array.isArray(cats?.categories) ? cats.categories : null
                const fromRows = Array.isArray(cats?.rows) ? cats.rows : null
                const list = Array.isArray(cats) ? cats : fromCategories || fromRows || []
                setCustomCategories(list)
            })
        }
        loadCategories()
        window.addEventListener('data-changed', loadCategories)
        return () => window.removeEventListener('data-changed', loadCategories)
    }, [useCategoriesModule])

    // ==================== BUDGET LOOKUPS ====================
    const [budgetMeta, setBudgetMeta] = useState<Record<number, { planned: number; color?: string | null; label?: string }>>({})
    const [budgetUsage, setBudgetUsage] = useState<Record<number, BudgetUsageInfo>>({})

    // ==================== EARMARK USAGE LOOKUPS ====================
    type EarmarkUsageInfo = { allocated: number; released: number; balance: number; budget: number; remaining: number; percent: number; color?: string | null }
    const [earmarkUsage, setEarmarkUsage] = useState<Record<number, EarmarkUsageInfo>>({})

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.api?.budgets?.list?.({})
                if (res?.rows && !cancelled) {
                    const map: Record<number, { planned: number; color?: string | null; label?: string }> = {}
                    ;(res.rows as any[]).forEach((b) => {
                        if (!b?.id) return
                        map[b.id] = {
                            planned: Number(b.amountPlanned || 0),
                            color: b.color || null,
                            label: (b.name && String(b.name)) || (b.label && String(b.label)) || (b.categoryName && String(b.categoryName)) || `Budget ${b.year || ''}`.trim()
                        }
                    })
                    setBudgetMeta(map)
                }
            } catch { /* ignore */ }
        })()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        const ids = Array.from(
            new Set(
                rows
                    .flatMap((r: any) => {
                        const out: number[] = []
                        if (typeof r.budgetId === 'number') out.push(r.budgetId)
                        if (Array.isArray(r.budgets)) {
                            for (const b of r.budgets) {
                                const bid = Number((b as any)?.budgetId)
                                if (bid) out.push(bid)
                            }
                        }
                        return out
                    })
                    .filter((id) => typeof id === 'number' && Number.isFinite(id) && id > 0)
            )
        ).filter((id) => !budgetUsage[id])
        if (!ids.length) return

        let cancelled = false
        ;(async () => {
            const updates: Record<number, BudgetUsageInfo> = {}
            for (const id of ids) {
                try {
                    const u = await window.api?.budgets?.usage?.({ budgetId: id })
                    const meta = budgetMeta[id]
                    const planned = meta?.planned ?? Number((u as any)?.planned || (u as any)?.amountPlanned || 0)
                    const spent = Math.max(0, Number((u as any)?.spent || 0))
                    const inflow = Math.max(0, Number((u as any)?.inflow || 0))
                    const net = spent - inflow
                    const remaining = planned - net
                    const percent = planned > 0 ? Math.min(200, Math.max(0, Math.round((net / planned) * 1000) / 10)) : 0
                    updates[id] = { planned, spent, inflow, remaining, percent, color: meta?.color ?? (u as any)?.color ?? null }
                } catch {
                    const meta = budgetMeta[id]
                    updates[id] = { planned: meta?.planned ?? 0, spent: 0, inflow: 0, remaining: meta?.planned ?? 0, percent: 0, color: meta?.color ?? null }
                }
            }
            if (!cancelled && Object.keys(updates).length) setBudgetUsage(prev => ({ ...prev, ...updates }))
        })()
        return () => { cancelled = true }
    }, [rows, budgetMeta, budgetUsage])

    // Load earmark usage for visible rows
    useEffect(() => {
        const ids = Array.from(
            new Set(
                rows
                    .flatMap((r: any) => {
                        const out: number[] = []
                        if (typeof r.earmarkId === 'number') out.push(r.earmarkId)
                        if (Array.isArray(r.earmarksAssigned)) {
                            for (const e of r.earmarksAssigned) {
                                const eid = Number((e as any)?.earmarkId)
                                if (eid) out.push(eid)
                            }
                        }
                        return out
                    })
                    .filter((id) => typeof id === 'number' && Number.isFinite(id) && id > 0)
            )
        ).filter((id) => !earmarkUsage[id])
        if (!ids.length) return

        let cancelled = false
        ;(async () => {
            const updates: Record<number, EarmarkUsageInfo> = {}
            for (const id of ids) {
                try {
                    const u = await window.api?.bindings?.usage?.({ earmarkId: id })
                    const meta = earmarks.find(e => e.id === id)
                    const budget = Math.max(0, Number(u?.budget || 0))
                    const allocated = Math.max(0, Number(u?.allocated || 0))
                    const released = Math.max(0, Number(u?.released || 0))
                    const balance = Number(u?.balance || 0)
                    const remaining = Number(u?.remaining || (budget - allocated + released))
                    const percent = budget > 0 ? Math.min(200, Math.max(0, Math.round((allocated / budget) * 1000) / 10)) : 0
                    updates[id] = { allocated, released, balance, budget, remaining, percent, color: meta?.color ?? null }
                } catch {
                    updates[id] = { allocated: 0, released: 0, balance: 0, budget: 0, remaining: 0, percent: 0, color: null }
                }
            }
            if (!cancelled && Object.keys(updates).length) setEarmarkUsage(prev => ({ ...prev, ...updates }))
        })()
        return () => { cancelled = true }
    }, [rows, earmarks, earmarkUsage])

    // ==================== TAG COUNTS ====================
    // Use usage counts from tagDefs (loaded with includeUsage: true in App.tsx)
    // This ensures counts reflect ALL vouchers, not just current page
    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        tagDefs.forEach(tag => {
            if (tag.usage !== undefined) {
                counts[tag.name] = tag.usage
            }
        })
        return counts
    }, [tagDefs])

    // ==================== FILTER CHIPS ====================
    const chips = useMemo(() => {
        const list: Array<{ key: string; label: string; clear: () => void; color?: string | null }> = []
        if (activeFrom || activeTo) {
            const rangeLabel = (() => {
                if (activeFrom && activeTo) {
                    const fy = activeFrom.slice(0, 4)
                    const ty = activeTo.slice(0, 4)
                    if (activeFrom === `${fy}-01-01` && activeTo === `${fy}-12-31` && fy === ty) return fy
                }
                return `${activeFrom || '…'} – ${activeTo || '…'}`
            })()
            list.push({
                key: 'range',
                label: rangeLabel,
                clear: () => {
                    if (clearTimeFilter) {
                        clearTimeFilter()
                        return
                    }
                    activeSetFrom('')
                    activeSetTo('')
                }
            })
        }
        if (useCategoriesModule && activeFilterCategoryId != null) {
            const cat = categoryMap.get(activeFilterCategoryId)
            list.push({ key: 'category', label: `Kategorie: ${cat?.name || ('#' + activeFilterCategoryId)}`, clear: () => activeSetFilterCategoryId(null), color: cat?.color })
        } else if (activeFilterSphere) {
            list.push({ key: 'sphere', label: `Kategorie: ${activeFilterSphere}`, clear: () => activeSetFilterSphere(null) })
        }
        if (activeFilterType) list.push({ key: 'type', label: `Art: ${activeFilterType}`, clear: () => activeSetFilterType(null) })
        if (activeFilterPM) list.push({ key: 'pm', label: `Zahlweg: ${activeFilterPM}`, clear: () => activeSetFilterPM(null) })
        if (activeFilterEarmark != null) {
            const em = earmarks.find(e => e.id === activeFilterEarmark)
            list.push({ key: 'earmark', label: `Zweckbindung: ${em ? em.code : '#' + activeFilterEarmark}` , clear: () => activeSetFilterEarmark(null), color: em?.color })
        }
        if (activeFilterBudgetId != null) {
            const label = budgetNames.get(activeFilterBudgetId) || `#${activeFilterBudgetId}`
            const bud = budgets.find(b => b.id === activeFilterBudgetId)
            list.push({ key: 'budget', label: `Budget: ${label}`, clear: () => activeSetFilterBudgetId(null), color: (bud as any)?.color })
        }
        if (activeFilterTag) {
            const tagMeta = tagDefs.find(t => t.name === activeFilterTag)
            list.push({ key: 'tag', label: `Tag: ${activeFilterTag}`, clear: () => activeSetFilterTag(null), color: tagMeta?.color })
        }
        if (activeFilterTaxonomyTerm?.termId) {
            const label = activeFilterTaxonomyTerm.taxonomyName && activeFilterTaxonomyTerm.termName
                ? `Klassifizierung: ${activeFilterTaxonomyTerm.taxonomyName} = ${activeFilterTaxonomyTerm.termName}`
                : `Klassifizierung: #${activeFilterTaxonomyTerm.termId}`
            list.push({ key: 'taxonomyTerm', label, clear: () => setFilterTaxonomyTerm(null) })
        }
        if (activeQ) list.push({ key: 'q', label: `Suche: ${activeQ}`.slice(0, 40) + (activeQ.length > 40 ? '…' : ''), clear: () => activeSetQ('') })
        return list
    }, [activeFrom, activeTo, activeFilterSphere, activeFilterCategoryId, useCategoriesModule, categoryMap, activeFilterType, activeFilterPM, activeFilterEarmark, activeFilterBudgetId, activeFilterTag, activeFilterTaxonomyTerm, earmarks, budgetNames, activeQ, activeSetFilterCategoryId, activeSetFilterTag, activeSetQ, clearTimeFilter, activeSetFrom, activeSetTo, activeSetFilterSphere, activeSetFilterType, activeSetFilterPM, activeSetFilterEarmark, activeSetFilterBudgetId])

    // ==================== DATA LOADING ====================
    const loadRecent = useCallback(async () => {
        if (!allowData) return
        // Wait for archive settings to be ready before loading
        if (archiveSettingsReady === false) return
        try {
            const effectiveShowArchived = showArchived ?? false
            const offset = (activePage - 1) * journalLimit
            const res = await (window.api?.vouchers?.list as any)?.({
                limit: journalLimit,
                offset,
                sort: sortDir,
                sortBy,
                paymentMethod: activeFilterPM || undefined,
                sphere: activeFilterSphere || undefined,
                categoryId: useCategoriesModule ? (activeFilterCategoryId ?? undefined) : undefined,
                type: activeFilterType || undefined,
                from: activeFrom || undefined,
                to: activeTo || undefined,
                earmarkId: activeFilterEarmark || undefined,
                budgetId: activeFilterBudgetId || undefined,
                q: activeQ.trim() || undefined,
                tag: activeFilterTag || undefined,
                taxonomyTermId: activeFilterTaxonomyTerm?.termId || undefined,
                // Archive mode: server-side filtering
                workYear: effectiveShowArchived === false ? workYear : undefined,
                showArchived: effectiveShowArchived
            } as any)
            if (res) {
                const incoming: VoucherRow[] = (res.rows || []) as VoucherRow[]

                const enriched = incoming.map((row) => {
                    const budgetsRaw: unknown = (row as any).budgets
                    const earmarksRaw: unknown = (row as any).earmarksAssigned

                    const budgetsEnriched = Array.isArray(budgetsRaw)
                        ? (budgetsRaw as any[]).map((b) => ({
                            ...b,
                            label: b?.label || budgetNames.get(Number(b?.budgetId)) || undefined
                        }))
                        : budgetsRaw

                    const earmarksEnriched = Array.isArray(earmarksRaw)
                        ? (earmarksRaw as any[]).map((e) => {
                            const id = Number(e?.earmarkId)
                            const meta = earmarks.find((m) => m.id === id)
                            return {
                                ...e,
                                code: e?.code || meta?.code || undefined,
                                name: e?.name || meta?.name || undefined
                            }
                        })
                        : earmarksRaw

                    return {
                        ...row,
                        budgets: budgetsEnriched as any,
                        earmarksAssigned: earmarksEnriched as any
                    }
                })

                setRows(enriched)
                setTotalRows(res.total || 0)
            }
        } catch (e: any) {
            notify('error', 'Fehler beim Laden: ' + (e?.message || String(e)))
        }
    // Include refreshKey so external data changes (QuickAdd, imports, etc.) trigger a reload
    }, [allowData, journalLimit, activePage, sortDir, sortBy, activeFilterPM, activeFilterSphere, activeFilterCategoryId, useCategoriesModule, activeFilterType, activeFrom, activeTo, activeFilterEarmark, activeFilterBudgetId, activeQ, activeFilterTag, activeFilterTaxonomyTerm, notify, refreshKey, workYear, showArchived, archiveSettingsReady, budgetNames, earmarks])

    // Load on mount and filter changes
    useEffect(() => {
        loadRecent()
    }, [loadRecent])

    // Global refresh hint (e.g. network-mode "Änderungen" refresh)
    useEffect(() => {
        const onChanged = () => { void loadRecent() }
        try { window.addEventListener('data-changed', onChanged) } catch {}
        return () => { try { window.removeEventListener('data-changed', onChanged) } catch {} }
    }, [loadRecent])

    // Hydrate column prefs from server
    useEffect(() => {
        if (!allowData) return
        (async () => {
            try {
                const c = await window.api?.settings?.get?.({ key: 'journal.cols' })
                if (c?.value) {
                    const parsed = JSON.parse(String(c.value))
                    if (parsed && typeof parsed === 'object') setCols(parsed)
                }
                const o = await window.api?.settings?.get?.({ key: 'journal.order' })
                if (o?.value) {
                    const parsedO = JSON.parse(String(o.value))
                    if (Array.isArray(parsedO)) setOrder(parsedO as ColKey[])
                }
            } catch { /* ignore */ }
        })()
    }, [allowData])

    // Persist column prefs
    useEffect(() => {
        try { localStorage.setItem('journalCols', JSON.stringify(cols)) } catch { }
        if (!allowData) return
        try { window.api?.settings?.set?.({ key: 'journal.cols', value: JSON.stringify(cols) }) } catch { }
    }, [cols, allowData])
    useEffect(() => {
        try { localStorage.setItem('journalColsOrder', JSON.stringify(order)) } catch { }
        if (!allowData) return
        try { window.api?.settings?.set?.({ key: 'journal.order', value: JSON.stringify(order) }) } catch { }
    }, [order, allowData])

    // Load attachments when opening edit modal
    useEffect(() => {
        if (!allowData) return
        if (editRow?.id) {
            setEditRowFilesLoading(true)
            ;(async () => {
                try {
                    const res = await window.api?.attachments.list?.({ voucherId: editRow.id })
                    const list = (res as any)?.files || (res as any)?.rows || []
                    setEditRowFiles(list)
                } catch { setEditRowFiles([]) } finally { setEditRowFilesLoading(false) }
            })()
        } else {
            setEditRowFiles([])
        }
    }, [editRow?.id, allowData])

    // Load taxonomies + terms + current voucher assignments when opening edit modal
    useEffect(() => {
        if (!allowData || !editRow?.id) {
            setTaxonomiesForEdit([])
            setTaxonomyTermsById({})
            setTaxonomySelectionById({})
            return
        }

        let cancelled = false
        ;(async () => {
            setLoadingTaxonomiesForEdit(true)
            try {
                const resTx = await (window as any).api?.taxonomies?.list?.({ includeInactive: false })
                const txs = ((resTx?.taxonomies || []) as Array<{ id: number; name: string }>).map((t) => ({ id: t.id, name: t.name }))
                if (cancelled) return

                if (!txs.length) {
                    setTaxonomyTermsById({})
                    setTaxonomySelectionById({})
                    setTaxonomiesForEdit([])
                    return
                }

                const listFn = (window as any).api?.vouchers?.taxonomyAssignments?.list
                if (typeof listFn !== 'function') throw new Error('Taxonomie-API nicht verfügbar (Preload/Server nicht aktuell)')
                const resAssign = await listFn({ voucherId: editRow.id })
                const assignments = (resAssign?.assignments || []) as Array<{ taxonomyId: number; termId: number }>
                const assignmentMap = new Map<number, number>(assignments.map((a) => [Number(a.taxonomyId), Number(a.termId)]))

                const termsBy: Record<number, Array<{ id: number; name: string }>> = {}
                for (const tx of txs) {
                    // Include inactive terms so a previously assigned inactive term can still be shown.
                    const resTerms = await (window as any).api?.taxonomies?.terms?.list?.({ taxonomyId: tx.id, includeInactive: true })
                    const terms = (resTerms?.terms || []) as Array<{ id: number; name: string }>
                    termsBy[tx.id] = terms.map((t) => ({ id: Number(t.id), name: t.name }))
                }
                if (cancelled) return

                // Show taxonomies that have at least one term OR already have an assignment.
                const txsWithTerms = txs.filter((tx) => (termsBy[tx.id] || []).length > 0 || assignmentMap.has(tx.id))

                const sel: Record<number, number | ''> = {}
                for (const tx of txsWithTerms) {
                    const termId = assignmentMap.get(tx.id)
                    sel[tx.id] = typeof termId === 'number' ? termId : ''
                }
                setTaxonomiesForEdit(txsWithTerms)
                setTaxonomyTermsById(termsBy)
                setTaxonomySelectionById(sel)
            } catch (e: any) {
                if (cancelled) return
                notify('error', 'Taxonomien konnten nicht geladen werden: ' + friendlyError(e))
                setTaxonomiesForEdit([])
                setTaxonomyTermsById({})
                setTaxonomySelectionById({})
            } finally {
                if (!cancelled) setLoadingTaxonomiesForEdit(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [editRow?.id, allowData])

    // Keyboard shortcuts for edit modal (Ctrl+S to save, Esc to close)
    useEffect(() => {
        if (!editRow) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+S or Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                // Trigger form submit by finding and clicking the submit button or dispatching submit event
                const form = document.querySelector('.booking-modal form') as HTMLFormElement | null
                if (form) {
                    form.requestSubmit()
                }
                return
            }
            
            // Escape to close
            if (e.key === 'Escape') {
                e.preventDefault()
                setEditRow(null)
                return
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [editRow])

    // ==================== RENDER ====================
    return (
        <div className="journal-view">
            {/* Filter Toolbar - Clean design with just search + dropdown icons */}
            <div className="journal-toolbar">
                {/* Textsuche */}
                <input
                    className="input"
                    placeholder="Suche (#ID, Text, Betrag …)"
                    value={activeQ}
                    onChange={(e) => { activeSetQ(e.target.value); activeSetPage(1); }}
                    style={{ flex: '1 1 300px' }}
                    aria-label="Suche"
                />

                {/* Icon-Gruppe: Anzeige */}
                <div className="journal-toolbar__group">
                    <ColumnSelectDropdown
                        columns={order.map(k => ({
                            key: k,
                            label: labelForCol(k),
                            checked: cols[k],
                            onChange: (v) => setCols({ ...cols, [k]: v })
                        }))}
                        tip="Ziehe Einträge per Drag & Drop, um die Reihenfolge zu ändern."
                        onReorder={(newOrder) => setOrder(newOrder as typeof order)}
                    />
                </div>

                {/* Icon-Gruppe: Filter */}
                <div className="journal-toolbar__group">
                    <TimeFilterDropdown
                        yearsAvail={yearsAvail}
                        from={activeFrom}
                        to={activeTo}
                        onApply={({ from: nf, to: nt }) => {
                            onTimeFilterChange(nf, nt)
                        }}
                    />

                    <MetaFilterDropdown
                        budgets={budgets}
                        earmarks={earmarks}
                        categories={categories}
                        tagDefs={tagDefs}
                        filterType={activeFilterType}
                        filterPM={activeFilterPM}
                        filterTag={activeFilterTag}
                        categoryId={activeFilterCategoryId}
                        earmarkId={activeFilterEarmark}
                        budgetId={activeFilterBudgetId}
                        onApply={({ filterType, filterPM, filterTag, categoryId, earmarkId, budgetId }) => {
                            activeSetFilterType(filterType)
                            activeSetFilterPM(filterPM)
                            activeSetFilterTag(filterTag)
                            activeSetFilterCategoryId(categoryId)
                            activeSetFilterEarmark(earmarkId)
                            activeSetFilterBudgetId(budgetId)
                        }}
                    />
                </div>

                {/* Icon-Gruppe: Aktionen */}
                <div className="journal-toolbar__group">
                    <BatchAssignDropdown
                        earmarks={earmarks}
                        tagDefs={tagDefs}
                        budgets={budgetsForEdit}
                        currentFilters={{
                            paymentMethod: activeFilterPM || undefined,
                            sphere: activeFilterSphere || undefined,
                            categoryId: useCategoriesModule ? (activeFilterCategoryId ?? undefined) : undefined,
                            type: activeFilterType || undefined,
                            from: activeFrom || undefined,
                            to: activeTo || undefined,
                            q: activeQ || undefined,
                            earmarkId: activeFilterEarmark || undefined,
                            budgetId: activeFilterBudgetId || undefined,
                            tag: activeFilterTag || undefined,
                        }}
                        useCategoriesModule={useCategoriesModule}
                        onApplied={async (updated) => {
                            notify('success', `${updated} Buchung(en) aktualisiert`)
                            await loadRecent()
                            bumpDataVersion()
                        }}
                        notify={notify}
                    />
                </div>
            </div>

            {/* Active Filter Chips */}
            {chips.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 8px', alignItems: 'center' }}>
                    {chips.map((c) => {
                        const chipStyle: React.CSSProperties = c.color ? {
                            background: c.color,
                            color: (() => {
                                try {
                                    const hex = c.color.startsWith('#') ? c.color.slice(1) : c.color
                                    if (hex.length === 6) {
                                        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
                                        return (0.299*r + 0.587*g + 0.114*b)/255 > 0.6 ? '#000' : '#fff'
                                    }
                                } catch {}
                                return 'inherit'
                            })(),
                            borderColor: c.color
                        } : {}
                        return (
                            <span key={c.key} className="chip" style={chipStyle}>
                                {c.label}
                                <button className="chip-x" onClick={c.clear} aria-label={`Filter ${c.key} löschen`} style={c.color ? { color: 'inherit' } : {}}>×</button>
                            </span>
                        )
                    })}
                    {(activeFilterType || activeFilterPM || activeFilterTag || activeFilterSphere || activeFilterCategoryId != null || activeFilterEarmark || activeFilterBudgetId || activeFrom || activeTo || activeQ.trim()) && (
                        <button
                            className="btn ghost"
                            title="Alle Filter zurücksetzen"
                            onClick={() => { 
                                activeSetFilterType(null);
                                activeSetFilterPM(null);
                                activeSetFilterTag(null);
                                activeSetFilterSphere(null);
                                activeSetFilterCategoryId(null);
                                activeSetFilterEarmark(null);
                                activeSetFilterBudgetId(null);
                                if (clearTimeFilter) clearTimeFilter();
                                else { activeSetFrom(''); activeSetTo(''); }
                                activeSetQ('');
                                activeSetPage(1);
                            }}
                            style={{ padding: '4px 8px', color: 'var(--accent)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* Filter Totals */}
            <FilterTotals 
                refreshKey={refreshKey} 
                from={activeFrom || undefined} 
                to={activeTo || undefined} 
                paymentMethod={activeFilterPM || undefined} 
                sphere={activeFilterSphere || undefined} 
                categoryId={useCategoriesModule ? (activeFilterCategoryId ?? undefined) : undefined}
                type={activeFilterType || undefined} 
                earmarkId={activeFilterEarmark || undefined} 
                budgetId={activeFilterBudgetId ?? undefined} 
                q={activeQ || undefined} 
                tag={activeFilterTag || undefined} 
                workYear={workYear}
                showArchived={showArchived}
            />

            {/* Main Table Card */}
            <div>
                <div className="card journal-table-card">
                    {/* Pagination controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div className="helper">Seite {activePage} von {Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} — {totalRows} Einträge</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn" onClick={() => { activeSetPage(1) }} disabled={activePage <= 1} title="Erste">«</button>
                            <button className="btn" onClick={() => { activeSetPage(Math.max(1, activePage - 1)) }} disabled={activePage <= 1} title="Zurück">‹</button>
                            <button className="btn" onClick={() => { const maxP = Math.max(1, Math.ceil((totalRows || 0) / journalLimit)); activeSetPage(Math.min(maxP, activePage + 1)) }} disabled={activePage >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} title="Weiter">›</button>
                            <button className="btn" onClick={() => { const maxP = Math.max(1, Math.ceil((totalRows || 0) / journalLimit)); activeSetPage(maxP) }} disabled={activePage >= Math.max(1, Math.ceil((totalRows || 0) / journalLimit))} title="Letzte">»</button>
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
                        fmtDate={(s) => fmtDate(s || '')}
                        budgetUsage={budgetUsage}
                        earmarkUsage={earmarkUsage}
                        canWrite={canWrite}
                        onEdit={(r: any) => {
                            if ((r as any)?.isCashAdvancePlaceholder) {
                                notify('info', 'Barvorschuss-Platzhalter ist nicht editierbar. Bitte im Barvorschuss abschließen oder löschen.')
                                return
                            }
                            setEditRow({
                            ...r,
                            // Modus-Inferenz: Wenn Netto-Betrag gespeichert wurde (>0) => NETTO, sonst BRUTTO
                            mode: ((r as any).netAmount ?? 0) > 0 ? 'NET' : 'GROSS',
                            netAmount: (r as any).netAmount ?? null,
                            grossAmount: (r as any).grossAmount ?? null,
                            vatRate: (r as any).vatRate ?? 0
                        } as any)
                        }}
                        onDelete={(r: any) => {
                            if ((r as any)?.isCashAdvancePlaceholder) {
                                notify('info', 'Barvorschuss-Platzhalter ist nicht löschbar. Bitte den Barvorschuss löschen, dann wird der Platzhalter entfernt.')
                                return
                            }
                            setDeleteRow(r)
                        }}
                        onToggleSort={(col: 'date' | 'net' | 'gross' | 'budget' | 'earmark' | 'payment' | 'sphere') => {
                            setPage(1)
                            setSortBy(col)
                            setSortDir(prev => (col === sortBy ? (prev === 'DESC' ? 'ASC' : 'DESC') : 'DESC'))
                        }}
                        sortDir={sortDir}
                        sortBy={sortBy}
                        highlightId={flashId}
                        lockedUntil={periodLock?.closedUntil || null}
                        onTagClick={async (name) => {
                            activeSetFilterTag(name)
                            setActivePage('Buchungen')
                            activeSetPage(1)
                            await loadRecent()
                        }}
                        onTaxonomyTermClick={async ({ termId, termName, taxonomyName }) => {
                            setFilterTaxonomyTerm({ termId, termName, taxonomyName })
                            setActivePage('Buchungen')
                            activeSetPage(1)
                            await loadRecent()
                        }}
                        onCategoryClick={async ({ categoryId, sphere }) => {
                            if (typeof categoryId === 'number') {
                                activeSetFilterCategoryId(categoryId)
                                activeSetFilterSphere(null)
                            } else if (sphere) {
                                activeSetFilterSphere(sphere)
                                activeSetFilterCategoryId(null)
                            }
                            setActivePage('Buchungen')
                            activeSetPage(1)
                            await loadRecent()
                        }}
                        onEarmarkClick={async (id) => {
                            activeSetFilterEarmark(id)
                            setActivePage('Buchungen')
                            activeSetPage(1)
                            await loadRecent()
                        }}
                        onBudgetClick={async (id) => {
                            activeSetFilterBudgetId(id)
                            setActivePage('Buchungen')
                            activeSetPage(1)
                            await loadRecent()
                        }}
                        onRowDoubleClick={(row) => setInfoVoucher(row)}
                        useCategoriesModule={useCategoriesModule}
                    />
                </div>



                {/* Edit Modal */}
                {editRow && (
                    <div className="modal-overlay">
                        <div className="modal booking-modal" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Sticky Header with Summary + Actions */}
                            <header className="modal-header-flex" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                                {/* Title row with action buttons */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <h2 style={{ margin: 0, flex: 1 }}>Buchung bearbeiten</h2>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button type="button" className="btn danger" style={{ padding: '6px 12px', fontSize: 13 }} title="Löschen" onClick={() => { setDeleteRow({ id: editRow.id, voucherNo: (editRow as any)?.voucherNo as any, description: editRow.description ?? null, fromEdit: true }); }}>🗑</button>
                                        <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setEditRow(null)}>Abbrechen</button>
                                        <button type="submit" form="edit-booking-form" className="btn primary" style={{ padding: '6px 12px', fontSize: 13 }}>Speichern</button>
                                        <button className="btn ghost" onClick={() => setEditRow(null)} title="Schließen (ESC)" style={{ padding: 6 }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                {/* Compact Summary Line */}
                                <div style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '6px 12px', 
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))',
                                    borderRadius: 8,
                                    borderLeft: `4px solid ${editRow.type === 'IN' ? 'var(--success)' : editRow.type === 'OUT' ? 'var(--danger)' : 'var(--accent)'}`,
                                    fontSize: 13
                                }}>
                                    <span style={{ fontWeight: 600 }}>{fmtDate(editRow.date)}</span>
                                    <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: 4, 
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: editRow.type === 'IN' ? 'var(--success)' : editRow.type === 'OUT' ? 'var(--danger)' : 'var(--accent)',
                                        color: 'white'
                                    }}>
                                        {editRow.type}
                                    </span>
                                    <span style={{ color: 'var(--text-dim)' }}>
                                        {editRow.type === 'TRANSFER' 
                                            ? `${(editRow as any).transferFrom || '—'} → ${(editRow as any).transferTo || '—'}`
                                            : (editRow as any).paymentMethod || '—'}
                                    </span>
                                    <span style={{ 
                                        color: editRow.type === 'IN' ? 'var(--success)' : editRow.type === 'OUT' ? 'var(--danger)' : 'inherit',
                                        fontWeight: 700
                                    }}>
                                        {(() => {
                                            if (editRow.type === 'TRANSFER') return eurFmt.format(Number((editRow as any).grossAmount || 0))
                                            if ((editRow as any).mode === 'GROSS') return eurFmt.format(Number((editRow as any).grossAmount || 0))
                                            const n = Number((editRow as any).netAmount || 0)
                                            const v = Number((editRow as any).vatRate || 0)
                                            const g = Math.round((n * (1 + v / 100)) * 100) / 100
                                            return eurFmt.format(g)
                                        })()}
                                    </span>
                                    {/* Category or Sphere badge */}
                                    {(useCategoriesModule ? editRow.categoryId : editRow.sphere) && (
                                        <span style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: 4, 
                                            fontSize: 11,
                                            background: 'var(--muted)',
                                            border: '1px solid var(--border)'
                                        }}>
                                            {useCategoriesModule 
                                                ? (categoryMap.get(editRow.categoryId!)?.name || 'Kategorie')
                                                : editRow.sphere}
                                        </span>
                                    )}
                                    {/* Description snippet */}
                                    {editRow.description && (
                                        <span style={{ color: 'var(--text)', opacity: 0.85 }}>
                                            📝 {editRow.description.length > 40 ? editRow.description.slice(0, 40) + '…' : editRow.description}
                                        </span>
                                    )}
                                    {/* Tags count */}
                                    {editRow.tags && editRow.tags.length > 0 && (
                                        <span style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: 999, 
                                            fontSize: 10,
                                            fontWeight: 600,
                                            background: 'var(--muted)',
                                            border: '1px solid var(--border)'
                                        }}>
                                            🏷️ {editRow.tags.length}
                                        </span>
                                    )}
                                </div>
                            </header>

                            <form id="edit-booking-form" onSubmit={async (e) => {
                                e.preventDefault()
                                try {
                                    // Validate transfer direction
                                    if (editRow.type === 'TRANSFER' && (!editRow.transferFrom || !editRow.transferTo)) {
                                        notify('error', 'Bitte wähle eine Richtung für den Transfer aus.')
                                        return
                                    }
                                    // Build budgets array from the new multi-assignment UI
                                    const budgets = ((editRow as any).budgets || [])
                                        .filter((b: BudgetAssignment) => b.budgetId && b.amount > 0)
                                        .map((b: BudgetAssignment) => ({ budgetId: b.budgetId, amount: b.amount }))
                                    // Build earmarks array from the new multi-assignment UI
                                    const earmarksArr = ((editRow as any).earmarksAssigned || [])
                                        .filter((e: EarmarkAssignment) => e.earmarkId && e.amount > 0)
                                        .map((e: EarmarkAssignment) => ({ earmarkId: e.earmarkId, amount: e.amount }))
                                    
                                    // Validate: No duplicate budgets
                                    const budgetIds = budgets.map((b: { budgetId: number }) => b.budgetId)
                                    if (new Set(budgetIds).size !== budgetIds.length) {
                                        notify('error', 'Ein Budget kann nur einmal pro Buchung zugeordnet werden. Bitte entferne die doppelten Einträge.')
                                        return
                                    }
                                    // Validate: No duplicate earmarks
                                    const earmarkIds = earmarksArr.map((e: { earmarkId: number }) => e.earmarkId)
                                    if (new Set(earmarkIds).size !== earmarkIds.length) {
                                        notify('error', 'Eine Zweckbindung kann nur einmal pro Buchung zugeordnet werden. Bitte entferne die doppelten Einträge.')
                                        return
                                    }
                                    // Validate: Total budget amount should not exceed gross amount
                                    const totalBudgetAmount = budgets.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0)
                                    const grossAmount = Number((editRow as any).grossAmount) || 0
                                    if (totalBudgetAmount > grossAmount * 1.001) { // small tolerance for rounding
                                        notify('error', `Die Summe der Budget-Beträge (${totalBudgetAmount.toFixed(2)} €) übersteigt den Buchungsbetrag (${grossAmount.toFixed(2)} €).`)
                                        return
                                    }
                                    // Validate: Total earmark amount should not exceed gross amount
                                    const totalEarmarkAmount = earmarksArr.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
                                    if (totalEarmarkAmount > grossAmount * 1.001) {
                                        notify('error', `Die Summe der Zweckbindungs-Beträge (${totalEarmarkAmount.toFixed(2)} €) übersteigt den Buchungsbetrag (${grossAmount.toFixed(2)} €).`)
                                        return
                                    }

                                    const payload: any = { 
                                        id: editRow.id, 
                                        date: editRow.date, 
                                        description: editRow.description ?? null, 
                                        type: editRow.type, 
                                        sphere: editRow.sphere, 
                                        categoryId: editRow.categoryId ?? null,
                                        // Legacy fields (kept for backwards compatibility, first item from arrays)
                                        earmarkId: earmarksArr.length > 0 ? earmarksArr[0].earmarkId : null, 
                                        earmarkAmount: earmarksArr.length > 0 ? earmarksArr[0].amount : null,
                                        budgetId: budgets.length > 0 ? budgets[0].budgetId : null, 
                                        budgetAmount: budgets.length > 0 ? budgets[0].amount : null,
                                        // New arrays for multiple assignments
                                        budgets,
                                        earmarks: earmarksArr,
                                        tags: editRow.tags || [] 
                                    }
                                    if (editRow.type === 'TRANSFER') {
                                        delete payload.paymentMethod
                                        payload.transferFrom = editRow.transferFrom ?? null
                                        payload.transferTo = editRow.transferTo ?? null
                                    } else {
                                        payload.paymentMethod = editRow.paymentMethod ?? null
                                        payload.transferFrom = null
                                        payload.transferTo = null
                                    }
                                    if ((editRow as any).mode === 'GROSS' && (editRow as any).grossAmount != null && (editRow as any).grossAmount !== '') {
                                        payload.grossAmount = Number((editRow as any).grossAmount)
                                        payload.vatRate = 0 // Bei Brutto keine MwSt-Aufschlüsselung
                                    } else if ((editRow as any).mode === 'NET' && (editRow as any).netAmount != null && (editRow as any).netAmount !== '') {
                                        payload.netAmount = Number((editRow as any).netAmount)
                                        if ((editRow as any).vatRate != null) payload.vatRate = Number((editRow as any).vatRate)
                                    }
                                    const vid = editRow.id
                                    const res = await window.api?.vouchers.update?.(payload)

                                    // Persist taxonomy assignments (best-effort; keep modal open on failure)
                                    if (taxonomiesForEdit.length) {
                                        try {
                                            const setFn = (window as any).api?.vouchers?.taxonomyAssignments?.set
                                            if (typeof setFn !== 'function') throw new Error('Taxonomie-API nicht verfügbar (Preload/Server nicht aktuell)')
                                            await Promise.all(
                                                taxonomiesForEdit.map(async (tx) => {
                                                    const v = taxonomySelectionById[tx.id]
                                                    const termId = typeof v === 'number' ? v : null
                                                    await setFn({
                                                        voucherId: vid,
                                                        taxonomyId: tx.id,
                                                        termId
                                                    })
                                                })
                                            )
                                        } catch (e: any) {
                                            notify('error', 'Taxonomie-Zuordnung konnte nicht gespeichert werden: ' + friendlyError(e))
                                            return
                                        }
                                    }

                                    notify('success', 'Buchung gespeichert')
                                    const w = (res as any)?.warnings as string[] | undefined
                                    if (w && w.length) { for (const msg of w) notify('info', 'Warnung: ' + msg) }
                                    setFlashId(editRow.id); window.setTimeout(() => setFlashId((cur) => (cur === editRow.id ? null : cur)), 3000)
                                    setEditRow(null); await loadRecent(); bumpDataVersion()
                                } catch (e: any) {
                                    notify('error', friendlyError(e))
                                }
                            }}>
                                {/* Blocks A+B in a side-by-side grid on wide screens */}
                                <div className="block-grid" style={{ marginBottom: 8 }}>
                                    {/* Block A – Basisinfos */}
                                    <div className="card" style={{ padding: 12 }}>
                                        <div className="helper" style={{ marginBottom: 6 }}>Basis</div>
                                        <div className="row">
                                            <div className="field">
                                                <label>Datum <span className="req-asterisk" aria-hidden="true">*</span></label>
                                                <input className="input" type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} />
                                            </div>
                                            <div className="field">
                                                <label>Art</label>
                                                <div className="btn-group" role="group" aria-label="Art wählen">
                                                    {(['IN','OUT','TRANSFER'] as const).map(t => (
                                                        <button key={t} type="button" className={`btn ${editRow.type === t ? 'btn-toggle-active' : ''} ${t==='IN' ? 'btn-type-in' : t==='OUT' ? 'btn-type-out' : ''}`} onClick={() => {
                                                            const newRow = { ...editRow, type: t }
                                                            if (t === 'TRANSFER' && (!newRow.transferFrom || !newRow.transferTo)) {
                                                                newRow.transferFrom = 'BAR'
                                                                newRow.transferTo = 'BANK'
                                                            }
                                                            setEditRow(newRow)
                                                        }}>{t}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="field">
                                                <label>{useCategoriesModule ? 'Kategorie' : 'Kategorie (Sphäre)'}</label>
                                                {useCategoriesModule ? (
                                                    <select 
                                                        value={editRow.categoryId ?? ''} 
                                                        disabled={editRow.type === 'TRANSFER'} 
                                                        onChange={(e) => setEditRow({ ...editRow, categoryId: e.target.value ? Number(e.target.value) : undefined })}
                                                    >
                                                        <option value="">— Keine Kategorie —</option>
                                                        {customCategories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <select value={editRow.sphere ?? ''} disabled={editRow.type === 'TRANSFER'} onChange={(e) => setEditRow({ ...editRow, sphere: (e.target.value as any) || undefined })}>
                                                        <option value="">—</option>
                                                        <option value="IDEELL">IDEELL</option>
                                                        <option value="ZWECK">ZWECK</option>
                                                        <option value="VERMOEGEN">VERMOEGEN</option>
                                                        <option value="WGB">WGB</option>
                                                    </select>
                                                )}
                                            </div>
                                            {editRow.type === 'TRANSFER' ? (
                                                <div className="field">
                                                    <label>Richtung <span className="req-asterisk" aria-hidden="true">*</span></label>
                                                    <select value={`${editRow.transferFrom ?? ''}->${editRow.transferTo ?? ''}`}
                                                        onChange={(e) => {
                                                            const v = e.target.value
                                                            if (v === 'BAR->BANK') setEditRow({ ...editRow, transferFrom: 'BAR', transferTo: 'BANK', paymentMethod: null })
                                                            else if (v === 'BANK->BAR') setEditRow({ ...editRow, transferFrom: 'BANK', transferTo: 'BAR', paymentMethod: null })
                                                        }}>
                                                        <option value="BAR->BANK">BAR → BANK</option>
                                                        <option value="BANK->BAR">BANK → BAR</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="field">
                                                    <label>Zahlweg</label>
                                                    <div className="btn-group" role="group" aria-label="Zahlweg wählen">
                                                        {(['BAR','BANK'] as const).map(pm => (
                                                            <button key={pm} type="button" className={`btn ${(editRow as any).paymentMethod === pm ? 'btn-toggle-active' : ''}`} onClick={() => setEditRow({ ...editRow, paymentMethod: pm })}>{pm === 'BAR' ? 'Bar' : 'Bank'}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Block B – Finanzdetails */}
                                    <div className="card" style={{ padding: 12 }}>
                                        <div className="helper" style={{ marginBottom: 6 }}>Finanzen</div>
                                        <div className="row">
                                            {editRow.type === 'TRANSFER' ? (
                                                <div className="field" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Betrag (Transfer) <span className="req-asterisk" aria-hidden="true">*</span></label>
                                                    <span className="adorn-wrap">
                                                        <input className="input input-transfer" type="number" step="0.01" value={(editRow as any).grossAmount ?? ''}
                                                            onChange={(e) => {
                                                                const v = Number(e.target.value)
                                                                setEditRow({ ...(editRow as any), grossAmount: v } as any)
                                                            }} />
                                                        <span className="adorn-suffix">€</span>
                                                    </span>
                                                    <div className="helper">Transfers sind umsatzsteuerneutral.</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="field">
                                                        <label>{(editRow as any).mode === 'GROSS' ? 'Brutto' : 'Netto'} <span className="req-asterisk" aria-hidden="true">*</span></label>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <select className="input" value={(editRow as any).mode ?? 'NET'} onChange={(e) => setEditRow({ ...(editRow as any), mode: e.target.value as any } as any)}>
                                                                <option value="NET">Netto</option>
                                                                <option value="GROSS">Brutto</option>
                                                            </select>
                                                            <span className="adorn-wrap" style={{ flex: 1 }}>
                                                                <input className="input" type="number" step="0.01" value={(editRow as any).mode === 'GROSS' ? (editRow as any).grossAmount ?? '' : (editRow as any).netAmount ?? ''}
                                                                    onChange={(e) => {
                                                                        const v = Number(e.target.value)
                                                                        if ((editRow as any).mode === 'GROSS') setEditRow({ ...(editRow as any), grossAmount: v } as any)
                                                                        else setEditRow({ ...(editRow as any), netAmount: v } as any)
                                                                    }} />
                                                                <span className="adorn-suffix">€</span>
                                                            </span>
                                                        </div>
                                                        <div className="helper">{(editRow as any).mode === 'GROSS' ? 'Bei Brutto wird USt/Netto nicht berechnet' : 'USt wird automatisch berechnet'}</div>
                                                    </div>
                                                    {(editRow as any).mode === 'NET' && (
                                                        <div className="field">
                                                            <label>USt %</label>
                                                            <select className="input" value={(editRow as any).vatRate ?? 19} onChange={(e) => setEditRow({ ...(editRow as any), vatRate: Number(e.target.value) } as any)}>
                                                                <option value="0">0% (steuerfrei)</option>
                                                                <option value="7">7% (ermäßigt)</option>
                                                                <option value="19">19% (Regelsteuersatz)</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {/* Budget Zuordnungen (mehrfach möglich) */}
                                        <div className="row">
                                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    Budget
                                                    <button
                                                        type="button"
                                                        className="btn ghost"
                                                        style={{ padding: '2px 6px', fontSize: '0.85rem' }}
                                                        onClick={() => {
                                                            const currentBudgets = (editRow as any).budgets || []
                                                            setEditRow({ ...editRow, budgets: [...currentBudgets, { budgetId: 0, amount: (editRow as any).grossAmount || 0 }] } as any)
                                                        }}
                                                        title="Weiteres Budget hinzufügen"
                                                    >+</button>
                                                </label>
                                                {(() => {
                                                    const budgetsList = (editRow as any).budgets || []
                                                    const budgetIds = budgetsList.filter((b: BudgetAssignment) => b.budgetId).map((b: BudgetAssignment) => b.budgetId)
                                                    const hasDuplicateBudgets = new Set(budgetIds).size !== budgetIds.length
                                                    const totalBudgetAmount = budgetsList.reduce((sum: number, b: BudgetAssignment) => sum + (b.amount || 0), 0)
                                                    const grossAmt = Number((editRow as any).grossAmount) || 0
                                                    const exceedsTotal = totalBudgetAmount > grossAmt * 1.001
                                                    return budgetsList.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {budgetsList.map((ba: BudgetAssignment, idx: number) => {
                                                                const isDuplicate = budgetIds.filter((id: number) => id === ba.budgetId).length > 1
                                                                return (
                                                                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                        <select
                                                                            style={{ flex: 1, borderColor: isDuplicate ? 'var(--danger)' : undefined }}
                                                                            value={ba.budgetId || ''}
                                                                            onChange={(e) => {
                                                                                const newBudgets = [...budgetsList]
                                                                                newBudgets[idx] = { ...newBudgets[idx], budgetId: e.target.value ? Number(e.target.value) : 0 }
                                                                                setEditRow({ ...editRow, budgets: newBudgets } as any)
                                                                            }}
                                                                        >
                                                                            <option value="">— Budget wählen —</option>
                                                                            {budgetsForEdit.map(b => (
                                                                                <option key={b.id} value={b.id}>{b.label}</option>
                                                                            ))}
                                                                        </select>
                                                                        <span className="adorn-wrap" style={{ width: 110 }}>
                                                                            <input
                                                                                className="input"
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="0"
                                                                                value={ba.amount ?? ''}
                                                                                onChange={(e) => {
                                                                                    const newBudgets = [...budgetsList]
                                                                                    newBudgets[idx] = { ...newBudgets[idx], amount: e.target.value ? Number(e.target.value) : 0 }
                                                                                    setEditRow({ ...editRow, budgets: newBudgets } as any)
                                                                                }}
                                                                                title="Betrag für dieses Budget"
                                                                            />
                                                                            <span className="adorn-suffix">€</span>
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="btn ghost"
                                                                            style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                                                            onClick={() => {
                                                                                const newBudgets = budgetsList.filter((_: any, i: number) => i !== idx)
                                                                                setEditRow({ ...editRow, budgets: newBudgets } as any)
                                                                            }}
                                                                            title="Entfernen"
                                                                        >✕</button>
                                                                    </div>
                                                                )
                                                            })}
                                                            {hasDuplicateBudgets && (
                                                                <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Ein Budget kann nur einmal zugeordnet werden</div>
                                                            )}
                                                            {exceedsTotal && (
                                                                <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Summe ({totalBudgetAmount.toFixed(2)} €) übersteigt Buchungsbetrag ({grossAmt.toFixed(2)} €)</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="helper" style={{ fontStyle: 'italic', opacity: 0.7 }}>Kein Budget zugeordnet. Klicke + zum Hinzufügen.</div>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                        {/* Zweckbindung Zuordnungen (mehrfach möglich) */}
                                        <div className="row">
                                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    Zweckbindung
                                                    <button
                                                        type="button"
                                                        className="btn ghost"
                                                        style={{ padding: '2px 6px', fontSize: '0.85rem' }}
                                                        onClick={() => {
                                                            const currentEarmarks = (editRow as any).earmarksAssigned || []
                                                            setEditRow({ ...editRow, earmarksAssigned: [...currentEarmarks, { earmarkId: 0, amount: (editRow as any).grossAmount || 0 }] } as any)
                                                        }}
                                                        title="Weitere Zweckbindung hinzufügen"
                                                    >+</button>
                                                </label>
                                                {(() => {
                                                    const earmarksList = (editRow as any).earmarksAssigned || []
                                                    const earmarkIds = earmarksList.filter((e: EarmarkAssignment) => e.earmarkId).map((e: EarmarkAssignment) => e.earmarkId)
                                                    const hasDuplicateEarmarks = new Set(earmarkIds).size !== earmarkIds.length
                                                    const totalEarmarkAmount = earmarksList.reduce((sum: number, e: EarmarkAssignment) => sum + (e.amount || 0), 0)
                                                    const grossAmt = Number((editRow as any).grossAmount) || 0
                                                    const exceedsTotal = totalEarmarkAmount > grossAmt * 1.001
                                                    return earmarksList.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {earmarksList.map((ea: EarmarkAssignment, idx: number) => {
                                                                const isDuplicate = earmarkIds.filter((id: number) => id === ea.earmarkId).length > 1
                                                                return (
                                                                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                        <select
                                                                            style={{ flex: 1, borderColor: isDuplicate ? 'var(--danger)' : undefined }}
                                                                            value={ea.earmarkId || ''}
                                                                            onChange={(e) => {
                                                                                const newEarmarks = [...earmarksList]
                                                                                newEarmarks[idx] = { ...newEarmarks[idx], earmarkId: e.target.value ? Number(e.target.value) : 0 }
                                                                                setEditRow({ ...editRow, earmarksAssigned: newEarmarks } as any)
                                                                            }}
                                                                        >
                                                                            <option value="">— Zweckbindung wählen —</option>
                                                                            {earmarks.map(em => (
                                                                                <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <span className="adorn-wrap" style={{ width: 110 }}>
                                                                            <input
                                                                                className="input"
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="0"
                                                                                value={ea.amount ?? ''}
                                                                                onChange={(e) => {
                                                                                    const newEarmarks = [...earmarksList]
                                                                                    newEarmarks[idx] = { ...newEarmarks[idx], amount: e.target.value ? Number(e.target.value) : 0 }
                                                                                    setEditRow({ ...editRow, earmarksAssigned: newEarmarks } as any)
                                                                                }}
                                                                                title="Betrag für diese Zweckbindung"
                                                                            />
                                                                            <span className="adorn-suffix">€</span>
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="btn ghost"
                                                                            style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                                                            onClick={() => {
                                                                                const newEarmarks = earmarksList.filter((_: any, i: number) => i !== idx)
                                                                                setEditRow({ ...editRow, earmarksAssigned: newEarmarks } as any)
                                                                            }}
                                                                            title="Entfernen"
                                                                        >✕</button>
                                                                    </div>
                                                                )
                                                            })}
                                                            {hasDuplicateEarmarks && (
                                                                <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Eine Zweckbindung kann nur einmal zugeordnet werden</div>
                                                            )}
                                                            {exceedsTotal && (
                                                                <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Summe ({totalEarmarkAmount.toFixed(2)} €) übersteigt Buchungsbetrag ({grossAmt.toFixed(2)} €)</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="helper" style={{ fontStyle: 'italic', opacity: 0.7 }}>Keine Zweckbindung zugeordnet. Klicke + zum Hinzufügen.</div>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Block C+D – Beschreibung & Tags + Anhänge */}
                                <div className="block-grid" style={{ marginBottom: 8 }}>
                                    {/* Block C – Beschreibung & Tags */}
                                    <div className="card" style={{ padding: 12 }}>
                                        <div className="helper" style={{ marginBottom: 6 }}>Beschreibung & Tags</div>
                                        <div className="row">
                                            <div className="field" style={{ gridColumn: '1 / -1' }}>
                                                <label>Beschreibung</label>
                                                <input className="input" value={editRow.description ?? ''} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} placeholder="z. B. Mitgliedsbeitrag, Spende …" />
                                            </div>
                                            <TagsEditor
                                                label="Tags"
                                                value={editRow.tags || []}
                                                onChange={(tags) => setEditRow({ ...editRow, tags })}
                                                tagDefs={tagDefs}
                                            />

                                            {taxonomiesForEdit.length > 0 && (
                                                <div className="field" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span>🏷️</span> Klassifizierung
                                                    </label>
                                                    {loadingTaxonomiesForEdit ? (
                                                        <div className="helper">Lade Taxonomien…</div>
                                                    ) : (
                                                        <div style={{ 
                                                            display: 'grid', 
                                                            gridTemplateColumns: `repeat(auto-fit, minmax(${taxonomiesForEdit.length === 1 ? '200px' : '140px'}, 1fr))`,
                                                            gap: 12,
                                                            padding: '10px 12px',
                                                            background: 'color-mix(in oklab, var(--accent) 5%, transparent)',
                                                            borderRadius: 8,
                                                            border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)'
                                                        }}>
                                                            {taxonomiesForEdit.map((tx) => {
                                                                const terms = taxonomyTermsById[tx.id] || []
                                                                const value = taxonomySelectionById[tx.id] ?? ''
                                                                return (
                                                                    <div key={tx.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>{tx.name}</label>
                                                                        <select
                                                                            className="input"
                                                                            style={{ fontSize: 13, padding: '6px 8px' }}
                                                                            value={value as any}
                                                                            onChange={(e) => {
                                                                                const next = e.target.value ? Number(e.target.value) : ''
                                                                                setTaxonomySelectionById((prev) => ({ ...prev, [tx.id]: next }))
                                                                            }}
                                                                        >
                                                                            <option value="">— keine —</option>
                                                                            {terms.map((t) => (
                                                                                <option key={t.id} value={t.id}>
                                                                                    {t.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Block D – Anhänge */}
                                    <div
                                        className="card"
                                        style={{ padding: 12 }}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                                        onDrop={async (e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            if (!editRow) return
                                            try {
                                                const list = Array.from(e.dataTransfer?.files || [])
                                                for (const f of list) {
                                                    const buf = await f.arrayBuffer()
                                                    const dataBase64 = bufferToBase64Safe(buf)
                                                    await window.api?.attachments.add?.({ voucherId: editRow.id, fileName: f.name, dataBase64, mimeType: f.type || undefined })
                                                }
                                                const res = await window.api?.attachments.list?.({ voucherId: editRow.id })
                                                setEditRowFiles(res?.files || [])
                                            } catch (err: any) {
                                                notify('error', 'Upload fehlgeschlagen: ' + (err?.message || String(err)))
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                                <strong>Anhänge</strong>
                                                {editRowFiles.length > 0 && <div className="helper">Dateien hierher ziehen</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input ref={editFileInputRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={async (e) => {
                                                    const list = e.target.files
                                                    if (!list || !list.length || !editRow) return
                                                    try {
                                                        for (const f of Array.from(list)) {
                                                            const buf = await f.arrayBuffer()
                                                            const dataBase64 = bufferToBase64Safe(buf)
                                                            await window.api?.attachments.add?.({ voucherId: editRow.id, fileName: f.name, dataBase64, mimeType: f.type || undefined })
                                                        }
                                                        const res = await window.api?.attachments.list?.({ voucherId: editRow.id })
                                                        setEditRowFiles(res?.files || [])
                                                    } catch (e: any) {
                                                        notify('error', 'Upload fehlgeschlagen: ' + (e?.message || String(e)))
                                                    } finally { if (editFileInputRef.current) editFileInputRef.current.value = '' }
                                                }} />
                                                <button type="button" className="btn" onClick={() => editFileInputRef.current?.click?.()}>+ Datei(en)</button>
                                            </div>
                                        </div>
                                        {editRowFilesLoading && <div className="helper">Lade …</div>}
                                        {!editRowFilesLoading && (
                                            editRowFiles.length ? (
                                                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                                                    {editRowFiles.map((f) => (
                                                        <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                                                            <button className="btn" onClick={() => window.api?.attachments.open?.({ fileId: f.id })}>Öffnen</button>
                                                            <button className="btn" onClick={async () => {
                                                                try {
                                                                    const r = await window.api?.attachments.saveAs?.({ fileId: f.id })
                                                                    if (r) notify('success', 'Gespeichert: ' + r.filePath)
                                                                } catch (e: any) {
                                                                    const m = e?.message || String(e)
                                                                    if (/Abbruch/i.test(m)) return
                                                                    notify('error', 'Speichern fehlgeschlagen: ' + m)
                                                                }
                                                            }}>Herunterladen</button>
                                                            <button 
                                                                type="button"
                                                                className="btn danger" 
                                                                title="Löschen" 
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    if (editRow) {
                                                                        setConfirmDeleteAttachment({ id: f.id, fileName: f.fileName, voucherId: editRow.id })
                                                                    }
                                                                }}
                                                            >🗑</button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div 
                                                    style={{ 
                                                        marginTop: 8, 
                                                        padding: 20, 
                                                        border: '2px dashed var(--border)', 
                                                        borderRadius: 8, 
                                                        textAlign: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => editFileInputRef.current?.click?.()}
                                                >
                                                    <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
                                                    <div className="helper">Dateien hierher ziehen oder klicken</div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Confirmation Modal for Attachment Deletion */}
                                {confirmDeleteAttachment && (
                                    <div className="modal-overlay" onClick={() => setConfirmDeleteAttachment(null)} role="dialog" aria-modal="true">
                                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3 style={{ margin: 0 }}>Anhang löschen</h3>
                                                <button
                                                    type="button"
                                                    className="btn ghost"
                                                    onClick={() => setConfirmDeleteAttachment(null)}
                                                    aria-label="Schließen"
                                                    style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8 }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div>
                                                Möchtest du den Anhang
                                                {` `}
                                                <strong>{confirmDeleteAttachment.fileName}</strong>
                                                {` `}
                                                wirklich löschen?
                                            </div>
                                            <div className="helper">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                <button type="button" className="btn" onClick={() => setConfirmDeleteAttachment(null)}>Abbrechen</button>
                                                <button type="button" className="btn danger" onClick={async () => {
                                                    try {
                                                        await window.api?.attachments.delete?.({ fileId: confirmDeleteAttachment.id })
                                                        const res = await window.api?.attachments.list?.({ voucherId: confirmDeleteAttachment.voucherId })
                                                        setEditRowFiles(res?.files || [])
                                                        setConfirmDeleteAttachment(null)
                                                        notify('success', 'Anhang gelöscht')
                                                        // Refresh the table to update attachment count
                                                        await loadRecent()
                                                    } catch (e: any) {
                                                        notify('error', e?.message || String(e))
                                                    }
                                                }}>Ja, löschen</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {deleteRow && (
                    <div className="modal-overlay" onClick={() => setDeleteRow(null)} style={{ alignItems: 'center', paddingTop: 0 }}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <h2 style={{ margin: 0 }}>Buchung löschen</h2>
                                <button className="btn danger" onClick={() => setDeleteRow(null)}>Schließen</button>
                            </header>
                            <p>Möchtest du die Buchung <strong>{deleteRow.voucherNo ? `#${deleteRow.voucherNo}` : ''}{deleteRow.description ? ` ${deleteRow.voucherNo ? '– ' : ''}${deleteRow.description}` : ''}</strong> wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button className="btn" onClick={() => setDeleteRow(null)}>Abbrechen</button>
                                <button className="btn danger" onClick={async () => {
                                    try {
                                        await window.api?.vouchers.delete?.({ id: deleteRow.id })
                                        setDeleteRow(null)
                                        // Close edit modal if deletion was initiated from edit, or if the currently edited row matches the deleted one
                                        try {
                                            if (deleteRow.fromEdit) setEditRow(null)
                                            else if (editRow && editRow.id === deleteRow.id) setEditRow(null)
                                        } catch {}
                                        await loadRecent()
                                        bumpDataVersion()
                                        notify('success', 'Buchung gelöscht')
                                    } catch (e: any) {
                                        const raw = String(e?.message || e || '')
                                        // If delete is blocked due to linked invoice, show an explanatory toast
                                        if (/FOREIGN KEY|constraint|invoice|posted_voucher_id/i.test(raw)) {
                                            notify('info', 'Diese Buchung ist mit einer Verbindlichkeit verknüpft und kann nicht gelöscht werden. Bitte zuerst die Verbindlichkeit löschen – danach ist die Buchung löschbar.')
                                        } else {
                                            notify('error', friendlyError(e))
                                        }
                                    }
                                }}>Ja, löschen</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Voucher Info Modal */}
                {infoVoucher && (
                    <VoucherInfoModal
                        voucher={infoVoucher}
                        onClose={() => setInfoVoucher(null)}
                        eurFmt={eurFmt}
                        fmtDate={fmtDate}
                        notify={notify}
                        earmarks={earmarks}
                        budgets={budgetsForEdit}
                        tagDefs={tagDefs}
                    />
                )}
            </div>
        </div>
    )
}
