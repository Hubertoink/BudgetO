import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import ModalHeader from '../../components/ModalHeader'
import QuickAddModal from '../../components/modals/QuickAddModal'
import type { QA } from '../../hooks/useQuickAdd'
import { useToast } from '../../context/toastHooks'
import { useAuth } from '../../context/authHooks'
import { useArchiveSettings } from '../../hooks/useArchiveSettings'

type CashAdvanceStatus = 'OPEN' | 'RESOLVED' | 'OVERDUE'

type CashAdvance = {
  id: number
  orderNumber: string
  employeeName: string
  purpose: string | null
  totalAmount: number
  status: CashAdvanceStatus
  createdAt: string
  resolvedAt: string | null
  dueDate: string | null
  notes: string | null
  costCenterId: number | null
}

type CashAdvanceListItem = CashAdvance & {
  recipientCount: number
  totalPlanned: number
  totalSettled: number
}

type PartialCashAdvance = {
  id: number
  cashAdvanceId: number
  recipientName: string | null
  amount: number
  issuedAt: string
  description: string | null
  isSettled: boolean
  settledAmount: number | null
  settledAt: string | null
}

type CashAdvancePurchase = {
  id: number
  cashAdvanceId: number
  date: string
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  categoryId: number | null
  description: string | null
  grossAmount: number
  vatRate: number
  postedVoucherId: number | null
}

type CashAdvanceWithDetails = CashAdvance & {
  partials: PartialCashAdvance[]
  purchases: CashAdvancePurchase[]
  settlements: any[]
  totalPlanned: number
  totalSettled: number
  plannedRemaining: number
  actualRemaining: number
  coverage: number
}

export default function CashAdvancesView() {
  const { notify } = useToast()
  const { canWrite } = useAuth()
  const { workYear, showArchived, ready: archiveSettingsReady } = useArchiveSettings()
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  const fmtDate = useCallback((d: string) => {
    // Very small helper to match other views (dd.mm.yyyy)
    if (!d) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-')
      return `${day}.${m}.${y}`
    }
    return d
  }, [])

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CashAdvanceListItem[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<CashAdvanceStatus | 'ALL'>('ALL')
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CashAdvanceWithDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [categories, setCategories] = useState<Array<{ id: number; name: string; color?: string | null }>>([])

  // Meta lists for QuickAdd (Budgets, Zweckbindungen, Tags)
  const [earmarks, setEarmarks] = useState<Array<{ id: number; code: string; name: string; color?: string | null }>>([])
  const [budgets, setBudgets] = useState<Array<{ id: number; year: number; name?: string | null; categoryName?: string | null; projectName?: string | null; earmarkId?: number | null; isArchived?: number }>>([])
  const budgetsForEdit = useMemo(() => {
    const byIdEarmark = new Map(earmarks.map((e) => [e.id, e]))
    const makeLabel = (b: any) => {
      if (b.name && String(b.name).trim()) return String(b.name).trim()
      if (b.categoryName && String(b.categoryName).trim()) return `${b.year} · ${b.categoryName}`
      if (b.projectName && String(b.projectName).trim()) return `${b.year} · ${b.projectName}`
      if (b.earmarkId) {
        const em = byIdEarmark.get(Number(b.earmarkId))
        if (em) return `${b.year} · ${em.code}`
      }
      return String(b.year || '')
    }
    return (budgets || []).map((b) => ({ id: b.id, label: makeLabel(b) }))
  }, [budgets, earmarks])

  const [tagDefs, setTagDefs] = useState<Array<{ id: number; name: string; color?: string | null; usage?: number }>>([])
  const [purchaseDescSuggest, setPurchaseDescSuggest] = useState<string[]>([])

  // Modals
  const [createModal, setCreateModal] = useState<null | {
    orderNumber: string
    employeeName: string
    totalAmount: string
    purpose: string
    dueDate: string
    notes: string
  }>(null)

  const [purchaseDraft, setPurchaseDraft] = useState<null | { cashAdvanceId: number; qa: QA }>(null)
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([])
  const purchaseFileInputRef = React.useRef<HTMLInputElement>(null)

  const [partialModal, setPartialModal] = useState<null | {
    cashAdvanceId: number
    recipientName: string
    amount: string
    issuedAt: string
    description: string
  }>(null)

  const [settleModal, setSettleModal] = useState<null | {
    partialId: number
    recipientName: string
    originalAmount: number
    settledAmount: string
    settledAt: string
  }>(null)

  const [resolveModal, setResolveModal] = useState<null | {
    confirmIrreversible: boolean
  }>(null)

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<null | {
    partialId: number
    recipientName: string
    amount: number
  }>(null)

  const [deleteCashAdvanceModal, setDeleteCashAdvanceModal] = useState<null | {
    id: number
    orderNumber: string
    employeeName: string
    totalAmount: number
  }>(null)

  const load = useCallback(async () => {
    // Wait for archive settings to be ready before loading
    if (!archiveSettingsReady) return
    setLoading(true)
    try {
      const res = await (window as any).api?.cashAdvances?.list?.({
        status: statusFilter,
        search: q,
        workYear: showArchived ? undefined : workYear,
        showArchived,
        limit,
        offset
      })
      setItems(res?.items || [])
      setTotal(res?.total || 0)

      if (selectedId && !(res?.items || []).some((x: CashAdvance) => x.id === selectedId)) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [limit, notify, offset, q, selectedId, statusFilter, showArchived, workYear, archiveSettingsReady])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await (window as any).api?.cashAdvances?.getById?.({ id })
      setDetail(res || null)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setDetailLoading(false)
    }
  }, [notify])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selectedId) loadDetail(selectedId) }, [loadDetail, selectedId])

  useEffect(() => {
    let cancelled = false
    const loadCategories = async () => {
      try {
        const res = await (window as any).api?.customCategories?.list?.({ includeInactive: false })
        const list =
          Array.isArray(res) ? res :
          Array.isArray(res?.categories) ? res.categories :
          Array.isArray(res?.rows) ? res.rows :
          Array.isArray(res?.items) ? res.items :
          []
        if (!cancelled) setCategories(list)
      } catch {
        if (!cancelled) setCategories([])
      }
    }
    void loadCategories()
    window.addEventListener('data-changed', loadCategories)
    return () => {
      cancelled = true
      window.removeEventListener('data-changed', loadCategories)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadMeta = async () => {
      try {
        const em = await (window as any).api?.bindings?.list?.({ activeOnly: true })
        const rows = (em as any)?.rows || []
        const active = (rows as any[]).filter((r) => r?.isActive == null || !!r.isActive)
        if (!cancelled) setEarmarks(active)
      } catch {
        if (!cancelled) setEarmarks([])
      }

      try {
        const b = await (window as any).api?.budgets?.list?.({ includeArchived: true })
        const rows = (b as any)?.rows || []
        const active = (rows as any[]).filter((r) => !r?.isArchived)
        if (!cancelled) setBudgets(active)
      } catch {
        if (!cancelled) setBudgets([])
      }

      try {
        const t = await (window as any).api?.tags?.list?.({ includeUsage: true })
        if (!cancelled) setTagDefs((t as any)?.rows || [])
      } catch {
        if (!cancelled) setTagDefs([])
      }
    }

    void loadMeta()
    const onChanged = () => { void loadMeta() }
    window.addEventListener('data-changed', onChanged)
    return () => {
      cancelled = true
      window.removeEventListener('data-changed', onChanged)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        if (!purchaseDraft) return
        const res = await (window as any).api?.vouchers?.recent?.({ limit: 50 })
        const uniq = new Set<string>()
        for (const r of (res?.rows || [])) {
          const d = String(r?.description || '').trim()
          if (d) uniq.add(d)
          if (uniq.size >= 50) break
        }
        if (alive) setPurchaseDescSuggest(Array.from(uniq))
      } catch {
        if (alive) setPurchaseDescSuggest([])
      }
    }
    void load()
    return () => { alive = false }
  }, [purchaseDraft])

  useEffect(() => {
    if (canWrite) return
    setCreateModal(null)
    setPartialModal(null)
    setSettleModal(null)
    setResolveModal(null)
    setDeleteConfirmModal(null)
    setDeleteCashAdvanceModal(null)
  }, [canWrite])

  const confirmDeleteCashAdvance = async () => {
    if (!canWrite) return
    if (!deleteCashAdvanceModal) return
    try {
      await (window as any).api?.cashAdvances?.delete?.({ id: deleteCashAdvanceModal.id })
      notify('success', 'Barvorschuss gelöscht')
      setDeleteCashAdvanceModal(null)
      setSelectedId(null)
      setDetail(null)
      await load()
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Create Cash Advance
  // ─────────────────────────────────────────────────────────────────────────
  const openCreate = async () => {
    if (!canWrite) return
    try {
      const res = await (window as any).api?.cashAdvances?.nextOrderNumber?.()
      setCreateModal({
        orderNumber: res?.orderNumber || '',
        employeeName: '',
        totalAmount: '',
        purpose: '',
        dueDate: '',
        notes: ''
      })
    } catch {
      setCreateModal({
        orderNumber: '',
        employeeName: '',
        totalAmount: '',
        purpose: '',
        dueDate: '',
        notes: ''
      })
    }
  }

  const createCashAdvance = async () => {
    if (!canWrite) return
    if (!createModal) return
    if (!createModal.orderNumber.trim()) {
      notify('error', 'Anordnungsnummer ist erforderlich')
      return
    }
    if (!createModal.employeeName.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    const totalAmount = parseFloat(createModal.totalAmount.replace(',', '.'))
    if (isNaN(totalAmount) || totalAmount <= 0) {
      notify('error', 'Barvorschuss-Betrag muss positiv sein')
      return
    }
    try {
      const res = await (window as any).api?.cashAdvances?.create?.({
        orderNumber: createModal.orderNumber.trim(),
        employeeName: createModal.employeeName.trim(),
        totalAmount,
        purpose: createModal.purpose.trim() || null,
        dueDate: createModal.dueDate || null,
        notes: createModal.notes.trim() || null
      })

      notify('success', 'Barvorschuss angelegt')
      
      setCreateModal(null)
      await load()
      if (res?.id) setSelectedId(res.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Add Partial (Teil-Vorschuss vergeben)
  // ─────────────────────────────────────────────────────────────────────────
  const addPartial = async () => {
    if (!canWrite) return
    if (!partialModal) return
    const amount = parseFloat(partialModal.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      notify('error', 'Betrag muss positiv sein')
      return
    }
    if (!partialModal.recipientName.trim()) {
      notify('error', 'Empfängername ist erforderlich')
      return
    }
    try {
      await (window as any).api?.cashAdvances?.partials?.add?.({
        cashAdvanceId: partialModal.cashAdvanceId,
        recipientName: partialModal.recipientName.trim(),
        amount,
        issuedAt: partialModal.issuedAt || undefined,
        description: partialModal.description.trim() || null
      })
      notify('success', 'Teil-Vorschuss vergeben')
      setPartialModal(null)
      await load()
      if (selectedId) await loadDetail(selectedId)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Delete Partial (Teil-Vorschuss löschen)
  // ─────────────────────────────────────────────────────────────────────────
  const confirmDeletePartial = async () => {
    if (!canWrite) return
    if (!deleteConfirmModal) return
    try {
      await (window as any).api?.cashAdvances?.partials?.delete?.({ id: deleteConfirmModal.partialId })
      notify('success', 'Teil-Vorschuss gelöscht')
      setDeleteConfirmModal(null)
      await load()
      if (selectedId) await loadDetail(selectedId)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const openDeleteConfirm = (p: PartialCashAdvance) => {
    if (!canWrite) return
    setDeleteConfirmModal({
      partialId: p.id,
      recipientName: p.recipientName || 'Unbekannt',
      amount: p.amount
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settle Partial (Teil-Vorschuss auflösen)
  // ─────────────────────────────────────────────────────────────────────────
  const settlePartial = async () => {
    if (!canWrite) return
    if (!settleModal) return
    const settledAmount = parseFloat(settleModal.settledAmount.replace(',', '.'))
    if (isNaN(settledAmount) || settledAmount < 0) {
      notify('error', 'Abgerechneter Betrag darf nicht negativ sein')
      return
    }
    try {
      await (window as any).api?.cashAdvances?.partials?.settle?.({
        id: settleModal.partialId,
        settledAmount,
        settledAt: settleModal.settledAt || undefined
      })
      notify('success', 'Teil-Vorschuss abgerechnet')
      setSettleModal(null)
      await load()
      if (selectedId) await loadDetail(selectedId)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resolve (irreversible close)
  // ─────────────────────────────────────────────────────────────────────────
  const openResolve = () => {
    if (!canWrite) return
    if (!detail) return
    if ((detail.purchases || []).length === 0) {
      notify('error', 'Abschließen ist erst möglich, wenn mindestens ein Kauf erfasst ist')
      return
    }
    setResolveModal({ confirmIrreversible: false })
  }

  const confirmResolve = async () => {
    if (!canWrite) return
    if (!detail || !resolveModal) return
    if (!resolveModal.confirmIrreversible) {
      notify('error', 'Bitte bestätige, dass der Abschluss irreversibel ist')
      return
    }
    try {
      const res = await (window as any).api?.cashAdvances?.resolve?.({
        id: detail.id
      })
      notify('success', res?.id ? 'Barvorschuss abgeschlossen' : 'Barvorschuss abgeschlossen')
      setResolveModal(null)
      await load()
      await loadDetail(detail.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Purchases (Käufe)
  // ─────────────────────────────────────────────────────────────────────────
  const addPurchaseFromQuickAdd = async () => {
    if (!canWrite) return
    if (!purchaseDraft) return
    const { cashAdvanceId, qa } = purchaseDraft

    if (qa.type === 'TRANSFER') {
      notify('error', 'Transfers sind als Kauf nicht erlaubt')
      return
    }

    const mode = (qa as any).mode as 'NET' | 'GROSS' | undefined
    const rawGross = Number((qa as any).grossAmount)
    const rawNet = Number(qa.netAmount)
    const vatRate = Number(qa.vatRate || 0)

    let grossAmount = 0
    let vatRateForPurchase = 0
    if (mode === 'NET') {
      if (!Number.isFinite(rawNet) || rawNet <= 0) {
        notify('error', 'Netto-Betrag muss positiv sein')
        return
      }
      if (!Number.isFinite(vatRate) || vatRate < 0) {
        notify('error', 'USt % ist ungültig')
        return
      }
      grossAmount = Math.round((rawNet * (1 + vatRate / 100)) * 100) / 100
      vatRateForPurchase = vatRate
    } else {
      if (!Number.isFinite(rawGross) || rawGross <= 0) {
        notify('error', 'Brutto-Betrag muss positiv sein')
        return
      }
      grossAmount = rawGross
      vatRateForPurchase = 0
    }

    try {
      await (window as any).api?.cashAdvances?.purchases?.add?.({
        cashAdvanceId,
        date: qa.date,
        sphere: qa.sphere || 'IDEELL',
        categoryId: typeof (qa as any).categoryId === 'number' ? (qa as any).categoryId : null,
        description: (qa.description || '').trim() || null,
        grossAmount,
        vatRate: vatRateForPurchase
      })
      notify('success', 'Kauf erfasst')
      setPurchaseDraft(null)
      setPurchaseFiles([])
      await load()
      if (selectedId) await loadDetail(selectedId)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const deletePurchase = async (id: number) => {
    if (!canWrite) return
    try {
      await (window as any).api?.cashAdvances?.purchases?.delete?.({ id })
      notify('success', 'Kauf gelöscht')
      await load()
      if (selectedId) await loadDetail(selectedId)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Progress Bar Component
  // ─────────────────────────────────────────────────────────────────────────
  const ProgressBar = ({ label, value, max, color, subLabel }: { label: string; value: number; max: number; color: string; subLabel?: string }) => {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="helper">{label}</span>
          <span style={{ fontWeight: 600, color }}>{eurFmt.format(value)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        {subLabel && <div className="helper" style={{ fontSize: 11, marginTop: 2 }}>{subLabel}</div>}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
      <div>
        <h1 style={{ margin: 0 }}>Barvorschüsse</h1>
        <div className="helper">Kassier holt Vorschuss → vergibt an Personen → Abrechnung</div>
      </div>
      {canWrite && <button className="btn primary" onClick={openCreate}>+ Barvorschuss</button>}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ gridColumn: '1 / -1' }}>{header}</div>

      {/* List */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => { setOffset(0); setQ(e.target.value) }}
            placeholder="Suchen: Anordnungsnr., Name, Zweck…"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => { setOffset(0); setStatusFilter(e.target.value as any) }}
            >
              <option value="ALL">Alle</option>
              <option value="OPEN">Offen</option>
              <option value="RESOLVED">Erledigt</option>
              <option value="OVERDUE">Überfällig</option>
            </select>
            <div className="helper" style={{ alignSelf: 'center', textAlign: 'right' }}>{total} Treffer</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {loading ? (
            <div className="helper">Lade…</div>
          ) : items.length === 0 ? (
            <div className="helper">Keine Barvorschüsse gefunden.</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                className="btn ghost"
                onClick={() => setSelectedId(it.id)}
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderRadius: 10,
                  border: selectedId === it.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedId === it.id ? 'var(--accent-bg)' : 'transparent',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{it.orderNumber}</div>
                  <div style={{ 
                    fontSize: 11, 
                    padding: '2px 8px', 
                    borderRadius: 10,
                    background: it.status === 'RESOLVED' ? '#4CAF5020' : it.status === 'OVERDUE' ? '#F4433620' : 'var(--surface-alt)',
                    color: it.status === 'RESOLVED' ? '#4CAF50' : it.status === 'OVERDUE' ? '#F44336' : 'var(--text)'
                  }}>
                    {it.status === 'OPEN' ? 'Offen' : it.status === 'RESOLVED' ? 'Erledigt' : 'Überfällig'}
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: 13 }}>{it.purpose || it.employeeName}</div>
                
                {/* Vorschuss und Fortschritt */}
                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span className="helper">Vorschuss:</span>
                    <span style={{ fontWeight: 600 }}>{eurFmt.format(it.totalAmount)}</span>
                  </div>
                  
                  {/* Mini-Fortschrittsbalken */}
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(100, (it.totalSettled / it.totalAmount) * 100)}%`, 
                      background: it.status === 'RESOLVED' ? '#4CAF50' : it.totalSettled > it.totalAmount ? '#F44336' : '#FF9800',
                      borderRadius: 2 
                    }} />
                  </div>
                  
                  {/* Status-abhängige Anzeige */}
                  {it.status === 'RESOLVED' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span className="helper">Abgerechnet:</span>
                      <span style={{ color: '#4CAF50', fontWeight: 600 }}>{eurFmt.format(it.totalSettled)}</span>
                    </div>
                  ) : (
                    <>
                      {it.recipientCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span className="helper">👥 {it.recipientCount} Person{it.recipientCount !== 1 ? 'en' : ''}</span>
                          <span className="helper">Vergeben: {eurFmt.format(it.totalPlanned)}</span>
                        </div>
                      )}
                      {it.totalSettled > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span className="helper">Ausgegeben:</span>
                          <span style={{ color: it.totalSettled > it.totalAmount ? '#F44336' : '#4CAF50' }}>
                            {eurFmt.format(it.totalSettled)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {/* Connection arrow for selected item */}
                {selectedId === it.id && (
                  <div style={{
                    position: 'absolute',
                    right: -16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 0,
                    height: 0,
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent',
                    borderLeft: '16px solid var(--accent)',
                    zIndex: 10
                  }} />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="card" style={{ 
        padding: 16, 
        minHeight: 420, 
        borderLeft: selectedId ? '3px solid var(--accent)' : undefined
      }}>
        {!selectedId ? (
          <div className="helper" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
            <div>Wähle links einen Barvorschuss aus.</div>
          </div>
        ) : detailLoading ? (
          <div className="helper">Details laden…</div>
        ) : !detail ? (
          <div className="helper">Nicht gefunden.</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{detail.orderNumber}</h2>
                <div className="helper">Kassier: {detail.employeeName}</div>
                {detail.purpose ? <div className="helper" style={{ marginTop: 4 }}>{detail.purpose}</div> : null}
                {detail.dueDate ? <div className="helper" style={{ marginTop: 4 }}>Fällig: {detail.dueDate}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-block',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 13,
                  background: detail.status === 'RESOLVED' ? '#4CAF5020' : detail.status === 'OVERDUE' ? '#F4433620' : 'var(--surface-alt)',
                  color: detail.status === 'RESOLVED' ? '#4CAF50' : detail.status === 'OVERDUE' ? '#F44336' : 'var(--text)'
                }}>
                  {detail.status === 'OPEN' ? '🔓 Offen' : detail.status === 'RESOLVED' ? '✓ Erledigt' : '⚠️ Überfällig'}
                </div>
                <div style={{ marginTop: 8 }}>
                  {detail.status === 'OPEN' && (
                    (() => {
                      const canResolve = (detail.purchases || []).length > 0
                      return (
                    canWrite ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            className="btn ghost danger"
                            onClick={() => {
                              setDeleteCashAdvanceModal({
                                id: detail.id,
                                orderNumber: detail.orderNumber,
                                employeeName: detail.employeeName,
                                totalAmount: detail.totalAmount
                              })
                            }}
                            title="Barvorschuss löschen"
                          >
                            🗑 Löschen
                          </button>
                          <button
                            className="btn primary"
                            onClick={openResolve}
                            aria-disabled={!canResolve}
                            title={!canResolve
                              ? 'Abschließen ist erst möglich, wenn mindestens ein Kauf erfasst ist'
                              : undefined}
                            style={{
                              fontSize: 13,
                              opacity: canResolve ? 1 : 0.6,
                              cursor: canResolve ? 'pointer' : 'not-allowed'
                            }}
                          >
                            ✓ Abschließen
                          </button>
                        </div>
                    ) : null
                      )
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Visual Progress Bars */}
            <div className="card" style={{ padding: 16, background: 'var(--surface-alt)' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Barvorschuss: {eurFmt.format(detail.totalAmount)}</div>
              
              <ProgressBar 
                label="Vergeben (Planerisch)" 
                value={detail.totalPlanned} 
                max={detail.totalAmount}
                color={detail.totalPlanned > detail.totalAmount ? '#F44336' : detail.totalPlanned >= detail.totalAmount * 0.9 ? '#FF9800' : '#2196F3'}
                subLabel={`Noch verfügbar: ${eurFmt.format(detail.plannedRemaining)}`}
              />
              
              <ProgressBar 
                label="Ausgegeben (Faktisch)" 
                value={detail.totalSettled} 
                max={detail.totalAmount}
                color={detail.totalSettled > detail.totalAmount ? '#F44336' : detail.totalSettled >= detail.totalAmount * 0.9 ? '#FF9800' : '#4CAF50'}
                subLabel={`Faktisch verfügbar: ${eurFmt.format(detail.actualRemaining)}`}
              />
              
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {canWrite && detail.status !== 'RESOLVED' && (
                <button
                  className="btn"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    const qa: QA = {
                      date: today,
                      type: 'OUT',
                      sphere: 'IDEELL',
                      mode: 'GROSS',
                      grossAmount: 0,
                      vatRate: 0,
                      description: '',
                      paymentMethod: 'BAR',
                      budgets: [],
                      earmarksAssigned: [],
                      tags: [],
                      categoryId: null,
                      taxonomySelectionById: {}
                    }
                    setPurchaseDraft({ cashAdvanceId: detail.id, qa })
                  }}
                >
                  + Kauf erfassen
                </button>
              )}
              {canWrite && detail.status !== 'RESOLVED' && (
                <button
                  className="btn primary"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    setPartialModal({ cashAdvanceId: detail.id, recipientName: '', amount: '', issuedAt: today, description: '' })
                  }}
                >
                  + Vorschuss vergeben
                </button>
              )}
            </div>

            {/* Käufe */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Käufe</div>
              {(detail.purchases || []).length === 0 ? (
                <div className="helper">Noch keine Käufe erfasst.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {(detail.purchases || []).map((k) => (
                    <div key={k.id} className="card" style={{ padding: 12, background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {k.description || 'Ohne Beschreibung'}
                          </div>
                          <div className="helper" style={{ marginTop: 4 }}>
                            {k.date} · {k.sphere}
                            {k.categoryId ? (() => {
                              const cat = (Array.isArray(categories) ? categories : []).find((c) => c.id === k.categoryId)
                              return ` · ${cat?.name || `Kategorie #${k.categoryId}`}`
                            })() : ''}
                            {k.vatRate ? ` · ${k.vatRate}% MwSt.` : ''}
                          </div>
                          {k.postedVoucherId ? (
                            <div className="helper" style={{ marginTop: 4 }}>Gebucht (Beleg-ID: {k.postedVoucherId})</div>
                          ) : null}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{eurFmt.format(k.grossAmount)}</div>
                          {canWrite && detail.status !== 'RESOLVED' && !k.postedVoucherId ? (
                            <div style={{ marginTop: 8 }}>
                              <button
                                className="btn ghost danger"
                                style={{ fontSize: 12, padding: '4px 8px' }}
                                onClick={() => deletePurchase(k.id)}
                                title="Löschen"
                              >
                                🗑
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="helper" style={{ marginTop: 8 }}>
                Hinweis: Diese Käufe werden erst beim Abschluss als Buchungen ins Journal übernommen.
              </div>
            </div>

            {/* Teil-Vorschüsse */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Teil-Vorschüsse an Personen</div>
              {detail.partials.length === 0 ? (
                <div className="helper">Noch keine Teil-Vorschüsse vergeben.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {detail.partials.map((p) => (
                    <div key={p.id} className="card" style={{ 
                      padding: 12, 
                      background: p.isSettled ? 'var(--surface-alt)' : 'var(--surface)',
                      borderLeft: p.isSettled ? '3px solid #4CAF50' : '3px solid #2196F3'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.recipientName || 'Unbekannt'}
                            {p.isSettled && <span style={{ fontSize: 11, color: '#4CAF50' }}>✓ Abgerechnet</span>}
                          </div>
                          <div className="helper">{p.description || 'Kein Zweck angegeben'}</div>
                          <div className="helper" style={{ marginTop: 4 }}>Vergeben: {p.issuedAt}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{eurFmt.format(p.amount)}</div>
                          {p.isSettled ? (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ color: p.settledAmount! > p.amount ? '#F44336' : '#4CAF50', fontWeight: 600, fontSize: 13 }}>
                                → {eurFmt.format(p.settledAmount || 0)}
                              </div>
                              <div className="helper" style={{ fontSize: 11 }}>{p.settledAt}</div>
                            </div>
                          ) : (
                            canWrite ? (
                              <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
                                <button
                                  className="btn primary"
                                  style={{ fontSize: 12, padding: '4px 10px' }}
                                  disabled={detail.status === 'RESOLVED'}
                                  onClick={() => {
                                    const today = new Date().toISOString().slice(0, 10)
                                    setSettleModal({
                                      partialId: p.id,
                                      recipientName: p.recipientName || 'Unbekannt',
                                      originalAmount: p.amount,
                                      settledAmount: '',
                                      settledAt: today
                                    })
                                  }}
                                  title="Abrechnen"
                                >
                                  💰 Abrechnen
                                </button>
                                <button
                                  className="btn ghost danger"
                                  style={{ fontSize: 12, padding: '4px 8px' }}
                                  disabled={detail.status === 'RESOLVED'}
                                  onClick={() => openDeleteConfirm(p)}
                                  title="Löschen"
                                >
                                  🗑
                                </button>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.notes && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Notizen</div>
                <div className="helper" style={{ whiteSpace: 'pre-wrap' }}>{detail.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {canWrite && createModal && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <ModalHeader title="Barvorschuss anlegen" onClose={() => setCreateModal(null)} />
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="ca-order">Anordnungsnummer *</label>
                  <input
                    id="ca-order"
                    className="input"
                    value={createModal.orderNumber}
                    onChange={(e) => setCreateModal({ ...createModal, orderNumber: e.target.value })}
                    placeholder="BV-2025-0001"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label htmlFor="ca-name">Kassier (Name) *</label>
                  <input
                    id="ca-name"
                    className="input"
                    value={createModal.employeeName}
                    onChange={(e) => setCreateModal({ ...createModal, employeeName: e.target.value })}
                    placeholder="Wer holt den Vorschuss"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="ca-amount">Barvorschuss-Betrag (€) *</label>
                  <input
                    id="ca-amount"
                    className="input"
                    value={createModal.totalAmount}
                    onChange={(e) => setCreateModal({ ...createModal, totalAmount: e.target.value })}
                    placeholder="z.B. 1000,00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="ca-due">Fälligkeitsdatum</label>
                  <input
                    id="ca-due"
                    type="date"
                    className="input"
                    value={createModal.dueDate}
                    onChange={(e) => setCreateModal({ ...createModal, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="ca-purpose">Zweck</label>
                <input
                  id="ca-purpose"
                  className="input"
                  value={createModal.purpose}
                  onChange={(e) => setCreateModal({ ...createModal, purpose: e.target.value })}
                  placeholder="z.B. Fahrtkosten Turnier"
                />
              </div>
              <div className="field">
                <label htmlFor="ca-notes">Notizen</label>
                <textarea
                  id="ca-notes"
                  className="input"
                  rows={3}
                  value={createModal.notes}
                  onChange={(e) => setCreateModal({ ...createModal, notes: e.target.value })}
                  placeholder="Interne Notizen…"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setCreateModal(null)}>Abbrechen</button>
              <button className="btn primary" onClick={createCashAdvance}>Anlegen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Purchase Modal (Kauf erfassen) – reuse booking modal UI (no attachments) */}
      {canWrite && purchaseDraft && createPortal(
        <div role="dialog" aria-modal="true" onClick={() => { setPurchaseDraft(null); setPurchaseFiles([]) }}>
          <div onClick={(e) => e.stopPropagation()}>
            <QuickAddModal
              title="Kauf erfassen"
              hideAttachments
              qa={purchaseDraft.qa}
              setQa={(qa) => setPurchaseDraft({ ...purchaseDraft, qa })}
              onSave={addPurchaseFromQuickAdd}
              onClose={() => { setPurchaseDraft(null); setPurchaseFiles([]) }}
              files={purchaseFiles}
              setFiles={setPurchaseFiles}
              openFilePicker={() => purchaseFileInputRef.current?.click()}
              onDropFiles={(fileList) => {
                if (!fileList) return
                setPurchaseFiles((prev) => [...prev, ...Array.from(fileList)])
              }}
              fileInputRef={purchaseFileInputRef}
              fmtDate={fmtDate}
              eurFmt={eurFmt}
              budgetsForEdit={budgetsForEdit}
              earmarks={earmarks}
              tagDefs={tagDefs}
              descSuggest={purchaseDescSuggest}
              customCategories={Array.isArray(categories) ? categories : []}
              useCategoriesModule
            />
          </div>
        </div>,
        document.body
      )}

      {/* Partial Modal (Vorschuss vergeben) */}
      {canWrite && partialModal && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <ModalHeader title="Teil-Vorschuss vergeben" onClose={() => setPartialModal(null)} />
            <div className="helper" style={{ marginBottom: 12 }}>
              Vergib einen Teil des Barvorschusses an eine Person. 
              Noch verfügbar: {eurFmt.format(detail?.plannedRemaining || 0)}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="field">
                <label htmlFor="partial-name">Empfänger *</label>
                <input
                  id="partial-name"
                  className="input"
                  value={partialModal.recipientName}
                  onChange={(e) => setPartialModal({ ...partialModal, recipientName: e.target.value })}
                  placeholder="z.B. Peter Müller"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="partial-amount">Betrag (€) *</label>
                  <input
                    id="partial-amount"
                    className="input"
                    value={partialModal.amount}
                    onChange={(e) => setPartialModal({ ...partialModal, amount: e.target.value })}
                    placeholder="z.B. 250,00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="partial-date">Datum</label>
                  <input
                    id="partial-date"
                    type="date"
                    className="input"
                    value={partialModal.issuedAt}
                    onChange={(e) => setPartialModal({ ...partialModal, issuedAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="partial-desc">Verwendungszweck</label>
                <input
                  id="partial-desc"
                  className="input"
                  value={partialModal.description}
                  onChange={(e) => setPartialModal({ ...partialModal, description: e.target.value })}
                  placeholder="z.B. Turnier Fahrtkosten"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setPartialModal(null)}>Abbrechen</button>
              <button className="btn primary" onClick={addPartial}>Vergeben</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settle Modal (Vorschuss abrechnen) */}
      {canWrite && settleModal && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <ModalHeader title="Teil-Vorschuss abrechnen" onClose={() => setSettleModal(null)} />
            <div className="helper" style={{ marginBottom: 12 }}>
              <strong>{settleModal.recipientName}</strong> hat {eurFmt.format(settleModal.originalAmount)} erhalten.
              <br />Wie viel wurde tatsächlich ausgegeben?
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="settle-amount">Abgerechneter Betrag (€) *</label>
                  <input
                    id="settle-amount"
                    className="input"
                    value={settleModal.settledAmount}
                    onChange={(e) => setSettleModal({ ...settleModal, settledAmount: e.target.value })}
                    placeholder={`z.B. ${settleModal.originalAmount.toFixed(2).replace('.', ',')}`}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label htmlFor="settle-date">Abrechnungsdatum</label>
                  <input
                    id="settle-date"
                    type="date"
                    className="input"
                    value={settleModal.settledAt}
                    onChange={(e) => setSettleModal({ ...settleModal, settledAt: e.target.value })}
                  />
                </div>
              </div>
              {settleModal.settledAmount && !isNaN(parseFloat(settleModal.settledAmount.replace(',', '.'))) && (
                <div className="card" style={{ padding: 12, background: 'var(--surface-alt)' }}>
                  <div className="helper">Differenz zum Vorschuss:</div>
                  {(() => {
                    const settled = parseFloat(settleModal.settledAmount.replace(',', '.'))
                    const diff = settled - settleModal.originalAmount
                    return (
                      <div style={{ fontWeight: 700, color: diff > 0 ? '#F44336' : diff < 0 ? '#4CAF50' : 'var(--text)' }}>
                        {diff > 0 ? '+' : ''}{eurFmt.format(diff)}
                        {diff > 0 ? ' (Nachschuss nötig)' : diff < 0 ? ' (Rückgeld)' : ' (Genau)'}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setSettleModal(null)}>Abbrechen</button>
              <button className="btn primary" onClick={settlePartial}>Abrechnen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Resolve Modal (irreversibel abschließen) */}
      {canWrite && resolveModal && detail && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <ModalHeader title="Barvorschuss abschließen" onClose={() => setResolveModal(null)} />
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="card" style={{ padding: 12, background: 'var(--surface-alt)' }}>
                <div style={{ fontWeight: 700 }}>⚠️ Irreversibel</div>
                <div className="helper" style={{ marginTop: 4 }}>
                  Nach dem Abschluss kann der Barvorschuss nicht wieder geöffnet werden.
                </div>
              </div>

              {(() => {
                const diff = (detail.totalAmount || 0) - (detail.totalSettled || 0)
                const abs = Math.abs(diff)
                const label = diff > 0 ? 'Rückgeld (unter Ausgaben)' : diff < 0 ? 'Nachschuss (über Ausgaben)' : 'Keine Differenz'
                const color = diff > 0 ? '#4CAF50' : diff < 0 ? '#F44336' : 'var(--text)'
                return (
                  <div className="card" style={{ padding: 12 }}>
                    <div className="helper">Differenz (Vorschuss − Ausgegeben)</div>
                    <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4, color }}>
                      {diff > 0 ? '+' : diff < 0 ? '-' : ''}{eurFmt.format(abs)}
                    </div>
                    <div className="helper" style={{ marginTop: 4 }}>{label}</div>

                    <div className="helper" style={{ marginTop: 12 }}>
                      Hinweis: Die Differenz wird nicht automatisch als Buchung erfasst.
                    </div>
                  </div>
                )
              })()}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={resolveModal.confirmIrreversible}
                  onChange={(e) => setResolveModal({ ...resolveModal, confirmIrreversible: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Ich bestätige: Abschluss ist irreversibel</div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setResolveModal(null)}>Abbrechen</button>
              <button className="btn primary" onClick={confirmResolve}>
                Abschließen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {canWrite && deleteConfirmModal && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Teil-Vorschuss löschen"
          onClick={() => setDeleteConfirmModal(null)}
        >
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Teil-Vorschuss löschen?" onClose={() => setDeleteConfirmModal(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du diesen Teil-Vorschuss wirklich löschen?
                </div>
                <div className="helper">
                  {deleteConfirmModal.recipientName} · {eurFmt.format(deleteConfirmModal.amount)}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn ghost" onClick={() => setDeleteConfirmModal(null)}>Abbrechen</button>
                <button className="btn danger" onClick={confirmDeletePartial}>Löschen</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Cash Advance Confirmation Modal */}
      {canWrite && deleteCashAdvanceModal && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Barvorschuss löschen"
          onClick={() => setDeleteCashAdvanceModal(null)}
        >
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Barvorschuss löschen?" onClose={() => setDeleteCashAdvanceModal(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du diesen Barvorschuss wirklich löschen?
                </div>
                <div className="helper">
                  {deleteCashAdvanceModal.orderNumber} · {deleteCashAdvanceModal.employeeName} · {eurFmt.format(deleteCashAdvanceModal.totalAmount)}
                </div>
                <div className="helper" style={{ marginTop: 10 }}>
                  Hinweis: Der Platzhalter im Journal wird ebenfalls entfernt.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn ghost" onClick={() => setDeleteCashAdvanceModal(null)}>Abbrechen</button>
                <button className="btn danger" onClick={confirmDeleteCashAdvance}>Löschen</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
