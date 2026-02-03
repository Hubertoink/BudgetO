import React, { useEffect, useMemo, useState } from 'react'
import BindingModal from '../../components/modals/BindingModal'
import EarmarkUsageCards from '../../components/tiles/EarmarkUsageCards'
import { useAuth } from '../../context/authHooks'

// Monochrome SVG icons

const IconArchive = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)
const IconRestore = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)
const IconArchiveBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)

type Binding = {
  id: number
  code: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  isActive: number
  color?: string | null
  budget?: number | null
  enforceTimeRange?: number
}

type BindingEdit = {
  id?: number
  code: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  isActive?: boolean
  color?: string | null
  budget?: number | null
  enforceTimeRange?: number
}

export default function EarmarksView({
  from,
  to,
  filterSphere,
  onGoToBookings,
  onLoadEarmarks,
  notify
}: {
  from?: string
  to?: string
  filterSphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  onGoToBookings: (earmarkId: number) => void
  onLoadEarmarks: () => Promise<void>
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}) {
  const { canWrite } = useAuth()
  const [allBindings, setAllBindings] = useState<Binding[]>([])
  const [editBinding, setEditBinding] = useState<BindingEdit | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [q, setQ] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState<null | { binding: Binding; nextActive: boolean }>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const fmtDate = (d?: string | null) => d ? d.slice(8,10) + '.' + d.slice(5,7) + '.' + d.slice(0,4) : '—'

  const archivedCount = useMemo(() => allBindings.filter(b => !b.isActive).length, [allBindings])
  const visibleBindings = useMemo(() => {
    const base = showArchived ? allBindings : allBindings.filter(b => !!b.isActive)
    const needle = q.trim().toLowerCase()
    if (!needle) return base
    return base.filter((b) => {
      const haystack = [
        b.id,
        b.code,
        b.name,
        b.description,
        b.startDate,
        b.endDate,
        b.budget,
        b.color
      ]
        .filter((v) => v != null)
        .map((v) => String(v))
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [allBindings, q, showArchived])

  async function loadBindings() {
    const res = await window.api?.bindings.list?.({})
    if (res) setAllBindings(res.rows)
  }

  useEffect(() => {
    loadBindings()
    const onChanged = () => loadBindings()
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [])

  const handleSaved = async () => {
    notify('success', 'Zweckbindung gespeichert')
    await loadBindings()
    await onLoadEarmarks()
    setEditBinding(null)
  }

  async function toggleActive(b: Binding, nextActive: boolean) {
    try {
      await window.api?.bindings.upsert?.({
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description ?? null,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
        isActive: nextActive,
        color: b.color ?? null,
        budget: b.budget ?? null,
        enforceTimeRange: !!b.enforceTimeRange
      })
      notify('success', nextActive ? 'Zweckbindung wiederhergestellt' : 'Zweckbindung archiviert')
      await loadBindings()
      await onLoadEarmarks()
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setArchiveConfirm(null)
    }
  }

  return (
    <>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="helper">Zweckbindungen verwalten</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canWrite && (
              <button
                className="btn primary"
                onClick={() =>
                  setEditBinding({
                    code: '',
                    name: '',
                    description: null,
                    startDate: null,
                    endDate: null,
                    isActive: true,
                    color: null,
                    budget: null
                  })
                }
              >
                + Neu
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Suche (Code, Name, Text …)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Zweckbindungen durchsuchen"
            style={{ flex: 1, minWidth: 240 }}
          />
          <div className="helper" style={{ alignSelf: 'center' }}>{visibleBindings.length} Treffer</div>
        </div>

        <table cellPadding={6} style={{ marginTop: 8, width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Code</th>
              <th align="left">Name</th>
              <th align="left">Zeitraum</th>
              <th align="left">Status</th>
              <th align="right">Budget</th>
              <th align="left">Farbe</th>
              <th align="center">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visibleBindings.map((b) => (
              <tr key={b.id} style={!b.isActive ? { opacity: 0.6 } : undefined}>
                <td>{b.code}</td>
                <td>{b.name}</td>
                <td>
                  {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                </td>
                <td>{b.isActive ? 'aktiv' : 'inaktiv'}</td>
                <td align="right">{b.budget != null ? eurFmt.format(b.budget) : '—'}</td>
                <td>
                  {b.color ? (
                    <span
                      title={b.color}
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: b.color,
                        verticalAlign: 'middle'
                      }}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td align="center" style={{ whiteSpace: 'nowrap' }}>
                  {canWrite && (
                    <>
                      <button
                        className="btn btn-edit"
                        onClick={() =>
                          setEditBinding({
                            id: b.id,
                            code: b.code,
                            name: b.name,
                            description: b.description ?? null,
                            startDate: b.startDate ?? null,
                            endDate: b.endDate ?? null,
                            isActive: !!b.isActive,
                            color: b.color ?? null,
                            budget: b.budget ?? null,
                            enforceTimeRange: b.enforceTimeRange ?? 0
                          })
                        }
                        title="Bearbeiten"
                      >
                        ✎
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => setArchiveConfirm({ binding: b, nextActive: !b.isActive })}
                        title={b.isActive ? 'Archivieren' : 'Wiederherstellen'}
                      >
                        {b.isActive ? <IconArchive /> : <IconRestore />}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {visibleBindings.length === 0 && (
              <tr>
                <td colSpan={7} className="helper">
                  {q.trim() ? 'Keine Treffer.' : 'Keine Zweckbindungen vorhanden.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canWrite && editBinding && (
          <BindingModal value={editBinding} onClose={() => setEditBinding(null)} onSaved={handleSaved} />
        )}
      </div>

      {/* Usage Cards */}
      <EarmarkUsageCards
        bindings={visibleBindings as any}
        from={from}
        to={to}
        sphere={filterSphere}
        onEdit={canWrite ? (b: any) =>
          setEditBinding({
            id: b.id,
            code: b.code,
            name: b.name,
            description: b.description ?? null,
            startDate: b.startDate ?? null,
            endDate: b.endDate ?? null,
            isActive: !!b.isActive,
            color: b.color ?? null,
            budget: b.budget ?? null,
            enforceTimeRange: b.enforceTimeRange ?? 0
          })
        : undefined}
        onGoToBookings={onGoToBookings}
      />

      {archiveConfirm && canWrite && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setArchiveConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{archiveConfirm.nextActive ? 'Zweckbindung wiederherstellen' : 'Zweckbindung archivieren'}</h2>
              <button className="btn ghost" onClick={() => setArchiveConfirm(null)} aria-label="Schließen">✕</button>
            </header>
            <div className="helper">
              Möchtest du die Zweckbindung <strong>{archiveConfirm.binding.code}</strong> – {archiveConfirm.binding.name} wirklich {archiveConfirm.nextActive ? 'wiederherstellen' : 'archivieren'}?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setArchiveConfirm(null)}>Abbrechen</button>
              <button className={archiveConfirm.nextActive ? 'btn primary' : 'btn danger'} onClick={() => toggleActive(archiveConfirm.binding, archiveConfirm.nextActive)}>
                {archiveConfirm.nextActive ? 'Wiederherstellen' : 'Archivieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating archive toggle (bottom-right) */}
      {archivedCount > 0 && (
        <div
          onClick={() => setShowArchived(!showArchived)}
          title={showArchived ? 'Archivierte Zweckbindungen ausblenden' : `${archivedCount} archivierte Zweckbindung${archivedCount !== 1 ? 'en' : ''} anzeigen`}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: showArchived ? 'var(--primary)' : 'var(--card)',
            color: showArchived ? '#fff' : 'var(--text)',
            borderRadius: 999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 100,
            userSelect: 'none',
            border: showArchived ? 'none' : '1px solid var(--border)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'
          }}
        >
          <IconArchiveBox />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{archivedCount} archiviert</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={showArchived}
            className="toggle"
            checked={showArchived}
            onChange={(e) => { e.stopPropagation(); setShowArchived(e.target.checked) }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
