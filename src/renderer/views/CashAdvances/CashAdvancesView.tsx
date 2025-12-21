import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import ModalHeader from '../../components/ModalHeader'
import { useToast } from '../../context/ToastContext'

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

type CashAdvanceWithDetails = CashAdvance & {
  partials: PartialCashAdvance[]
  settlements: any[]
  totalPlanned: number
  totalSettled: number
  plannedRemaining: number
  actualRemaining: number
  coverage: number
}

export default function CashAdvancesView() {
  const { notify } = useToast()
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

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

  // Modals
  const [createModal, setCreateModal] = useState<null | {
    orderNumber: string
    employeeName: string
    totalAmount: string
    purpose: string
    dueDate: string
    notes: string
    createVoucher: boolean
  }>(null)

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
    createCounterVoucher: boolean
    confirmIrreversible: boolean
  }>(null)

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<null | {
    partialId: number
    recipientName: string
    amount: number
  }>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await (window as any).api?.cashAdvances?.list?.({
        status: statusFilter,
        search: q,
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
  }, [limit, notify, offset, q, selectedId, statusFilter])

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

  // ─────────────────────────────────────────────────────────────────────────
  // Create Cash Advance
  // ─────────────────────────────────────────────────────────────────────────
  const openCreate = async () => {
    try {
      const res = await (window as any).api?.cashAdvances?.nextOrderNumber?.()
      const today = new Date().toISOString().slice(0, 10)
      setCreateModal({
        orderNumber: res?.orderNumber || '',
        employeeName: '',
        totalAmount: '',
        purpose: '',
        dueDate: '',
        notes: '',
        createVoucher: false
      })
    } catch {
      setCreateModal({
        orderNumber: '',
        employeeName: '',
        totalAmount: '',
        purpose: '',
        dueDate: '',
        notes: '',
        createVoucher: false
      })
    }
  }

  const createCashAdvance = async () => {
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
      
      // Optional: Als Buchung anlegen
      if (createModal.createVoucher) {
        try {
          const today = new Date().toISOString().slice(0, 10)
          await (window as any).api?.vouchers?.create?.({
            date: today,
            type: 'OUT', // Barvorschuss ist eine Ausgabe
            sphere: 'IDEELL', // Standard-Sphäre für Jugendförderung
            description: `Barvorschuss ${createModal.orderNumber.trim()} - ${createModal.purpose.trim() || createModal.employeeName.trim()}`,
            grossAmount: totalAmount,
            vatRate: 0, // Barvorschüsse sind ohne MwSt
            paymentMethod: 'BAR'
          })
          notify('success', 'Barvorschuss und Buchung angelegt')
        } catch (e: any) {
          notify('error', `Barvorschuss angelegt, aber Buchung fehlgeschlagen: ${e?.message}`)
        }
      } else {
        notify('success', 'Barvorschuss angelegt')
      }
      
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
    if (!detail) return
    const allPartialsSettled = detail.partials.every((p) => p.isSettled)
    if (!allPartialsSettled) {
      notify('error', 'Abschließen ist erst möglich, wenn alle Teil-Vorschüsse abgerechnet sind')
      return
    }
    setResolveModal({ createCounterVoucher: false, confirmIrreversible: false })
  }

  const confirmResolve = async () => {
    if (!detail || !resolveModal) return
    if (!resolveModal.confirmIrreversible) {
      notify('error', 'Bitte bestätige, dass der Abschluss irreversibel ist')
      return
    }
    try {
      const res = await (window as any).api?.cashAdvances?.resolve?.({
        id: detail.id,
        createCounterVoucher: resolveModal.createCounterVoucher
      })
      notify('success', res?.counterVoucherId ? 'Barvorschuss abgeschlossen und Differenz gebucht' : 'Barvorschuss abgeschlossen')
      setResolveModal(null)
      await load()
      await loadDetail(detail.id)
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
      <button className="btn primary" onClick={openCreate}>+ Barvorschuss</button>
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
                      const canResolve = detail.partials.every((p) => p.isSettled)
                      return (
                    <button
                      className="btn primary"
                      onClick={openResolve}
                      aria-disabled={!canResolve}
                      title={!canResolve
                        ? 'Abschließen ist erst möglich, wenn alle Teil-Vorschüsse abgerechnet sind'
                        : undefined}
                      style={{
                        fontSize: 13,
                        opacity: canResolve ? 1 : 0.6,
                        cursor: canResolve ? 'pointer' : 'not-allowed'
                      }}
                    >
                      ✓ Abschließen
                    </button>
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
              <button
                className="btn primary"
                disabled={detail.status === 'RESOLVED'}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10)
                  setPartialModal({ cashAdvanceId: detail.id, recipientName: '', amount: '', issuedAt: today, description: '' })
                }}
              >
                + Vorschuss vergeben
              </button>
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
      {createModal && createPortal(
        <div className="modal-overlay" onClick={() => setCreateModal(null)} role="dialog" aria-modal="true">
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
              
              {/* Option: Als Buchung anlegen */}
              <div className="card" style={{ padding: 12, background: 'var(--surface-alt)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createModal.createVoucher}
                    onChange={(e) => setCreateModal({ ...createModal, createVoucher: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>📝 Auch als Buchung anlegen</div>
                    <div className="helper" style={{ marginTop: 2 }}>
                      Erstellt automatisch eine Ausgabe-Buchung für diesen Barvorschuss
                    </div>
                  </div>
                </label>
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

      {/* Partial Modal (Vorschuss vergeben) */}
      {partialModal && createPortal(
        <div className="modal-overlay" onClick={() => setPartialModal(null)} role="dialog" aria-modal="true">
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
      {settleModal && createPortal(
        <div className="modal-overlay" onClick={() => setSettleModal(null)} role="dialog" aria-modal="true">
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
      {resolveModal && detail && createPortal(
        <div className="modal-overlay" onClick={() => setResolveModal(null)} role="dialog" aria-modal="true">
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

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: abs > 0 ? 'pointer' : 'not-allowed' }}>
                        <input
                          type="checkbox"
                          checked={resolveModal.createCounterVoucher}
                          disabled={abs === 0}
                          onChange={(e) => setResolveModal({ ...resolveModal, createCounterVoucher: e.target.checked })}
                          style={{ width: 18, height: 18 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>🧾 Differenz gegenbuchen</div>
                          <div className="helper" style={{ marginTop: 2 }}>
                            Erstellt eine {diff > 0 ? 'Einnahme' : diff < 0 ? 'Ausgabe' : ''}-Buchung (Zahlweg: BAR)
                          </div>
                        </div>
                      </label>
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
      {deleteConfirmModal && createPortal(
        <div className="modal-backdrop" onClick={() => setDeleteConfirmModal(null)}>
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
    </div>
  )
}
