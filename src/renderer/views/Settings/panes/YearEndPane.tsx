import React from 'react'
import { YearEndPaneProps } from '../types'

/**
 * YearEndPane - Year-End Closing: Preview, Export, Close/Reopen
 */
export function YearEndPane({ notify, bumpDataVersion }: YearEndPaneProps) {
  const [year, setYear] = React.useState<number>(new Date().getFullYear())
  const [yearsAvail, setYearsAvail] = React.useState<number[]>([])
  const [preview, setPreview] = React.useState<any | null>(null)
  const [overall, setOverall] = React.useState<any | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [status, setStatus] = React.useState<{ closedUntil: string | null } | null>(null)
  const [confirmAction, setConfirmAction] = React.useState<null | { type: 'close' | 'reopen' }>(null)
  const [preClose, setPreClose] = React.useState<null | {
    year: number
    to: string
    openCashAdvances: Array<{
      id: number
      orderNumber: string
      employeeName: string
      status: 'OPEN' | 'RESOLVED' | 'OVERDUE'
      createdAt: string
      dueDate: string | null
      totalAmount: number
      totalPlanned: number
      totalSettled: number
      plannedRemaining: number
      actualRemaining: number
      coverage: number
    }>
    unpaidInstructorInvoices: Array<{
      invoiceId: number
      instructorId: number
      instructorName: string
      date: string
      description: string | null
      amount: number
    }>
  }>(null)
  const [workYear, setWorkYear] = React.useState<number>(new Date().getFullYear())
  const [showArchived, setShowArchived] = React.useState<boolean>(true)
  const [optSwitchWorkYear, setOptSwitchWorkYear] = React.useState(true)
  const [optHideArchived, setOptHideArchived] = React.useState(true)
  const eur = React.useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prefill = Number(sessionStorage.getItem('yearEnd.prefillYear') || '')
        if (!cancelled && Number.isFinite(prefill) && prefill > 1900) setYear(prefill)
      } catch { /* ignore */ }

      try {
        const [y, budgetsRes] = await Promise.all([
          window.api?.reports?.years?.(),
          (window as any).api?.annualBudgets?.list?.({})
        ])
        const voucherYears = (y?.years || []) as number[]
        const budgetYears = ((budgetsRes?.budgets || []) as Array<{ year: number }>).map(b => Number(b.year))
        const merged = Array.from(new Set<number>([...voucherYears, ...budgetYears]))
          .filter((n) => Number.isFinite(n) && n > 1900)
          .sort((a, b) => b - a)
        if (!cancelled) setYearsAvail(merged)
      } catch {
        // fallback to voucher years only
        try {
          const y = await window.api?.reports?.years?.()
          if (!cancelled && y?.years) setYearsAvail(y.years)
        } catch { /* ignore */ }
      }
    })()
    window.api?.yearEnd?.status?.().then(s => { if (!cancelled) setStatus(s as any) })
    ;(async () => {
      try {
        const wy = await window.api?.settings?.get?.({ key: 'ui.workYear' })
        const sa = await window.api?.settings?.get?.({ key: 'ui.showArchived' })
        const wyNum = Number(wy?.value)
        if (!cancelled && Number.isFinite(wyNum) && wyNum > 1900) setWorkYear(wyNum)
        if (!cancelled && sa?.value != null) setShowArchived(Boolean(sa.value))
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  async function refresh() {
    setErr('')
    try { 
      setBusy(true)
      const res = await window.api?.yearEnd?.preview?.({ year })
      setPreview(res || null)
      // Load overall totals (all time)
      const overallRes = await window.api?.reports?.summary?.({ from: '', to: '' })
      setOverall(overallRes || null)
    }
    catch (e: any) { setErr(e?.message || String(e)) }
    finally { setBusy(false) }
  }
  React.useEffect(() => { refresh() }, [year])

  const closedUntil = status?.closedUntil || null
  const isLocked = !!closedUntil
  const lockedYear = isLocked ? Number(String(closedUntil).slice(0, 4)) : null
  const closeDisabled = lockedYear !== null && year <= lockedYear

  async function doExport() {
    setBusy(true); setErr('')
    try {
      const res = await window.api?.yearEnd?.export?.({ year })
      if (res?.filePath) notify('success', `Export erstellt: ${res.filePath}`)
    } catch (e: any) { setErr(e?.message || String(e)); notify('error', e?.message || String(e)) }
    finally { setBusy(false) }
  }

  async function executeClose() {
    setBusy(true); setErr('')
    try { const res = await window.api?.yearEnd?.close?.({ year }); if (res?.ok) { notify('success', `Abgeschlossen bis ${res.closedUntil}`); const s = await window.api?.yearEnd?.status?.(); setStatus(s as any); await refresh(); window.dispatchEvent(new Event('data-changed')) } }
    catch (e: any) { setErr(e?.message || String(e)); notify('error', e?.message || String(e)) }
    finally {
      try {
        let archiveSettingsChanged = false
        if (optSwitchWorkYear) {
          const next = year + 1
          await window.api?.settings?.set?.({ key: 'ui.workYear', value: next })
          setWorkYear(next)
          archiveSettingsChanged = true
        }
        if (optHideArchived) {
          await window.api?.settings?.set?.({ key: 'ui.showArchived', value: false })
          setShowArchived(false)
          archiveSettingsChanged = true
        }
        if (archiveSettingsChanged) window.dispatchEvent(new Event('ui-archive-settings-changed'))
      } catch { /* ignore */ }
      setBusy(false); setConfirmAction(null); setPreClose(null)
      window.dispatchEvent(new Event('data-changed'))
    }
  }
  async function executeReopen() {
    setBusy(true); setErr('')
    try { const res = await window.api?.yearEnd?.reopen?.({ year }); if (res?.ok) { notify('success', 'Periode geöffnet'); const s = await window.api?.yearEnd?.status?.(); setStatus(s as any); await refresh(); window.dispatchEvent(new Event('data-changed')) } }
    catch (e: any) { setErr(e?.message || String(e)); notify('error', e?.message || String(e)) }
    finally { setBusy(false); setConfirmAction(null) }
  }

  async function loadPreCloseCheck(targetYear: number) {
    setErr('')
    setPreClose(null)
    try {
      const res = await (window as any).api?.yearEnd?.preCloseCheck?.({ year: targetYear })
      setPreClose(res || null)
    } catch (e: any) {
      setErr(e?.message || String(e))
    }
  }

  function fmtIso(d?: string | null) {
    if (!d) return ''
    return String(d).slice(0, 10)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>Jahresabschluss</strong>
        <div className="helper">Vorschau, Export und Abschluss des Geschäftsjahres.</div>
      </div>

      <section className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, background: isLocked ? 'color-mix(in oklab, var(--danger) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 12%, transparent)' }}>
            <span aria-hidden>🛡️</span>
            <div>
              <div className="helper">Sperrstatus</div>
              <div>
                {isLocked ? (<span>Abgeschlossen bis <strong>{closedUntil}</strong>. Buchungen bis zu diesem Datum sind gesperrt.</span>) : (<span>Derzeit ist kein Jahr abgeschlossen.</span>)}
              </div>
            </div>
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Jahr</label>
            <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} title="Jahr auswählen">
              {[...new Set([new Date().getFullYear(), ...yearsAvail])].sort((a, b) => b - a).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div className="helper">Interaktive Schritte</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={doExport}>📤 Export-Paket</button>
          {!closeDisabled && (
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => { setConfirmAction({ type: 'close' }); await loadPreCloseCheck(year) }}
            >
              ✅ Jahr abschließen…
            </button>
          )}
          {closeDisabled && (
            <button className="btn" disabled={busy} onClick={() => setConfirmAction({ type: 'reopen' })}>Wieder öffnen…</button>
          )}
        </div>
      </section>

      {preview && (
        <section className="card" style={{ padding: 12, display: 'grid', gap: 12 }}>
          <div className="helper">Zeitraum: {preview.from} – {preview.to}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Einnahmen</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>📈</span>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {eur.format(preview.totals.inGross || 0)}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Ausgaben</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>📉</span>
                <div style={{ fontWeight: 600, color: 'var(--danger)' }}>
                  {eur.format(Math.abs(preview.totals.outGross || 0))}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Saldo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>💰</span>
                <div style={{ fontWeight: 600, color: (preview.totals.inGross - Math.abs(preview.totals.outGross)) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {eur.format(preview.totals.inGross - Math.abs(preview.totals.outGross))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {overall && (
        <section className="card" style={{ padding: 12, display: 'grid', gap: 12 }}>
          <div className="helper">Gesamtzeitraum (alle Buchungen)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Einnahmen</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>📈</span>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {eur.format((overall.byType.find((t: any) => t.key === 'IN')?.gross || 0))}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Ausgaben</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>📉</span>
                <div style={{ fontWeight: 600, color: 'var(--danger)' }}>
                  {eur.format(Math.abs(overall.byType.find((t: any) => t.key === 'OUT')?.gross || 0))}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Saldo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 20 }}>💰</span>
                <div style={{ fontWeight: 600, color: ((overall.byType.find((t: any) => t.key === 'IN')?.gross || 0) - Math.abs(overall.byType.find((t: any) => t.key === 'OUT')?.gross || 0)) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {eur.format((overall.byType.find((t: any) => t.key === 'IN')?.gross || 0) - Math.abs(overall.byType.find((t: any) => t.key === 'OUT')?.gross || 0))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{confirmAction.type === 'close' ? 'Jahr abschließen' : 'Periode wieder öffnen'}</h3>
              <button className="btn ghost" onClick={() => setConfirmAction(null)} aria-label="Schließen" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8 }}>✕</button>
            </div>
            {confirmAction.type === 'close' ? (
              <div>Jahr <strong>{year}</strong> abschließen? Buchungen bis <strong>{year}-12-31</strong> sind danach gesperrt.</div>
            ) : (
              <div>Jahr <strong>{year}</strong> wieder öffnen?</div>
            )}

            {confirmAction.type === 'close' && !preClose && (
              <div className="helper">Prüfe offene Posten…</div>
            )}

            {confirmAction.type === 'close' && preClose && ((preClose.openCashAdvances.length + preClose.unpaidInstructorInvoices.length) > 0) && (
              <div className="card" style={{ padding: 10, border: '1px solid color-mix(in oklab, var(--warning) 30%, var(--border))', background: 'color-mix(in oklab, var(--warning) 12%, transparent)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Offene Posten (Warnung)</div>
                <div className="helper" style={{ marginBottom: 8 }}>
                  Stichtag: <strong>{preClose.to}</strong>. Du kannst trotzdem abschließen – es wird nur ein Hinweis angezeigt.
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Barvorschüsse (nicht abgeschlossen): {preClose.openCashAdvances.length}</div>
                    {preClose.openCashAdvances.length > 0 && (
                      <div className="card" style={{ padding: 8, marginTop: 6, maxHeight: 140, overflow: 'auto' }}>
                        {preClose.openCashAdvances.map((x) => (
                          <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid color-mix(in oklab, var(--border) 50%, transparent)' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {x.orderNumber} · {x.employeeName} <span className="badge" title={`Status: ${x.status}`}>{x.status}</span>
                              </div>
                              <div className="helper">Erstellt: {fmtIso(x.createdAt)}{x.dueDate ? ` · Fällig: ${fmtIso(x.dueDate)}` : ''}</div>
                            </div>
                            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{eur.format(x.totalAmount)}</div>
                              <div className="helper">Offen (Plan): {eur.format(x.plannedRemaining)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 600 }}>Übungsleiter-Rechnungen (ohne Buchung): {preClose.unpaidInstructorInvoices.length}</div>
                    {preClose.unpaidInstructorInvoices.length > 0 && (
                      <div className="card" style={{ padding: 8, marginTop: 6, maxHeight: 140, overflow: 'auto' }}>
                        {preClose.unpaidInstructorInvoices.map((x) => (
                          <div key={x.invoiceId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid color-mix(in oklab, var(--border) 50%, transparent)' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {x.instructorName}
                              </div>
                              <div className="helper">{x.date}{x.description ? ` · ${x.description}` : ''}</div>
                            </div>
                            <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{eur.format(x.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {confirmAction.type === 'close' && (
              <div className="card" style={{ padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Nach dem Abschluss</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={optSwitchWorkYear} onChange={(e) => setOptSwitchWorkYear(e.target.checked)} />
                  Arbeitsjahr auf <strong>{year + 1}</strong> setzen
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={optHideArchived} onChange={(e) => setOptHideArchived(e.target.checked)} />
                  Abgeschlossene Jahre standardmäßig ausblenden (Archiv)
                </label>
                <div className="helper">Global: betrifft Buchungen, Übungsleiter und Barvorschüsse.</div>
              </div>
            )}

            <div className="helper">Dieser Vorgang kann später über „Wieder öffnen…“ rückgängig gemacht werden.</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setConfirmAction(null)}>Abbrechen</button>
              {confirmAction.type === 'close' ? (
                <button className="btn danger" onClick={executeClose} disabled={busy || !preClose}>Ja, abschließen</button>
              ) : (
                <button className="btn primary" onClick={executeReopen} disabled={busy}>Ja, öffnen</button>
              )}
            </div>
          </div>
        </div>
      )}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}

      <section className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div className="helper">Archiv / Arbeitsjahr (global)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Arbeitsjahr</label>
            <select
              className="input"
              value={workYear}
              onChange={async (e) => {
                const next = Number(e.target.value)
                setWorkYear(next)
                try { await window.api?.settings?.set?.({ key: 'ui.workYear', value: next }) } catch { /* ignore */ }
                window.dispatchEvent(new Event('ui-archive-settings-changed'))
                window.dispatchEvent(new Event('data-changed'))
              }}
              title="Das Arbeitsjahr steuert die Standardansichten (Blank Slate)"
            >
              {[...new Set([new Date().getFullYear(), ...yearsAvail, year + 1])].sort((a, b) => b - a).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            className={`toggle-switch ${showArchived ? 'active' : ''}`}
            role="switch"
            aria-checked={showArchived}
            title="Wenn aktiv, werden auch abgeschlossene Jahre angezeigt."
            onClick={async () => {
              const next = !showArchived
              setShowArchived(next)
              try { await window.api?.settings?.set?.({ key: 'ui.showArchived', value: next }) } catch { /* ignore */ }
              window.dispatchEvent(new Event('ui-archive-settings-changed'))
              window.dispatchEvent(new Event('data-changed'))
            }}
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span>Archiv anzeigen</span>
          </button>
        </div>
        <div className="helper">
          {showArchived
            ? 'Alle Jahre werden angezeigt.'
            : `Blank Slate: nur ${workYear} wird angezeigt.`}
        </div>
      </section>
    </div>
  )
}
