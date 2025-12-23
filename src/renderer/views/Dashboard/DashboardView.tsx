import React, { useEffect, useMemo, useState } from 'react'
import { useIsModuleEnabled } from '../../context/moduleHooks'
import BudgetOverviewWidget from './widgets/BudgetOverviewWidget'
import HonorariaWidget from './widgets/HonorariaWidget'
import CashAdvancesWidget from './widgets/CashAdvancesWidget'
import CategorySpendingWidget from './widgets/CategorySpendingWidget'

export default function DashboardView({ today, onGoToInvoices }: { today: string; onGoToInvoices: () => void }) {
  void onGoToInvoices
  const [quote, setQuote] = useState<{ text: string; author?: string; source?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [cashier, setCashier] = useState<string>('')
  const instructorsEnabled = useIsModuleEnabled('instructors')
  const cashAdvanceEnabled = useIsModuleEnabled('cash-advance')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api?.quotes.weekly?.({ date: today }).then((q) => { if (!cancelled) setQuote(q) }).finally(() => { if (!cancelled) setLoading(false) })
    const load = async () => {
      try {
        const cn = await (window as any).api?.settings?.get?.({ key: 'org.cashier' })
        if (!cancelled) setCashier((cn?.value as any) || '')
      } catch { }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
  }, [today])

  const [yearsAvail, setYearsAvail] = useState<number[]>([])
  useEffect(() => {
    let cancelled = false
    window.api?.reports.years?.().then(res => { if (!cancelled && res?.years) setYearsAvail(res.years) })
    const onChanged = () => { window.api?.reports.years?.().then(res => { if (!cancelled && res?.years) setYearsAvail(res.years) }) }
    window.addEventListener('data-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
  }, [])

  const [period, setPeriod] = useState<'MONAT' | 'JAHR'>(() => {
    try {
      const v = (localStorage.getItem('dashPeriod') as any) || 'JAHR'
      return v === 'MONAT' ? 'MONAT' : 'JAHR'
    } catch {
      return 'JAHR'
    }
  })
  useEffect(() => { try { localStorage.setItem('dashPeriod', period) } catch { } }, [period])
  const [yearSel, setYearSel] = useState<number | null>(null)
  useEffect(() => {
    if (period === 'JAHR' && yearsAvail.length > 0 && (yearSel == null || !yearsAvail.includes(yearSel))) {
      setYearSel(yearsAvail[0])
    }
  }, [yearsAvail, period])

  const { from, to, selectedYear, periodLabel } = useMemo(() => {
    const now = new Date()
    const y = (period === 'JAHR' && yearSel) ? yearSel : now.getUTCFullYear()

    if (period === 'MONAT') {
      const monthFrom = new Date(Date.UTC(y, now.getUTCMonth(), 1)).toISOString().slice(0, 10)
      const monthTo = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
      return { from: monthFrom, to: monthTo, selectedYear: y, periodLabel: 'Monat' as const }
    }

    const yearFrom = new Date(Date.UTC(y, 0, 1)).toISOString().slice(0, 10)
    const yearTo = new Date(Date.UTC(y, 11, 31)).toISOString().slice(0, 10)
    return { from: yearFrom, to: yearTo, selectedYear: y, periodLabel: 'Jahr' as const }
  }, [period, yearSel])

  const [sum, setSum] = useState<null | { inGross: number; outGross: number; diff: number }>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const onDataChanged = () => setRefreshKey((k) => k + 1)
    window.addEventListener('data-changed', onDataChanged)
    return () => window.removeEventListener('data-changed', onDataChanged)
  }, [])
  useEffect(() => {
    let cancelled = false
    window.api?.reports.summary?.({ from, to }).then(res => {
      if (cancelled || !res) return
      const inGross = res.byType.find(x => x.key === 'IN')?.gross || 0
      const outGrossRaw = res.byType.find(x => x.key === 'OUT')?.gross || 0
      const outGross = Math.abs(outGrossRaw)
      const diff = Math.round((inGross - outGross) * 100) / 100
      setSum({ inGross, outGross, diff })
    })
    return () => { cancelled = true }
  }, [from, to, refreshKey])

  return (
    <div className="card dashboard-card">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-title">Hallo{cashier ? ` ${cashier}` : ''}</div>
          <div className="helper">Willkommen zurück – hier ist dein Überblick.</div>
        </div>
        <div className="dashboard-quote">
          <div className="helper">Satz der Woche</div>
          <div className="dashboard-quote-text">{loading ? '…' : (quote?.text || '—')}</div>
          <div className="helper">{quote?.author || quote?.source || ''}</div>
        </div>
      </div>
      <div className="dashboard-grid-auto">
        <div className="dashboard-period-row">
          <div className="btn-group" role="group" aria-label="Zeitraum">
            <button className={`btn ghost ${period === 'MONAT' ? 'btn-period-active' : ''}`} onClick={() => setPeriod('MONAT')}>Monat</button>
            <button className={`btn ghost ${period === 'JAHR' ? 'btn-period-active' : ''}`} onClick={() => setPeriod('JAHR')}>Jahr</button>
          </div>
          {period === 'JAHR' && yearsAvail.length > 1 && (
            <select className="input" value={String((yearSel ?? yearsAvail[0]))} onChange={(e) => setYearSel(Number(e.target.value))} aria-label="Jahr auswählen">
              {yearsAvail.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <BudgetOverviewWidget
          year={selectedYear}
          periodLabel={periodLabel}
          income={sum?.inGross || 0}
          expenses={sum?.outGross || 0}
          saldo={sum?.diff || 0}
        />
        <CategorySpendingWidget from={from} to={to} />
        {instructorsEnabled ? <HonorariaWidget year={selectedYear} /> : null}
        {cashAdvanceEnabled ? <CashAdvancesWidget /> : null}
      </div>

      <DashboardRecentActivity />
    </div>
  )
}

function DashboardRecentActivity() {
  const [rows, setRows] = React.useState<Array<any>>([])
  const [loading, setLoading] = React.useState(false)
  const [earmarks, setEarmarks] = React.useState<Array<{ id: number; code: string; name: string }>>([])
  const [budgets, setBudgets] = React.useState<Array<{ id: number; name?: string | null; year: number }>>([])
  const eur = React.useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  
  React.useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        setLoading(true)
        const res = await (window as any).api?.audit?.recent?.({ limit: 20 })
        const r = (res?.rows || res || []) as any[]
        if (alive) setRows(r)
      } catch { if (alive) setRows([]) } finally { if (alive) setLoading(false) }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => { alive = false; window.removeEventListener('data-changed', onChanged) }
  }, [])
  
  // Load earmarks and budgets for lookups
  React.useEffect(() => {
    let alive = true
    const loadMeta = async () => {
      try {
        const eRes = await (window as any).api?.bindings?.list?.({})
        const bRes = await (window as any).api?.budgets?.list?.({})
        if (alive) {
          setEarmarks((eRes?.rows || []) as any[])
          setBudgets((bRes?.rows || []) as any[])
        }
      } catch {}
    }
    loadMeta()
    const onChanged = () => loadMeta()
    window.addEventListener('data-changed', onChanged)
    return () => { alive = false; window.removeEventListener('data-changed', onChanged) }
  }, [])

  function describe(row: any): { title: string; details?: string; tone?: 'ok' | 'warn' | 'err' } {
    const a = String(row.action || '').toUpperCase()
    const e = String(row.entity || '').toUpperCase()
    const d = row.diff || {}
    
    // Handle batch assignments (robust to missing fields/casing)
    if (a === 'BATCH_ASSIGN_EARMARK') {
      const count = Number(d?.count || 0)
      const earmarkLabel = d?.earmarkId ? `#${d.earmarkId}` : 'Zweckbindung'
      return { title: `Batchzuweisung: ${count} Buchung(en)`, details: `Zweckbindung: ${earmarkLabel}`.trim(), tone: 'ok' }
    }
    if (a === 'BATCH_ASSIGN_BUDGET') {
      const count = Number(d?.count || 0)
      const budgetLabel = d?.budgetId ? `#${d.budgetId}` : 'Budget'
      return { title: `Batchzuweisung: ${count} Buchung(en)`, details: `Budget: ${budgetLabel}`.trim(), tone: 'ok' }
    }
    if (a === 'BATCH_ASSIGN_TAGS') {
      const count = Number(d?.count || 0)
      const tagsArr = Array.isArray(d?.tags) ? d.tags : []
      const tags = tagsArr
        .map((t: any) => typeof t === 'string' ? t : (t?.name || t?.label || ''))
        .filter((x: string) => x)
        .join(', ')
      return { title: `Batchzuweisung: ${count} Buchung(en)`, details: tags ? `Tags: ${tags}` : 'Tags', tone: 'ok' }
    }
    
    if (e === 'VOUCHERS' || e === 'VOUCHER') {
      if (a === 'CREATE') {
        const v = d.data || {}
        const amount = v.grossAmount ?? v.netAmount ?? 0
        const label = `${v.type || ''} ${v.paymentMethod || ''}`.trim()
          const desc = (v.description || '').trim()
          return { title: `Beleg ${label} ${eur.format(amount)} erstellt${desc ? ' · '+desc.slice(0, 80) : ''}`, details: '' }
      }
      if (a === 'UPDATE') {
        const ch = d.changes || {}
        const changes: string[] = []
        const add = (k: string, from?: any, to?: any, fmt?: (x:any)=>string) => {
          const explicit = Object.prototype.hasOwnProperty.call(ch, k)
          if (to === undefined && !explicit) return
          if (from === undefined && to === undefined) return
          const same = JSON.stringify(from) === JSON.stringify(to)
          if (same) return
          const f = fmt ? fmt(from) : (from == null ? '—' : String(from))
          const t = fmt ? fmt(to) : (to == null ? '—' : String(to))
          const nameMap: Record<string,string> = { grossAmount: 'Brutto', netAmount: 'Netto', vatRate: 'USt%', paymentMethod: 'Zahlweg', description: 'Beschreibung', date: 'Datum', type: 'Art', earmarkId: 'Zweckbindung', budgetId: 'Budget', tags: 'Tags' }
          const nm = nameMap[k] || k
          changes.push(`${nm}: ${f} → ${t}`)
        }
        add('description', d.before?.description, d.after?.description)
        add('date', d.before?.date, d.after?.date)
        add('type', d.before?.type, d.after?.type)
        add('paymentMethod', d.before?.paymentMethod, d.after?.paymentMethod)
        add('grossAmount', d.before?.grossAmount, d.after?.grossAmount, (x:any)=> eur.format(Number(x||0)))
        add('vatRate', d.before?.vatRate, d.after?.vatRate, (x:any)=> `${x ?? 0}%`)
        // Zweckbindung: Code anzeigen statt ID
        add('earmarkId', d.before?.earmarkId, d.after?.earmarkId, (id: any) => {
          if (!id) return '—'
          const em = earmarks.find(e => e.id === Number(id))
          return em ? `${em.code}` : `#${id}`
        })
        // Budget: Name anzeigen statt ID
        add('budgetId', d.before?.budgetId, d.after?.budgetId, (id: any) => {
          if (!id) return '—'
          const b = budgets.find(bu => bu.id === Number(id))
          return b ? (b.name || `${b.year}`) : `#${id}`
        })
        // Tags
        const tagsBefore = Array.isArray(d.before?.tags) ? d.before.tags : []
        const tagsAfter = Array.isArray(d.after?.tags) ? d.after.tags : (Array.isArray(ch.tags) ? ch.tags : [])
        const addedTags = tagsAfter.filter((t:string)=> !tagsBefore.includes(t))
        const removedTags = tagsBefore.filter((t:string)=> !tagsAfter.includes(t))
        if (addedTags.length) changes.push(`Tags hinzugefügt: ${addedTags.join(', ')}`)
        if (removedTags.length) changes.push(`Tags entfernt: ${removedTags.join(', ')}`)
        if (!changes.length) changes.push('Keine relevanten Änderungen')
        return { title: `Beleg #${row.entityId} geändert`, details: changes.slice(0,3).join(' · '), tone: 'ok' }
      }
      if (a === 'DELETE') {
        const s = d.snapshot || {}
        return { title: `Beleg #${row.entityId} gelöscht`, details: `${eur.format(Math.abs(Number(s.grossAmount||0)))} · ${(s.description || '').slice(0, 80)}`, tone: 'err' }
      }
      if (a === 'REVERSE') {
        return { title: `Storno erstellt für Beleg #${d.originalId}`, details: 'Automatisch gegen gebucht.', tone: 'warn' }
      }
      if (a === 'CLEAR_ALL') {
        return { title: `Alle Belege gelöscht`, details: `${d.deleted || 0} Einträge entfernt`, tone: 'err' }
      }
    }
    if (e === 'IMPORTS' && a === 'EXECUTE') {
      return { title: `Import ausgeführt (${d.format || 'Datei'})`, details: `importiert ${d.imported || 0}, übersprungen ${d.skipped || 0}, Fehler ${d.errorCount || 0}` }
    }
    // Fallback
    return { title: `${a} ${e} #${row.entityId || ''}`.trim(), details: '' }
  }

  const ActionIcon = ({ kind, color }: { kind: string; color: string }) => {
    const a = String(kind || '').toUpperCase()
    const common = { width: 16, height: 16, viewBox: '0 0 24 24' } as any
    // Dedicated icon for batch assignments
    if (a.startsWith('BATCH_ASSIGN')) {
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Batchzuweisung">
          {/* Stacked squares to indicate multiple items */}
          <rect x="4" y="4" width="10" height="10" rx="2" />
          <rect x="10" y="10" width="10" height="10" rx="2" />
          {/* Check mark */}
          <path d="M12 12l2 2 4-4" />
        </svg>
      )
    }
    if (a === 'CREATE') {
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="erstellt">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    }
    if (a === 'DELETE') {
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="gelöscht">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 14h10l1-14" />
          <path d="M10 10v8M14 10v8" />
        </svg>
      )
    }
    if (a === 'UPDATE') {
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="geändert">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      )
    }
    // default dot
    return (
      <svg {...common} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="helper">Letzte Aktivitäten</div>
      {rows.length === 0 && !loading && <div className="helper">Keine Einträge.</div>}
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {rows.map((r: any) => {
          const info = describe(r)
          // Convert UTC timestamp to local time
          const tsAct = r.createdAt ? new Date(r.createdAt).toLocaleString('de-DE', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          }).replace(',', '') : '—'
          const recDateRaw = r.recordDate ? String(r.recordDate).slice(0, 10) : null
          const color = info.tone === 'err' ? 'var(--danger)' : info.tone === 'warn' ? '#f9a825' : 'var(--accent)'
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'baseline' }}>
              <div className="helper" style={{ whiteSpace: 'nowrap' }}>{tsAct}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span className="activity-icon" aria-hidden>
                      <ActionIcon kind={String(r.action)} color={color} />
                    </span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.title}</div>
                  </div>
                  {recDateRaw ? (
                    <div className="helper" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>
                      Belegdatum: {recDateRaw}
                    </div>
                  ) : null}
                </div>
                {info.details ? <div className="helper" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.details}</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
