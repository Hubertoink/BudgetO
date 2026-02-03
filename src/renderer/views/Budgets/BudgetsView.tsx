import React, { useEffect, useMemo, useState } from 'react'
import BudgetTiles from '../../components/tiles/BudgetTiles'
import BudgetModal from '../../components/modals/BudgetModal'
import { useAuth } from '../../context/authHooks'

// Monochrome SVG icons
const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-1.42.59H8v-4a2 2 0 0 1 .59-1.42l7.17-7.17m4.83 4.83l1.88-1.88a2 2 0 0 0 0-2.83l-2-2a2 2 0 0 0-2.83 0l-1.88 1.88m4.83 4.83l-4.83-4.83" />
  </svg>
)
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

type Budget = {
  id: number
  year: number
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  categoryId: number | null
  projectId: number | null
  earmarkId: number | null
  amountPlanned: number
  isArchived?: number
  name?: string | null
  categoryName?: string | null
  projectName?: string | null
  startDate?: string | null
  endDate?: string | null
  color?: string | null
  enforceTimeRange?: number
}

type BudgetEdit = {
  id?: number
  year: number
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  categoryId?: number | null
  projectId?: number | null
  earmarkId?: number | null
  amountPlanned: number
  name?: string | null
  categoryName?: string | null
  projectName?: string | null
  startDate?: string | null
  endDate?: string | null
  color?: string | null
  enforceTimeRange?: number
}

export default function BudgetsView({
  onGoToBookings,
  notify
}: {
  onGoToBookings: (budgetId: number) => void
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}) {
  const { canWrite } = useAuth()
  const [allBudgets, setAllBudgets] = useState<Budget[]>([])
  const [editBudget, setEditBudget] = useState<BudgetEdit | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [q, setQ] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState<null | { budget: Budget; nextArchived: boolean }>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const fmtDate = (d?: string | null) => d ? d.slice(8,10) + '.' + d.slice(5,7) + '.' + d.slice(0,4) : '—'

  const archivedCount = useMemo(() => allBudgets.filter(b => !!b.isArchived).length, [allBudgets])
  const visibleBudgets = useMemo(() => {
    const base = showArchived ? allBudgets : allBudgets.filter(b => !b.isArchived)
    const needle = q.trim().toLowerCase()
    if (!needle) return base
    return base.filter((b) => {
      const haystack = [
        b.id,
        b.year,
        b.sphere,
        b.name,
        b.categoryName,
        b.projectName,
        b.startDate,
        b.endDate,
        b.amountPlanned
      ]
        .filter((v) => v != null)
        .map((v) => String(v))
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [allBudgets, q, showArchived])

  async function loadBudgets() {
    const res = await window.api?.budgets.list?.({ includeArchived: true })
    if (res) setAllBudgets(res.rows)
  }

  useEffect(() => {
    loadBudgets()
    const onChanged = () => loadBudgets()
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [])

  const handleSaved = async () => {
    notify('success', 'Budget gespeichert')
    await loadBudgets()
    setEditBudget(null)
  }

  async function toggleArchive(b: Budget, nextArchived: boolean) {
    try {
      await window.api?.budgets.upsert?.({
        id: b.id,
        year: b.year,
        sphere: b.sphere,
        categoryId: b.categoryId ?? null,
        projectId: b.projectId ?? null,
        earmarkId: b.earmarkId ?? null,
        amountPlanned: b.amountPlanned,
        name: b.name ?? null,
        categoryName: b.categoryName ?? null,
        projectName: b.projectName ?? null,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
        color: b.color ?? null,
        enforceTimeRange: !!b.enforceTimeRange,
        isArchived: nextArchived
      })
      notify('success', nextArchived ? 'Budget archiviert' : 'Budget wiederhergestellt')
      await loadBudgets()
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setArchiveConfirm(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="helper">Budgets verwalten und Fortschritt verfolgen</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canWrite && (
              <button
                className="btn primary"
                onClick={() =>
                  setEditBudget({
                    year: new Date().getFullYear(),
                    sphere: 'IDEELL',
                    amountPlanned: 0,
                    categoryId: null,
                    projectId: null,
                    earmarkId: null,
                    enforceTimeRange: 0
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
            placeholder="Suche (Jahr, Name, Kategorie, Projekt …)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Budgets durchsuchen"
            style={{ flex: 1, minWidth: 240 }}
          />
          <div className="helper" style={{ alignSelf: 'center' }}>{visibleBudgets.length} Treffer</div>
        </div>

        {/* Simple table */}
        <table cellPadding={6} style={{ marginTop: 8, width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Jahr</th>
              <th align="left">Name</th>
              <th align="left">Kategorie</th>
              <th align="left">Projekt</th>
              <th align="left">Zeitraum</th>
              <th align="left">Farbe</th>
              <th align="right">Budget</th>
              <th align="center">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visibleBudgets.map((b) => (
              <tr key={b.id} style={b.isArchived ? { opacity: 0.6 } : undefined}>
                <td>{b.year}</td>
                <td>{b.name ?? '—'}</td>
                <td>{b.categoryName ?? '—'}</td>
                <td>{b.projectName ?? '—'}</td>
                <td>
                  {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                </td>
                <td>
                  {b.color ? (
                    <span
                      title={b.color}
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: b.color
                      }}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td align="right">{eurFmt.format(b.amountPlanned)}</td>
                <td align="center" style={{ whiteSpace: 'nowrap' }}>
                  {canWrite && (
                    <>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          setEditBudget({
                            id: b.id,
                            year: b.year,
                            sphere: b.sphere,
                            categoryId: b.categoryId ?? null,
                            projectId: b.projectId ?? null,
                            earmarkId: b.earmarkId ?? null,
                            amountPlanned: b.amountPlanned,
                            name: b.name ?? null,
                            categoryName: b.categoryName ?? null,
                            projectName: b.projectName ?? null,
                            startDate: b.startDate ?? null,
                            endDate: b.endDate ?? null,
                            color: b.color ?? null,
                            enforceTimeRange: b.enforceTimeRange ?? 0
                          })
                        }
                        title="Bearbeiten"
                        style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <IconEdit />
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => setArchiveConfirm({ budget: b, nextArchived: !b.isArchived })}
                        title={b.isArchived ? 'Wiederherstellen' : 'Archivieren'}
                        style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {b.isArchived ? <IconRestore /> : <IconArchive />}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {visibleBudgets.length === 0 && (
              <tr>
                <td colSpan={8} className="helper">
                  {q.trim() ? 'Keine Treffer.' : 'Keine Budgets vorhanden.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Budget Tiles */}
      <BudgetTiles
        budgets={visibleBudgets}
        eurFmt={eurFmt}
        onEdit={canWrite ? (b) =>
          setEditBudget({
            id: b.id,
            year: b.year,
            sphere: b.sphere,
            categoryId: b.categoryId ?? null,
            projectId: b.projectId ?? null,
            earmarkId: b.earmarkId ?? null,
            amountPlanned: b.amountPlanned,
            name: b.name ?? null,
            categoryName: b.categoryName ?? null,
            projectName: b.projectName ?? null,
            startDate: b.startDate ?? null,
            endDate: b.endDate ?? null,
            color: b.color ?? null,
            enforceTimeRange: b.enforceTimeRange ?? 0
          })
        : undefined}
        onGoToBookings={onGoToBookings}
      />

      {/* Edit Modal */}
      {canWrite && editBudget && (
        <BudgetModal value={editBudget as any} onClose={() => setEditBudget(null)} onSaved={handleSaved} />
      )}

      {archiveConfirm && canWrite && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setArchiveConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{archiveConfirm.nextArchived ? 'Budget archivieren' : 'Budget wiederherstellen'}</h2>
              <button className="btn ghost" onClick={() => setArchiveConfirm(null)} aria-label="Schließen">✕</button>
            </header>
            <div className="helper">
              Möchtest du das Budget <strong>{archiveConfirm.budget.name ?? `#${archiveConfirm.budget.id}`}</strong> wirklich {archiveConfirm.nextArchived ? 'archivieren' : 'wiederherstellen'}?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setArchiveConfirm(null)}>Abbrechen</button>
              <button className={archiveConfirm.nextArchived ? 'btn danger' : 'btn primary'} onClick={() => toggleArchive(archiveConfirm.budget, archiveConfirm.nextArchived)}>
                {archiveConfirm.nextArchived ? 'Archivieren' : 'Wiederherstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating archive toggle (bottom-right) */}
      {archivedCount > 0 && (
        <div
          onClick={() => setShowArchived(!showArchived)}
          title={showArchived ? 'Archivierte Budgets ausblenden' : `${archivedCount} archivierte Budget${archivedCount !== 1 ? 's' : ''} anzeigen`}
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
    </div>
  )
}
