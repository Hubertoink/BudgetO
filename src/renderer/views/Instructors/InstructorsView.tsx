import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import ModalHeader from '../../components/ModalHeader'
import LoadingState from '../../components/LoadingState'
import { useToast } from '../../context/ToastContext'

type InstructorStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

interface Instructor {
  id: number
  name: string
  status: InstructorStatus
  yearlyCap: number | null
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

interface InstructorContract {
  id: number
  instructorId: number
  title: string | null
  startDate: string | null
  endDate: string | null
  fileName: string
  mimeType: string | null
  size: number | null
  createdAt: string
}

interface InstructorInvoice {
  id: number
  instructorId: number
  date: string
  description: string | null
  amount: number
  voucherId: number | null
  fileName: string | null
  filePath: string | null
  mimeType: string | null
  fileSize: number | null
  createdAt: string
}

const STATUS_LABELS: Record<InstructorStatus, string> = {
  ACTIVE: 'Aktiv',
  INACTIVE: 'Inaktiv',
  PENDING: 'Ausstehend'
}

const STATUS_COLORS: Record<InstructorStatus, string> = {
  ACTIVE: 'var(--success)',
  INACTIVE: 'var(--muted)',
  PENDING: 'var(--warning)'
}

export default function InstructorsView() {
  const { notify } = useToast()
  
  const [rows, setRows] = useState<Instructor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<InstructorStatus | 'ALL'>('ALL')
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const [form, setForm] = useState<null | { 
    mode: 'create' | 'edit'; 
    draft: Partial<Instructor>;
    withContract?: boolean;
    contractDraft?: { title: string; startDate: string; endDate: string; file: File | null };
  }>(null)
  const createContractFileRef = useRef<HTMLInputElement>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<null | { id: number; name: string }>(null)
  const [detail, setDetail] = useState<null | (Instructor & { contracts: InstructorContract[]; invoices: InstructorInvoice[]; totalInvoiced: number })>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Invoice add form
  const [invoiceForm, setInvoiceForm] = useState<null | { instructorId: number; instructorName: string; date: string; description: string; amount: string; file: File | null }>(null)
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)
  // Contract upload form
  const [contractForm, setContractForm] = useState<null | { instructorId: number; title: string; startDate: string; endDate: string; file: File | null }>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await (window as any).api?.instructors?.list?.({
        q: q || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit,
        offset
      })
      setRows(res?.rows || [])
      setTotal(res?.total || 0)
    } catch (e: any) {
      notify('error', e?.message || 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [q, statusFilter, limit, offset, notify])

  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await (window as any).api?.instructors?.get?.({ id })
      setDetail(res)
    } catch (e: any) {
      notify('error', e?.message || 'Details laden fehlgeschlagen')
    } finally {
      setDetailLoading(false)
    }
  }, [notify])

  const saveForm = async () => {
    if (!form) return
    try {
      if (form.mode === 'create') {
        const result = await (window as any).api?.instructors?.create?.({
          name: form.draft.name,
          status: form.draft.status || 'ACTIVE',
          yearlyCap: form.draft.yearlyCap ?? null,
          notes: form.draft.notes ?? null
        })
        const newId = result?.id
        
        // If contract was included, upload it
        if (form.withContract && form.contractDraft && newId) {
          let fileName: string | null = null
          let dataBase64: string | null = null
          let mimeType: string | null = null
          
          if (form.contractDraft.file) {
            const file = form.contractDraft.file
            fileName = file.name
            mimeType = file.type || 'application/octet-stream'
            const buffer = await file.arrayBuffer()
            dataBase64 = btoa(
              new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            )
          }
          
          await (window as any).api?.instructors?.contracts?.add?.({
            instructorId: newId,
            title: form.contractDraft.title || 'Vertrag',
            startDate: form.contractDraft.startDate || null,
            endDate: form.contractDraft.endDate || null,
            fileName,
            dataBase64,
            mimeType
          })
        }
        
        notify('success', form.withContract ? 'Übungsleiter mit Vertrag angelegt' : 'Übungsleiter angelegt')
      } else {
        await (window as any).api?.instructors?.update?.({
          id: form.draft.id,
          name: form.draft.name,
          status: form.draft.status,
          yearlyCap: form.draft.yearlyCap,
          notes: form.draft.notes
        })
        notify('success', 'Änderungen gespeichert')
      }
      setForm(null)
      load()
      if (detail && form.draft.id === detail.id) loadDetail(detail.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const doDelete = async () => {
    if (!deleteConfirm) return
    try {
      await (window as any).api?.instructors?.delete?.({ id: deleteConfirm.id })
      notify('success', `${deleteConfirm.name} gelöscht`)
      setDeleteConfirm(null)
      if (detail?.id === deleteConfirm.id) setDetail(null)
      load()
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const addInvoice = async () => {
    if (!invoiceForm) return
    const amount = parseFloat(invoiceForm.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      notify('error', 'Betrag muss positiv sein')
      return
    }
    try {
      // Prepare file data if a file is attached
      let fileName: string | null = null
      let dataBase64: string | null = null
      let mimeType: string | null = null

      if (invoiceForm.file) {
        const file = invoiceForm.file
        fileName = file.name
        mimeType = file.type || null
        
        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
          reader.readAsDataURL(file)
        })
        dataBase64 = base64
      }

      await (window as any).api?.instructors?.invoices?.add?.({
        instructorId: invoiceForm.instructorId,
        date: invoiceForm.date,
        description: invoiceForm.description || null,
        amount,
        fileName,
        dataBase64,
        mimeType
      })
      notify('success', 'Rechnung hinzugefügt')
      setInvoiceForm(null)
      if (detail) loadDetail(detail.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const openInvoiceFile = async (invoiceId: number) => {
    try {
      const res = await (window as any).api?.instructors?.invoices?.open?.({ invoiceId })
      if (!res?.ok) {
        notify('error', 'Datei konnte nicht geöffnet werden')
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const deleteInvoice = async (invoiceId: number) => {
    try {
      await (window as any).api?.instructors?.invoices?.delete?.({ invoiceId })
      notify('success', 'Rechnung gelöscht')
      if (detail) loadDetail(detail.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const addContract = async () => {
    if (!contractForm || !contractForm.file) {
      notify('error', 'Bitte eine Datei auswählen')
      return
    }
    try {
      const file = contractForm.file
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        await (window as any).api?.instructors?.contracts?.add?.({
          instructorId: contractForm.instructorId,
          title: contractForm.title || null,
          startDate: contractForm.startDate || null,
          endDate: contractForm.endDate || null,
          fileName: file.name,
          dataBase64: base64,
          mimeType: file.type || null
        })
        notify('success', 'Vertrag hochgeladen')
        setContractForm(null)
        if (detail) loadDetail(detail.id)
      }
      reader.onerror = () => {
        notify('error', 'Datei konnte nicht gelesen werden')
      }
      reader.readAsDataURL(file)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const openContract = async (contractId: number) => {
    try {
      const res = await (window as any).api?.instructors?.contracts?.open?.({ contractId })
      if (!res?.ok) {
        notify('error', 'Datei konnte nicht geöffnet werden')
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const deleteContract = async (contractId: number) => {
    try {
      await (window as any).api?.instructors?.contracts?.delete?.({ contractId })
      notify('success', 'Vertrag gelöscht')
      if (detail) loadDetail(detail.id)
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // Create a voucher from an invoice (triggers global Quick-Add)
  const createVoucherFromInvoice = async (invoice: InstructorInvoice) => {
    if (!detail) return
    // Trigger the global Quick-Add with pre-filled data
    const event = new CustomEvent('quick-add-prefill', {
      detail: {
        type: 'OUT',
        sphere: 'IDEELL',
        description: `ÜL: ${detail.name} – ${invoice.description || 'Honorar'}`,
        grossAmount: invoice.amount,
        date: invoice.date
      }
    })
    window.dispatchEvent(event)
    // Also trigger the FAB click to open the modal
    const fab = document.querySelector('.fab-buchung') as HTMLButtonElement | null
    if (fab) fab.click()
  }

  // Calculate yearly cap status
  const getCapStatus = (instructor: typeof detail) => {
    if (!instructor || instructor.yearlyCap === null) return null
    const used = instructor.totalInvoiced
    const cap = instructor.yearlyCap
    const remaining = cap - used
    const percentage = (used / cap) * 100
    
    return {
      used,
      cap,
      remaining,
      percentage: Math.min(100, percentage),
      isOverCap: remaining < 0,
      isNearCap: percentage >= 80 && percentage < 100
    }
  }

  const capStatus = detail ? getCapStatus(detail) : null

  return (
    <div className="instructors-view" style={{ display: 'grid', gap: 16 }}>
      {/* Header Card */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Übungsleiter</h1>
            <div className="helper" style={{ marginTop: 4 }}>Verwalte Übungsleiter, Verträge und Honorare</div>
          </div>
          <button className="btn primary" onClick={() => setForm({ mode: 'create', draft: { status: 'ACTIVE', yearlyCap: 3000 } })}>
            + Neuer Übungsleiter
          </button>
        </div>

        {/* Filter Row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder="Suchen …"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0) }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select 
            className="input" 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value as any); setOffset(0) }}
            style={{ minWidth: 140 }}
          >
            <option value="ALL">Alle Status</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="INACTIVE">Inaktiv</option>
            <option value="PENDING">Ausstehend</option>
          </select>
        </div>
      </div>

      {/* Content Area - Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* List */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>
            Übungsleiter {total > 0 && <span className="helper">({total})</span>}
          </h2>

          {loading && <LoadingState />}

          {!loading && rows.length === 0 && (
            <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 500 }}>Keine Übungsleiter gefunden</div>
              <div className="helper">Lege einen neuen Übungsleiter an, um zu starten.</div>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <>
              <div className="helper" style={{ marginBottom: 8, fontSize: 12 }}>
                💡 Klicke auf einen Übungsleiter um Details anzuzeigen
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className={`instructor-row ${detail?.id === r.id ? 'active' : ''}`}
                    onClick={() => loadDetail(r.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadDetail(r.id) }}
                    aria-label={`Details für ${r.name} anzeigen`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: detail?.id === r.id ? 'var(--primary-dim)' : 'var(--surface)',
                      border: detail?.id === r.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => { 
                      if (detail?.id !== r.id) {
                        e.currentTarget.style.background = 'var(--surface-hover)'
                        e.currentTarget.style.borderColor = 'var(--primary)'
                        e.currentTarget.style.transform = 'translateX(4px)'
                      }
                    }}
                    onMouseLeave={(e) => { 
                      if (detail?.id !== r.id) {
                        e.currentTarget.style.background = 'var(--surface)'
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.transform = 'translateX(0)'
                      }
                    }}
                  >
                    {/* Verbindungspfeil für ausgewähltes Item */}
                    {detail?.id === r.id && (
                      <div style={{
                        position: 'absolute',
                        right: -20,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 10
                      }}>
                        <div style={{
                          width: 12,
                          height: 2,
                          background: 'var(--primary)'
                        }} />
                        <div style={{
                          width: 0,
                          height: 0,
                          borderTop: '8px solid transparent',
                          borderBottom: '8px solid transparent',
                          borderLeft: '10px solid var(--primary)'
                        }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>👤</span>
                      <div>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {r.name}
                          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                        </div>
                        {r.yearlyCap != null && (
                          <div className="helper" style={{ fontSize: 12 }}>
                            Jahresgrenze: {eurFmt.format(r.yearlyCap)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: STATUS_COLORS[r.status],
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase'
                      }}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn ghost icon-btn" title="Bearbeiten" onClick={() => setForm({ mode: 'edit', draft: { ...r } })}>
                        ✎
                      </button>
                      <button className="btn ghost icon-btn danger" title="Löschen" onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {total > limit && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
              <button className="btn ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                ← Zurück
              </button>
              <span className="helper">
                Seite {Math.floor(offset / limit) + 1} von {Math.ceil(total / limit)}
              </span>
              <button className="btn ghost" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                Weiter →
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {detail && (
          <div className="card" style={{ padding: 16, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            {detailLoading ? (
              <LoadingState />
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{detail.name}</h2>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 6,
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: STATUS_COLORS[detail.status],
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    >
                      {STATUS_LABELS[detail.status]}
                    </span>
                  </div>
                  <button className="btn ghost icon-btn" onClick={() => setDetail(null)} title="Schließen">
                    ✕
                  </button>
                </div>

                {/* Cap Status Bar */}
                {capStatus && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="helper">Jahresauslastung {currentYear}</span>
                      <span className={capStatus.isOverCap ? 'text-danger' : capStatus.isNearCap ? 'text-warning' : ''}>
                        {eurFmt.format(capStatus.used)} / {eurFmt.format(capStatus.cap)}
                      </span>
                    </div>
                    <div style={{ 
                      height: 8, 
                      background: 'var(--border)', 
                      borderRadius: 4, 
                      overflow: 'hidden' 
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${capStatus.percentage}%`,
                        background: capStatus.isOverCap ? 'var(--danger)' : capStatus.isNearCap ? 'var(--warning)' : 'var(--success)',
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    {capStatus.isOverCap && (
                      <div className="text-danger" style={{ fontSize: 12, marginTop: 4 }}>
                        ⚠️ Jahresobergrenze überschritten um {eurFmt.format(Math.abs(capStatus.remaining))}
                      </div>
                    )}
                    {capStatus.isNearCap && !capStatus.isOverCap && (
                      <div className="text-warning" style={{ fontSize: 12, marginTop: 4 }}>
                        ℹ️ Noch {eurFmt.format(capStatus.remaining)} bis zur Jahresobergrenze
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {detail.notes && (
                  <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-alt)', borderRadius: 8 }}>
                    <div className="helper" style={{ marginBottom: 4 }}>Notizen</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{detail.notes}</div>
                  </div>
                )}

                {/* Contracts Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>📄 Verträge</h3>
                    <button 
                      className="btn ghost icon-btn" 
                      title="Vertrag hochladen"
                      aria-label="Vertrag hochladen"
                      onClick={() => setContractForm({ 
                        instructorId: detail.id, 
                        title: '', 
                        startDate: '', 
                        endDate: '', 
                        file: null 
                      })}
                    >
                      📤
                    </button>
                  </div>
                  
                  {detail.contracts.length === 0 ? (
                    <div className="helper" style={{ fontStyle: 'italic' }}>Keine Verträge hinterlegt</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {detail.contracts.map((c) => (
                        <div 
                          key={c.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: 'var(--surface-alt)',
                            borderRadius: 6
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{c.title || c.fileName}</div>
                            <div className="helper" style={{ fontSize: 11 }}>
                              {c.startDate || '?'} – {c.endDate || '?'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => openContract(c.id)}>
                              Öffnen
                            </button>
                            <button className="btn ghost danger" style={{ fontSize: 12 }} onClick={() => deleteContract(c.id)}>
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoices Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>💰 Rechnungen</h3>
                    <button 
                      className="btn ghost icon-btn" 
                      title="Rechnung hinzufügen"
                      aria-label="Rechnung hinzufügen"
                      onClick={() => setInvoiceForm({ 
                        instructorId: detail.id, 
                        instructorName: detail.name,
                        date: new Date().toISOString().slice(0, 10), 
                        description: '', 
                        amount: '',
                        file: null
                      })}
                    >
                      ➕
                    </button>
                  </div>
                  
                  {detail.invoices.length === 0 ? (
                    <div className="helper" style={{ fontStyle: 'italic' }}>Keine Rechnungen erfasst</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {detail.invoices.map((inv) => (
                        <div 
                          key={inv.id} 
                          style={{ 
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: 'var(--surface-alt)',
                            borderRadius: 6
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {inv.description || 'Honorar'}
                              {inv.fileName && (
                                <button 
                                  className="btn ghost" 
                                  style={{ padding: '2px 6px', fontSize: 11 }}
                                  onClick={() => openInvoiceFile(inv.id)}
                                  title={`Datei öffnen: ${inv.fileName}`}
                                >
                                  📎
                                </button>
                              )}
                            </div>
                            <div className="helper" style={{ fontSize: 11 }}>
                              {inv.date}
                              {inv.fileName && <span style={{ marginLeft: 6 }}>• {inv.fileName}</span>}
                            </div>
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--danger)' }}>
                            {eurFmt.format(inv.amount)}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {!inv.voucherId && (
                              <button 
                                className="btn ghost icon-btn" 
                                style={{ fontSize: 14, color: 'var(--primary)' }} 
                                onClick={() => createVoucherFromInvoice(inv)}
                                title={`Als Buchung erfassen: ${eurFmt.format(inv.amount)} am ${inv.date}`}
                                aria-label="Als Buchung erfassen"
                              >
                                📝
                              </button>
                            )}
                            {inv.voucherId && (
                              <span className="helper" style={{ fontSize: 11, color: 'var(--success)', padding: '4px 8px' }}>✓ Gebucht</span>
                            )}
                            <button className="btn ghost danger icon-btn" style={{ fontSize: 12 }} onClick={() => deleteInvoice(inv.id)} title="Löschen" aria-label="Löschen">
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Total */}
                  {detail.invoices.length > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginTop: 12, 
                      paddingTop: 12, 
                      borderTop: '1px solid var(--border)'
                    }}>
                      <span style={{ fontWeight: 500 }}>Gesamt</span>
                      <span style={{ fontWeight: 600 }}>{eurFmt.format(detail.totalInvoiced)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {form && createPortal(
        <div className="modal-overlay" onClick={() => setForm(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <ModalHeader 
              title={form.mode === 'create' ? 'Übungsleiter anlegen' : 'Übungsleiter bearbeiten'} 
              onClose={() => setForm(null)} 
            />
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="field">
                <label htmlFor="instructor-name">Name *</label>
                <input
                  id="instructor-name"
                  type="text"
                  className="input"
                  value={form.draft.name || ''}
                  onChange={(e) => setForm({ ...form, draft: { ...form.draft, name: e.target.value } })}
                  autoFocus
                  placeholder="Vor- und Nachname"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="instructor-status">Status</label>
                  <select
                    id="instructor-status"
                    className="input"
                    value={form.draft.status || 'ACTIVE'}
                    onChange={(e) => setForm({ ...form, draft: { ...form.draft, status: e.target.value as InstructorStatus } })}
                  >
                    <option value="ACTIVE">Aktiv</option>
                    <option value="INACTIVE">Inaktiv</option>
                    <option value="PENDING">Ausstehend</option>
                  </select>
                </div>
                
                <div className="field">
                  <label htmlFor="instructor-cap">Jahresobergrenze (€)</label>
                  <input
                    id="instructor-cap"
                    type="number"
                    className="input"
                    step="0.01"
                    value={form.draft.yearlyCap ?? ''}
                    onChange={(e) => setForm({ ...form, draft: { ...form.draft, yearlyCap: e.target.value ? parseFloat(e.target.value) : null } })}
                    placeholder="3000"
                  />
                  <div className="helper">Standard: 3.000€ (ÜL-Pauschale)</div>
                </div>
              </div>
              
              <div className="field">
                <label htmlFor="instructor-notes">Notizen</label>
                <textarea
                  id="instructor-notes"
                  className="input"
                  value={form.draft.notes || ''}
                  onChange={(e) => setForm({ ...form, draft: { ...form.draft, notes: e.target.value } })}
                  rows={3}
                  placeholder="Interne Notizen …"
                />
              </div>

              {/* Contract section - only in create mode */}
              {form.mode === 'create' && (
                <div style={{ 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  overflow: 'hidden',
                  marginTop: 4
                }}>
                  <button
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      withContract: !form.withContract,
                      contractDraft: form.withContract ? undefined : { title: '', startDate: '', endDate: '', file: null }
                    })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: form.withContract ? 'var(--accent-bg)' : 'var(--surface-alt)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text)'
                    }}
                  >
                    <span style={{ transform: form.withContract ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                    <span>📄 Vertrag hinzufügen (optional)</span>
                    {form.withContract && form.contractDraft?.file && (
                      <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                        ✓ {form.contractDraft.file.name}
                      </span>
                    )}
                  </button>
                  
                  {form.withContract && (
                    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                      <div className="field">
                        <label htmlFor="contract-title">Vertragsbezeichnung</label>
                        <input
                          id="contract-title"
                          type="text"
                          className="input"
                          value={form.contractDraft?.title || ''}
                          onChange={(e) => setForm({
                            ...form,
                            contractDraft: { ...form.contractDraft!, title: e.target.value }
                          })}
                          placeholder="z.B. ÜL-Vertrag 2025"
                        />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="field">
                          <label htmlFor="contract-start">Vertragsbeginn</label>
                          <input
                            id="contract-start"
                            type="date"
                            className="input"
                            value={form.contractDraft?.startDate || ''}
                            onChange={(e) => setForm({
                              ...form,
                              contractDraft: { ...form.contractDraft!, startDate: e.target.value }
                            })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="contract-end">Vertragsende</label>
                          <input
                            id="contract-end"
                            type="date"
                            className="input"
                            value={form.contractDraft?.endDate || ''}
                            onChange={(e) => setForm({
                              ...form,
                              contractDraft: { ...form.contractDraft!, endDate: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="field">
                        <label>Vertragsdatei (PDF, Scan)</label>
                        <input
                          ref={createContractFileRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setForm({
                              ...form,
                              contractDraft: { ...form.contractDraft!, file }
                            })
                          }}
                        />
                        <div
                          onClick={() => createContractFileRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const file = e.dataTransfer.files?.[0] || null
                            if (file) {
                              setForm({
                                ...form,
                                contractDraft: { ...form.contractDraft!, file }
                              })
                            }
                          }}
                          style={{
                            border: '2px dashed var(--border)',
                            borderRadius: 8,
                            padding: 16,
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: form.contractDraft?.file ? 'var(--surface-alt)' : 'transparent'
                          }}
                        >
                          {form.contractDraft?.file ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <span>📎</span>
                              <span>{form.contractDraft.file.name}</span>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ padding: '2px 8px', fontSize: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setForm({
                                    ...form,
                                    contractDraft: { ...form.contractDraft!, file: null }
                                  })
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)' }}>
                              📤 Datei hierher ziehen oder klicken
                            </div>
                          )}
                        </div>
                        <div className="helper" style={{ marginTop: 4 }}>
                          Unterstützt: PDF, JPG, PNG, Word-Dokumente
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn ghost" onClick={() => setForm(null)}>Abbrechen</button>
              <button className="btn primary" onClick={saveForm} disabled={!form.draft.name?.trim()}>
                Speichern
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <ModalHeader title="Übungsleiter löschen" onClose={() => setDeleteConfirm(null)} />
            <p style={{ margin: '0 0 16px 0' }}>
              Soll <strong>{deleteConfirm.name}</strong> wirklich gelöscht werden?
            </p>
            <div className="helper" style={{ marginBottom: 16, padding: 12, background: 'var(--surface-alt)', borderRadius: 8 }}>
              ⚠️ Alle zugehörigen Verträge und Rechnungen werden ebenfalls gelöscht.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn ghost" onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
              <button className="btn danger" onClick={doDelete}>Ja, löschen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Invoice Add Modal */}
      {invoiceForm && createPortal(
        <div className="modal-overlay" onClick={() => setInvoiceForm(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <ModalHeader title="Rechnung hinzufügen" onClose={() => setInvoiceForm(null)} />
            <div className="helper" style={{ marginBottom: 16 }}>
              Rechnung für: <strong>{invoiceForm.instructorName}</strong>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="invoice-date">Datum</label>
                  <input
                    id="invoice-date"
                    type="date"
                    className="input"
                    value={invoiceForm.date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="invoice-amount">Betrag (€) *</label>
                  <input
                    id="invoice-amount"
                    type="text"
                    className="input"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="z.B. 150,00"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="invoice-desc">Beschreibung</label>
                <input
                  id="invoice-desc"
                  type="text"
                  className="input"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="z.B. Honorar April 2025"
                />
              </div>
              <div className="field">
                <label>Rechnungsdatei (optional)</label>
                <div 
                  style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: 8, 
                    padding: 16, 
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: invoiceForm.file ? 'var(--surface-alt)' : 'transparent'
                  }}
                  onClick={() => invoiceFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files[0]
                    if (file) setInvoiceForm({ ...invoiceForm, file })
                  }}
                >
                  {invoiceForm.file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span>📄</span>
                      <span style={{ fontWeight: 500 }}>{invoiceForm.file.name}</span>
                      <button 
                        type="button" 
                        className="btn ghost" 
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); setInvoiceForm({ ...invoiceForm, file: null }) }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
                      <div className="helper">PDF/Bild hierher ziehen oder klicken</div>
                    </div>
                  )}
                </div>
                <input
                  ref={invoiceFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setInvoiceForm({ ...invoiceForm, file })
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn ghost" onClick={() => setInvoiceForm(null)}>Abbrechen</button>
              <button className="btn primary" onClick={addInvoice}>Speichern</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Contract Upload Modal */}
      {contractForm && createPortal(
        <div className="modal-overlay" onClick={() => setContractForm(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <ModalHeader title="Vertrag hochladen" onClose={() => setContractForm(null)} />
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="field">
                <label htmlFor="contract-title">Titel</label>
                <input
                  id="contract-title"
                  type="text"
                  className="input"
                  value={contractForm.title}
                  onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                  placeholder="z.B. Übungsleitervertrag 2025"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="contract-start">Beginn</label>
                  <input
                    id="contract-start"
                    type="date"
                    className="input"
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="contract-end">Ende</label>
                  <input
                    id="contract-end"
                    type="date"
                    className="input"
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Datei *</label>
                <div 
                  style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: 8, 
                    padding: 20, 
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: contractForm.file ? 'var(--surface-alt)' : 'transparent'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files[0]
                    if (file) setContractForm({ ...contractForm, file })
                  }}
                >
                  {contractForm.file ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 500 }}>{contractForm.file.name}</div>
                      <div className="helper">{(contractForm.file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                      <div>Datei hierher ziehen oder klicken</div>
                      <div className="helper">PDF, DOC, DOCX, JPG, PNG</div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setContractForm({ ...contractForm, file })
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn ghost" onClick={() => setContractForm(null)}>Abbrechen</button>
              <button className="btn primary" onClick={addContract} disabled={!contractForm.file}>
                Hochladen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
