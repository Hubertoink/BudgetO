import React, { useEffect, useState } from 'react'

// Extracted from App.tsx (inline PaymentsAssignModal)
// Mirrors original behavior; kept local helpers (sanitizePeriodKey, periodRangeLocal) to avoid extra imports.

function sanitizePeriodKey(s: string, interval: 'MONTHLY'|'QUARTERLY'|'YEARLY'): string {
  const t = s.trim().toUpperCase()
  if (interval === 'MONTHLY') {
    const m = /^(\d{4})-(\d{1,2})$/.exec(t)
    if (!m) return t
    const y = m[1]; const mo = String(Math.max(1, Math.min(12, Number(m[2])))).padStart(2,'0')
    return `${y}-${mo}`
  }
  if (interval === 'QUARTERLY') {
    const m = /^(\d{4})-Q(\d)$/i.exec(t)
    if (!m) return t
    const y = m[1]; const q = Math.max(1, Math.min(4, Number(m[2])))
    return `${y}-Q${q}`
  }
  const y = /^\d{4}$/.exec(t)?.[0]
  return y || t
}

function periodRangeLocal(periodKey: string): { start: string; end: string } {
  const [yStr, rest] = periodKey.split('-'); const y = Number(yStr)
  if (/^Q\d$/.test(rest||'')) {
    const q = Number((rest||'Q1').replace('Q',''))
    const start = new Date(Date.UTC(y, (q-1)*3, 1))
    const end = new Date(Date.UTC(y, q*3, 0))
    return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }
  }
  if (rest) {
    const m = Number(rest)
    const start = new Date(Date.UTC(y, m-1, 1))
    const end = new Date(Date.UTC(y, m, 0))
    return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }
  }
  const start = new Date(Date.UTC(y, 0, 1))
  const end = new Date(Date.UTC(y, 12, 0))
  return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }
}

export function PaymentsAssignModal({ onClose }: { onClose: () => void }) {
  const [interval, setInterval] = useState<'MONTHLY'|'QUARTERLY'|'YEARLY'>('MONTHLY')
  const [mode, setMode] = useState<'PERIOD'|'RANGE'>('PERIOD')
  const [periodKey, setPeriodKey] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Array<{ memberId: number; name: string; memberNo?: string|null; status: string; periodKey: string; interval: 'MONTHLY'|'QUARTERLY'|'YEARLY'; amount: number; paid: number; voucherId?: number|null; verified?: number }>>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const payload = mode === 'PERIOD' ? { interval, periodKey, q } : { interval, from, to, q }
      const res = await (window as any).api?.payments?.listDue?.(payload)
      setRows(res?.rows || [])
    } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [interval, mode, periodKey, from, to, q])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal booking-modal" onClick={e => e.stopPropagation()} style={{ display: 'grid', gap: 10 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Mitgliedsbeiträge zuordnen</h2>
          <button className="btn" onClick={onClose}>×</button>
        </header>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={interval} onChange={e => {
            const v = e.target.value as any; setInterval(v)
            const d = new Date()
            setPeriodKey(v==='MONTHLY' ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : v==='QUARTERLY' ? `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}` : String(d.getFullYear()))
          }} title="Intervall">
            <option value="MONTHLY">Monat</option>
            <option value="QUARTERLY">Quartal</option>
            <option value="YEARLY">Jahr</option>
          </select>
          <select className="input" value={mode} onChange={e => setMode(e.target.value as any)} title="Modus">
            <option value="PERIOD">Periode</option>
            <option value="RANGE">Zeitraum</option>
          </select>
          {mode === 'PERIOD' ? (
            <input className="input" value={periodKey} onChange={e => setPeriodKey(sanitizePeriodKey(e.target.value, interval))} title="Periode: YYYY-MM | YYYY-Q1..Q4 | YYYY" />
          ) : (
            <>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </>
          )}
          <input className="input" placeholder="Mitglied suchen…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="helper">{busy ? 'Lade…' : `${rows.length} Einträge`}</div>
        </div>
        <table style={{ width: '100%' }} cellPadding={6}>
          <thead>
            <tr>
              <th align="left">Mitglied</th>
              <th>Periode</th>
              <th>Intervall</th>
              <th align="right">Betrag</th>
              <th>Vorschläge</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <PaymentsRow key={`${r.memberId}-${r.periodKey}`} row={r} onChanged={load} />
            ))}
            {rows.length === 0 && <tr><td colSpan={7}><div className="helper">Keine fälligen Beiträge</div></td></tr>}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}

function PaymentsRow({ row, onChanged }: { row: { memberId: number; name: string; memberNo?: string|null; status: string; periodKey: string; interval: 'MONTHLY'|'QUARTERLY'|'YEARLY'; amount: number; paid: number; voucherId?: number|null; verified?: number }; onChanged: () => void }) {
  const [suggestions, setSuggestions] = useState<Array<{ id: number; voucherNo: string; date: string; description?: string|null; counterparty?: string|null; gross: number }>>([])
  const [selVoucher, setSelVoucher] = useState<number | null>(row.voucherId ?? null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [manualList, setManualList] = useState<Array<{ id: number; voucherNo: string; date: string; description?: string|null; counterparty?: string|null; gross: number }>>([])
  const [showStatus, setShowStatus] = useState(false)
  const [statusData, setStatusData] = useState<any>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])

  useEffect(() => {
    let alive = true
    async function loadStatus() {
      try { const s = await (window as any).api?.payments?.status?.({ memberId: row.memberId }); if (alive) setStatusData(s || null) } catch { }
    }
    loadStatus()
    const onChanged = () => loadStatus()
    try { window.addEventListener('data-changed', onChanged) } catch {}
    return () => { alive = false; try { window.removeEventListener('data-changed', onChanged) } catch {} }
  }, [row.memberId])

  useEffect(() => {
    if (!showStatus) return
    let alive = true
    ;(async () => {
      try {
        const s = await (window as any).api?.payments?.status?.({ memberId: row.memberId })
        const h = await (window as any).api?.payments?.history?.({ memberId: row.memberId, limit: 20 })
        if (alive) { setStatusData(s || null); setHistoryRows(h?.rows || []) }
      } catch { }
    })()
    return () => { alive = false }
  }, [showStatus, row.memberId])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await (window as any).api?.payments?.suggestVouchers?.({ name: row.name, amount: row.amount, periodKey: row.periodKey })
        if (active) setSuggestions(res?.rows || [])
      } catch { }
    })()
    return () => { active = false }
  }, [row.memberId, row.periodKey, row.amount])

  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
  return (
    <tr>
      <td title={row.memberNo || undefined}>
        <span>{row.name}{row.memberNo ? ` (${row.memberNo})` : ''}</span>
        <button
          className="btn ghost"
          title="Beitragsstatus & Historie"
          aria-label="Beitragsstatus & Historie"
          onClick={() => setShowStatus(true)}
          style={{ marginLeft: 6, width: 24, height: 24, padding: 0, borderRadius: 6, display: 'inline-grid', placeItems: 'center', color: (statusData?.state === 'OVERDUE' ? 'var(--danger)' : statusData?.state === 'OK' ? 'var(--success)' : 'var(--text-dim)') }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm1 5h-2v6h6v-2h-4V8z"/></svg>
        </button>
        {showStatus && (
          <div className="modal-overlay" onClick={() => setShowStatus(false)}>
            <div className="modal" onClick={(e)=>e.stopPropagation()} style={{ width: 'min(96vw, 1100px)', maxWidth: 1100, display: 'grid', gap: 10 }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Beitragsstatus</h3>
                <button className="btn" onClick={()=>setShowStatus(false)}>×</button>
              </header>
              <div className="helper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>{row.name}{row.memberNo ? ` (${row.memberNo})` : ''}</span>
                <span className="badge" style={{ background: (statusData?.state === 'OVERDUE' ? 'var(--danger)' : statusData?.state === 'OK' ? 'var(--success)' : 'var(--muted)'), color: '#fff' }}>
                  {statusData?.state === 'OVERDUE' ? `Überfällig (${statusData?.overdue})` : statusData?.state === 'OK' ? 'OK' : '—'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="card" style={{ padding: 10 }}>
                  <strong>Überblick</strong>
                  <ul style={{ margin: '6px 0 0 16px' }}>
                    <li>Eintritt: {statusData?.joinDate || '—'}</li>
                    <li>Letzte Zahlung: {statusData?.lastPeriod ? `${statusData.lastPeriod} (${statusData?.lastDate||''})` : '—'}</li>
                    <li>Initiale Fälligkeit: {statusData?.nextDue || '—'}</li>
                  </ul>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <strong>Historie</strong>
                  <table cellPadding={6} style={{ width: '100%', marginTop: 6 }}>
                    <thead>
                      <tr>
                        <th align="left">Periode</th>
                        <th align="left">Datum</th>
                        <th align="right">Betrag</th>
                        <th align="left">Beleg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((r,i)=> (
                        <tr key={i}>
                          <td>{r.periodKey}</td>
                          <td>{r.datePaid}</td>
                          <td align="right">{eur.format(r.amount)}</td>
                          <td>
                            {r.voucherNo ? (
                              <a href="#" onClick={(e)=>{ e.preventDefault(); if (r.voucherId) { const ev = new CustomEvent('apply-voucher-jump', { detail: { voucherId: r.voucherId } }); window.dispatchEvent(ev) } }}>{`#${r.voucherNo}`}</a>
                            ) : '—'}
                            {r.description ? ` · ${r.description}` : ''}
                          </td>
                        </tr>
                      ))}
                      {historyRows.length===0 && <tr><td colSpan={4}><div className="helper">Keine Zahlungen</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn" onClick={()=>setShowStatus(false)}>Schließen</button>
              </div>
            </div>
          </div>
        )}
      </td>
      <td>{row.periodKey}</td>
      <td>{row.interval}</td>
      <td align="right">{eur.format(row.amount)}</td>
      <td>
        <div style={{ display: 'grid', gap: 6 }}>
          <select className="input" value={selVoucher ?? ''} onChange={e => setSelVoucher(e.target.value ? Number(e.target.value) : null)} title="Passende Buchung verknüpfen">
            <option value="">— ohne Verknüpfung —</option>
            {suggestions.map(s => (
              <option key={s.id} value={s.id}>{s.voucherNo || s.id} · {s.date} · {eur.format(s.gross)} · {(s.description || s.counterparty || '')}</option>
            ))}
            {manualList.map(s => (
              <option key={`m-${s.id}`} value={s.id}>{s.voucherNo || s.id} · {s.date} · {eur.format(s.gross)} · {(s.description || s.counterparty || '')}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" placeholder="Buchung suchen…" value={search} onChange={e => setSearch(e.target.value)} title="Suche in Buchungen (Betrag/Datum/Text)" />
            <button className="btn" onClick={async () => {
              try {
                const { start } = periodRangeLocal(row.periodKey)
                const s = new Date(start); s.setUTCDate(s.getUTCDate() - 90)
                const todayISO = new Date().toISOString().slice(0,10)
                const fromISO = s.toISOString().slice(0,10)
                const res = await (window as any).api?.vouchers?.list?.({ from: fromISO, to: todayISO, q: search || undefined, limit: 50 })
                const list = (res?.rows || []).map((v: any) => ({ id: v.id, voucherNo: v.voucherNo, date: v.date, description: v.description, counterparty: v.counterparty, gross: v.grossAmount }))
                setManualList(list)
              } catch {}
            }}>Suchen</button>
          </div>
        </div>
      </td>
      <td>{row.paid ? (row.verified ? 'bezahlt ✔︎ (verifiziert)' : 'bezahlt') : 'offen'}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {row.paid ? (
          <button className="btn" onClick={async () => { setBusy(true); try { await (window as any).api?.payments?.unmark?.({ memberId: row.memberId, periodKey: row.periodKey }); onChanged() } finally { setBusy(false) } }}>Rückgängig</button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { await (window as any).api?.payments?.markPaid?.({ memberId: row.memberId, periodKey: row.periodKey, interval: row.interval, amount: row.amount, voucherId: selVoucher || null }); onChanged() } finally { setBusy(false) } }}>Als bezahlt markieren</button>
        )}
      </td>
    </tr>
  )
}

export default PaymentsAssignModal
