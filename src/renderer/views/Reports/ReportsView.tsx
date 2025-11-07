import React, { useEffect, useMemo, useRef, useState } from 'react'

export type Sphere = 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
export type VoucherType = 'IN' | 'OUT' | 'TRANSFER'
export type PaymentMethod = 'BAR' | 'BANK'

export default function ReportsView(props: {
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
  yearsAvail: number[]
  filterSphere: Sphere | null
  setFilterSphere: (v: Sphere | null) => void
  filterType: VoucherType | null
  setFilterType: (v: VoucherType | null) => void
  filterPM: PaymentMethod | null
  setFilterPM: (v: PaymentMethod | null) => void
  onOpenExport: () => void
  refreshKey: number
  activateKey: number
}) {
  const { from, to, setFrom, setTo, yearsAvail, filterSphere, setFilterSphere, filterType, setFilterType, filterPM, setFilterPM, onOpenExport, refreshKey, activateKey } = props

  return (
    <>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-dim)' }}>Zeitraum:</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <span style={{ color: 'var(--text-dim)' }}>Jahr:</span>
            <select className="input" value={(() => {
              if (!from || !to) return ''
              const fy = from.slice(0, 4)
              const ty = to.slice(0, 4)
              if (from === `${fy}-01-01` && to === `${fy}-12-31` && fy === ty) return fy
              return ''
            })()} onChange={(e) => {
              const y = e.target.value
              if (!y) { setFrom(''); setTo(''); return }
              const yr = Number(y)
              const f = new Date(Date.UTC(yr, 0, 1)).toISOString().slice(0, 10)
              const t = new Date(Date.UTC(yr, 11, 31)).toISOString().slice(0, 10)
              setFrom(f); setTo(t)
            }}>
              <option value="">Alle</option>
              {yearsAvail.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <div className="inline-field">
              <span style={{ color: 'var(--text-dim)' }}>Sphäre:</span>
              <select className="input" value={filterSphere ?? ''} onChange={(e) => setFilterSphere((e.target.value as Sphere | any) || null)}>
                <option value="">Alle</option>
                <option value="IDEELL">IDEELL</option>
                <option value="ZWECK">ZWECK</option>
                <option value="VERMOEGEN">VERMOEGEN</option>
                <option value="WGB">WGB</option>
              </select>
            </div>
            <span style={{ color: 'var(--text-dim)' }}>Art:</span>
            <select className="input" value={filterType ?? ''} onChange={(e) => setFilterType((e.target.value as VoucherType | any) || null)}>
              <option value="">Alle</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>
            <span style={{ color: 'var(--text-dim)' }}>Zahlweg:</span>
            <select className="input" value={filterPM ?? ''} onChange={(e) => { const v = e.target.value as PaymentMethod | any; props.setFilterPM(v || null) }}>
              <option value="">Alle</option>
              <option value="BAR">Bar</option>
              <option value="BANK">Bank</option>
            </select>
            <button className="btn ghost" title="Filter zurücksetzen" onClick={() => { setFilterSphere(null); setFilterType(null); setFilterPM(null); setFrom(''); setTo(''); }}>Filter zurücksetzen</button>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => onOpenExport()}>Exportieren…</button>
          </div>
        </div>
      </div>

      {/* KPIs and charts */}
      <ReportsSummary refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ReportsSphereDonut refreshKey={refreshKey} from={from || undefined} to={to || undefined} />
        <ReportsPaymentMethodBars refreshKey={refreshKey} from={from || undefined} to={to || undefined} />
      </div>
      <div style={{ height: 12 }} />
      <ReportsMonthlyChart activateKey={activateKey} refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
      <ReportsInOutLines activateKey={activateKey} refreshKey={refreshKey} from={from || undefined} to={to || undefined} sphere={filterSphere || undefined} />
    </>
  )
}

function ReportsSummary(props: { refreshKey?: number; from?: string; to?: string; sphere?: Sphere; type?: VoucherType; paymentMethod?: PaymentMethod }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<null | {
    totals: { net: number; vat: number; gross: number }
    bySphere: Array<{ key: Sphere; net: number; vat: number; gross: number }>
    byPaymentMethod: Array<{ key: PaymentMethod | null; net: number; vat: number; gross: number }>
    byType: Array<{ key: VoucherType; net: number; vat: number; gross: number }>
  }>(null)
  const [monthsCount, setMonthsCount] = useState<number>(0)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(window as any).api?.reports.summary?.({ from: props.from, to: props.to, sphere: props.sphere, type: props.type, paymentMethod: props.paymentMethod })
      .then((res: any) => { if (!cancelled) setData(res) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.sphere, props.type, props.paymentMethod, props.refreshKey])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'IN', paymentMethod: props.paymentMethod }),
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'OUT', paymentMethod: props.paymentMethod })
    ]).then(([inRes, outRes]) => {
      if (cancelled) return
      const months = new Set<string>()
      for (const b of (inRes?.buckets || [])) months.add(b.month)
      for (const b of (outRes?.buckets || [])) months.add(b.month)
      setMonthsCount(months.size)
    }).catch(() => setMonthsCount(0))
    return () => { cancelled = true }
  }, [props.from, props.to, props.sphere, props.paymentMethod, props.refreshKey])

  return (
    <div className="card" style={{ marginTop: 12, padding: 12, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Summen</strong>
          <div className="helper">Für den gewählten Zeitraum und die Filter.</div>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {data && (
        <div style={{ display: 'grid', gap: 12 }}>
          {(() => {
            const inSum = (data.byType.find(t => t.key === 'IN')?.gross || 0)
            const outSum = (data.byType.find(t => t.key === 'OUT')?.gross || 0)
            const net = inSum - outSum
            const avgPerMonth = monthsCount > 0 ? (net / monthsCount) : null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <div className="card" style={{ padding: 10 }}>
                  <div className="helper">Einnahmen (Brutto)</div>
                  <div style={{ fontWeight: 600, color: '#2e7d32' }}>{eurFmt.format(inSum)}</div>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <div className="helper">Ausgaben (Brutto)</div>
                  <div style={{ fontWeight: 600, color: '#c62828' }}>{eurFmt.format(outSum)}</div>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <div className="helper">Netto</div>
                  <div style={{ fontWeight: 600, color: (net >= 0 ? 'var(--success)' : 'var(--danger)') }}>{eurFmt.format(net)}</div>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <div className="helper">Ø Netto/Monat{monthsCount > 0 ? ` (${monthsCount}m)` : ''}</div>
                  <div style={{ fontWeight: 600 }}>{avgPerMonth != null ? eurFmt.format(avgPerMonth) : '—'}</div>
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><div className="helper">Netto</div><div>{eurFmt.format(data.totals.net)}</div></div>
            <div><div className="helper">MwSt</div><div>{eurFmt.format(data.totals.vat)}</div></div>
            <div><div className="helper">Brutto</div><div>{eurFmt.format(data.totals.gross)}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <strong>Nach Sphäre</strong>
              <ul>
                {data.bySphere.map((r) => (
                  <li key={r.key}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key}</span> {eurFmt.format(r.gross)}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Nach Zahlweg</strong>
              <ul>
                {data.byPaymentMethod.map((r, i) => (
                  <li key={(r.key ?? 'NULL') + i}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key ?? '—'}</span> {eurFmt.format(r.gross)}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Nach Art</strong>
              <ul>
                {data.byType.map((r) => (
                  <li key={r.key}><span style={{ minWidth: 90, display: 'inline-block' }}>{r.key}</span> {eurFmt.format(r.gross)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsMonthlyChart(props: { activateKey?: number; refreshKey?: number; from?: string; to?: string; sphere?: Sphere; type?: VoucherType; paymentMethod?: PaymentMethod }) {
  const [loading, setLoading] = useState(false)
  const [inBuckets, setInBuckets] = useState<Array<{ month: string; gross: number }>>([])
  const [outBuckets, setOutBuckets] = useState<Array<{ month: string; gross: number }>>([])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [capOutliers, setCapOutliers] = useState<boolean>(() => {
    try { return localStorage.getItem('reports.capOutliers') === '1' } catch { return false }
  })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState<number>(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rectW = el.getBoundingClientRect().width
      const parentW = el.parentElement?.clientWidth || 0
      const w = Math.max(rectW, parentW, 0)
      if (w && Math.abs(w - containerW) > 1) setContainerW(w)
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    const onResize = () => measure()
    const onVisibility = () => { if (document.visibilityState === 'visible') { setTimeout(measure, 0); setTimeout(measure, 120) } }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    const t0 = setTimeout(measure, 0)
    const t1 = setTimeout(measure, 120)
    const t2 = setTimeout(measure, 360)
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVisibility); clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rectW = el.getBoundingClientRect().width
      const parentW = el.parentElement?.clientWidth || 0
      const w = Math.max(rectW, parentW, 0)
      if (w && Math.abs(w - containerW) > 1) setContainerW(w)
    }
    requestAnimationFrame(() => {
      measure()
      setTimeout(measure, 0)
      setTimeout(measure, 120)
      setTimeout(measure, 360)
    })
  }, [props.activateKey])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'IN', paymentMethod: props.paymentMethod }),
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'OUT', paymentMethod: props.paymentMethod })
    ]).then(([inRes, outRes]) => {
      if (cancelled) return
      setInBuckets((inRes?.buckets || []).map((b: any) => ({ month: b.month, gross: b.gross })))
      setOutBuckets((outRes?.buckets || []).map((b: any) => ({ month: b.month, gross: b.gross })))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.sphere, props.paymentMethod, props.refreshKey])

  const months = Array.from(new Set([...(inBuckets.map(b => b.month)), ...(outBuckets.map(b => b.month))])).sort()
  const series = months.map(m => ({
    month: m,
    inGross: inBuckets.find(b => b.month === m)?.gross || 0,
    outGross: -(Math.abs(outBuckets.find(b => b.month === m)?.gross || 0)),
  }))
  const saldo = (() => {
    let cum = 0
    return series.map((s) => { cum += (s.inGross + s.outGross); return cum })
  })()
  const scaleVals = (() => {
    const vals: number[] = []
    for (const s of series) { vals.push(Math.abs(s.inGross)); vals.push(Math.abs(s.outGross)); }
    for (const v of saldo) vals.push(Math.abs(v))
    return vals
  })()
  const p95 = (arr: number[]) => {
    if (!arr.length) return 1
    const a = arr.slice().sort((x, y) => x - y)
    const idx = Math.max(0, Math.min(a.length - 1, Math.floor(0.95 * (a.length - 1))))
    return Math.max(1, a[idx])
  }
  const maxValRaw = Math.max(1, ...scaleVals)
  const maxVal = capOutliers ? p95(scaleVals) : maxValRaw
  const margin = { top: 22, right: 28, bottom: 42, left: 34 }
  const innerH = 180
  const defaultGroupW = 44
  const barW = 16
  const gap = 16
  const minWidth = Math.max(360, months.length * (defaultGroupW + gap) + margin.left + margin.right)
  const width = Math.max(containerW || 0, minWidth)
  const height = innerH + margin.top + margin.bottom
  const yBase = margin.top
  const yAxisX = margin.left - 2
  const innerW = width - (margin.left + margin.right)
  const groupW = months.length > 0 ? Math.max(40, Math.min(90, Math.floor((innerW - (months.length - 1) * gap) / months.length))) : defaultGroupW
  const monthLabel = (m: string, withYear = false) => {
    const [y, mm] = m.split('-').map(Number)
    const d = new Date(Date.UTC(y, (mm - 1) as number, 1))
    const mon = d.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
    return withYear ? `${mon} ${y}` : mon
  }
  const years = useMemo(() => Array.from(new Set(months.map(m => m.slice(0, 4)))), [months])
  const xFor = (idx: number) => margin.left + idx * (groupW + gap)
  const yFor = (val: number) => yBase + (innerH - Math.round((Math.abs(val) / maxVal) * innerH))

  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Monatsverlauf (Balken: IN/OUT · Linie: kumulierter Saldo)</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="helper" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Skalierung gegen Ausreißer robuster machen (95. Perzentil)">
            <input type="checkbox" checked={capOutliers} onChange={(e) => { const v = e.target.checked; setCapOutliers(v); try { localStorage.setItem('reports.capOutliers', v ? '1' : '0') } catch {} }} /> Ausreißer abblenden
          </label>
          <div className="legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: '#2e7d32' }}></span>IN</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: '#c62828' }}></span>OUT</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)' }}></span>Saldo</span>
          </div>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {!loading && (
        <div ref={containerRef} style={{ overflowX: 'auto', position: 'relative' }}>
          {(() => {
            const focusIdx = (typeof hoverIdx === 'number' ? hoverIdx : null)
            const idx = focusIdx
            if (idx == null || !series[idx]) return null
            const s = series[idx]
            const net = s.inGross + s.outGross
            return (
              <div style={{ position: 'absolute', top: 6, left: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <strong style={{ fontSize: 12 }}>{monthLabel(s.month, true)}</strong>
                <span className="chip" style={{ background: '#2e7d32', color: '#fff' }}>IN {eurFmt.format(s.inGross)}</span>
                <span className="chip" style={{ background: '#c62828', color: '#fff' }}>OUT {eurFmt.format(Math.abs(s.outGross))}</span>
                <span className="chip" style={{ background: net >= 0 ? '#2e7d32' : '#c62828', color: '#fff' }}>Netto {eurFmt.format(net)}</span>
              </div>
            )
          })()}
          <svg ref={svgRef} width={width} height={height} role="img" aria-label="Monatsverlauf">
            {Array.from({ length: 4 }).map((_, i) => {
              const y = yBase + (innerH / 4) * i
              return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
            })}
            {series.map((s, i) => {
              const gx = xFor(i)
              const hIn = Math.round((Math.abs(s.inGross) / maxVal) * innerH)
              const hOut = Math.round((Math.abs(s.outGross) / maxVal) * innerH)
              const yIn = yBase + (innerH - hIn)
              const yOut = yBase + (innerH - hOut)
              const saldoMonth = s.inGross + s.outGross
              return (
                <g key={i}>
                  <rect x={gx} y={yIn} width={barW} height={hIn} fill="#2e7d32" rx={3} />
                  <rect x={gx + barW + 6} y={yOut} width={barW} height={hOut} fill="#c62828" rx={3} />
                  {(() => {
                    const hNet = Math.round((Math.abs(saldoMonth) / maxVal) * innerH)
                    const yNet = yBase + (innerH - hNet)
                    const color = saldoMonth >= 0 ? '#2e7d32' : '#c62828'
                    return <rect x={gx + barW - 2} y={yNet} width={6} height={hNet} fill={color} rx={2} opacity={0.7} />
                  })()}
                  {hoverIdx === i && (
                    <g>
                      <text x={gx + barW} y={Math.min(yIn, yOut) - 6} textAnchor="middle" fontSize="10">
                        {`${monthLabel(s.month, true)}: IN ${eurFmt.format(s.inGross)}, OUT ${eurFmt.format(s.outGross)}, Saldo ${eurFmt.format(saldoMonth)}`}
                      </text>
                    </g>
                  )}
                  <text x={gx + barW} y={yBase + innerH + 18} textAnchor="middle" fontSize="10">{monthLabel(s.month, false)}</text>
                  <title>{`${monthLabel(s.month, true)}\nIN: ${eurFmt.format(s.inGross)}\nOUT: ${eurFmt.format(Math.abs(s.outGross))}\nNetto: ${eurFmt.format(saldoMonth)}\nKlick für Drilldown`}</title>
                </g>
              )
            })}
            {saldo.length > 0 && (
              <g>
                {saldo.map((v, i) => {
                  const x = xFor(i) + barW
                  const y = yFor(v)
                  return <circle key={`p-${i}`} cx={x} cy={y} r={2} fill={'var(--accent)'} />
                })}
                {saldo.map((v, i) => {
                  if (i === 0) return null
                  const x1 = xFor(i - 1) + barW
                  const y1 = yFor(saldo[i - 1])
                  const x2 = xFor(i) + barW
                  const y2 = yFor(v)
                  return <line key={`l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={'var(--accent)'} strokeWidth={2} />
                })}
              </g>
            )}
            <line x1={yAxisX} y1={yBase} x2={yAxisX} y2={yBase + innerH} stroke="var(--border)" />
            {years.length > 0 && (
              <text x={Math.round(width / 2)} y={yBase + innerH + 34} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
                {years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`}
              </text>
            )}
          </svg>
        </div>
      )}
    </div>
  )
}

function ReportsSphereDonut(props: { refreshKey?: number; from?: string; to?: string }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Array<{ key: Sphere; gross: number }>>([])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(window as any).api?.reports.summary?.({ from: props.from, to: props.to })
      .then((res: any) => {
        if (cancelled || !res) return
        setRows(res.bySphere.map((r: any) => ({ key: r.key, gross: r.gross })))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.refreshKey])
  const total = rows.reduce((a, b) => a + Math.abs(b.gross), 0) || 1
  const colors: Record<string, string> = { IDEELL: '#7e57c2', ZWECK: '#26a69a', VERMOEGEN: '#8d6e63', WGB: '#42a5f5' }
  const size = { w: 320, h: 220 }
  const cx = 110
  const cy = 110
  const outerR = 90
  const innerR = 52
  let angleAcc = -Math.PI / 2
  const arcs = rows.map((r) => {
    const frac = Math.abs(r.gross) / total
    const angle = frac * Math.PI * 2
    const start = angleAcc
    const end = angleAcc + angle
    angleAcc = end
    return { key: r.key, gross: r.gross, frac, start, end }
  })
  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Nach Sphäre</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="legend">
            {rows.map(r => (
              <span key={r.key} className="legend-item"><span className="legend-swatch" style={{ background: colors[r.key] }}></span>{r.key}</span>
            ))}
          </div>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <svg ref={svgRef} width={size.w} height={size.h} role="img" aria-label="Nach Sphäre">
            {arcs.map((a, idx) => {
              const largeArc = (a.end - a.start) > Math.PI ? 1 : 0
              const sx = cx + outerR * Math.cos(a.start)
              const sy = cy + outerR * Math.sin(a.start)
              const ex = cx + outerR * Math.cos(a.end)
              const ey = cy + outerR * Math.sin(a.end)
              const isx = cx + innerR * Math.cos(a.end)
              const isy = cy + innerR * Math.sin(a.end)
              const iex = cx + innerR * Math.cos(a.start)
              const iey = cy + innerR * Math.sin(a.start)
              const d = [
                `M ${sx} ${sy}`,
                `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ex} ${ey}`,
                `L ${isx} ${isy}`,
                `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iex} ${iey}`,
                'Z'
              ].join(' ')
              const mid = (a.start + a.end) / 2
              const lx = cx + (innerR + (outerR - innerR) * 0.62) * Math.cos(mid)
              const ly = cy + (innerR + (outerR - innerR) * 0.62) * Math.sin(mid)
              const pct = Math.round(a.frac * 100)
              return (
                <g key={idx}>
                  <path d={d} fill={colors[a.key]}>
                    <title>{`${a.key}: ${eurFmt.format(a.gross)} (${pct}%)`}</title>
                  </path>
                  {pct >= 7 && (
                    <text x={lx} y={ly} textAnchor="middle" fontSize="11" fill="#fff">{`${pct}%`}</text>
                  )}
                </g>
              )
            })}
          </svg>
          <div>
            <div className="helper">Summe (Brutto)</div>
            <div>{eurFmt.format(rows.reduce((a, b) => a + b.gross, 0))}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsPaymentMethodBars(props: { refreshKey?: number; from?: string; to?: string }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Array<{ key: PaymentMethod | null; inGross: number; outGross: number }>>([])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      (window as any).api?.reports.summary?.({ from: props.from, to: props.to, type: 'IN' }),
      (window as any).api?.reports.summary?.({ from: props.from, to: props.to, type: 'OUT' })
    ]).then(([sumIn, sumOut]) => {
      if (cancelled) return
      const keys: Array<PaymentMethod | null> = ['BAR', 'BANK', null]
      const map: Record<string, { inGross: number; outGross: number }> = { 'BAR': { inGross: 0, outGross: 0 }, 'BANK': { inGross: 0, outGross: 0 }, 'null': { inGross: 0, outGross: 0 } }
      sumIn?.byPaymentMethod.forEach((r: any) => { const k = (r.key ?? 'null'); (map as any)[k] = (map as any)[k] || { inGross: 0, outGross: 0 }; (map as any)[k].inGross = r.gross })
      sumOut?.byPaymentMethod.forEach((r: any) => { const k = (r.key ?? 'null'); (map as any)[k] = (map as any)[k] || { inGross: 0, outGross: 0 }; (map as any)[k].outGross = r.gross })
      setData(keys.map(k => ({ key: k, inGross: (map as any)[(k ?? 'null')].inGross || 0, outGross: (map as any)[(k ?? 'null')].outGross || 0 })))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.refreshKey])
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.inGross, d.outGross)))
  const margin = { top: 22, right: 24, bottom: 24, left: 80 }
  const rowH = 30
  const gap = 14
  const innerH = data.length * rowH + (data.length - 1) * gap
  const height = innerH + margin.top + margin.bottom
  const width = 420
  const xFor = (val: number) => margin.left + Math.round((Math.abs(val) / maxVal) * (width - margin.left - margin.right))
  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Nach Zahlweg (IN/OUT)</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: '#2e7d32' }}></span>IN</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: '#c62828' }}></span>OUT</span>
          </div>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {!loading && (
        <svg ref={svgRef} width={width} height={height} role="img" aria-label="Nach Zahlweg">
          {data.map((r, i) => {
            const y = margin.top + i * (rowH + gap)
            const inX = xFor(r.inGross)
            const outX = xFor(r.outGross)
            const yBar = y + 8
            const label = r.key ?? '—'
            return (
              <g key={(r.key ?? 'NULL') + i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                <text x={margin.left - 8} y={y + rowH / 2} textAnchor="end" dominantBaseline="middle" fontSize="12">{label}</text>
                <rect x={margin.left} y={yBar} width={Math.max(0, inX - margin.left)} height={10} fill="#2e7d32" rx={3} />
                <rect x={margin.left} y={yBar + 12} width={Math.max(0, outX - margin.left)} height={10} fill="#c62828" rx={3} />
                {hoverIdx === i && (
                  <g>
                    <text x={Math.max(margin.left + 4, inX - 6)} y={yBar - 4} textAnchor="end" fontSize="11" fill="#fff">
                      {eurFmt.format(r.inGross)}
                    </text>
                    <text x={Math.max(margin.left + 4, outX - 6)} y={yBar + 12 + 22} textAnchor="end" fontSize="11" fill="#fff">
                      {eurFmt.format(r.outGross)}
                    </text>
                  </g>
                )}
                <title>{`${label}\nIN: ${eurFmt.format(r.inGross)}\nOUT: ${eurFmt.format(r.outGross)}`}</title>
              </g>
            )
          })}
          <line x1={margin.left - 2} y1={margin.top - 6} x2={margin.left - 2} y2={height - margin.bottom + 6} stroke="var(--border)" />
        </svg>
      )}
    </div>
  )
}

function ReportsInOutLines(props: { activateKey?: number; refreshKey?: number; from?: string; to?: string; sphere?: Sphere }) {
  const [loading, setLoading] = useState(false)
  const [inBuckets, setInBuckets] = useState<Array<{ month: string; gross: number }>>([])
  const [outBuckets, setOutBuckets] = useState<Array<{ month: string; gross: number }>>([])
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState<number>(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const w = Math.max(el.getBoundingClientRect().width, el.parentElement?.clientWidth || 0)
      if (w && Math.abs(w - containerW) > 1) setContainerW(w)
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    const onResize = () => measure()
    const onVis = () => { if (document.visibilityState === 'visible') { setTimeout(measure, 0); setTimeout(measure, 120) } }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    const t0 = setTimeout(measure, 0)
    const t1 = setTimeout(measure, 120)
    const t2 = setTimeout(measure, 360)
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const w = Math.max(el.getBoundingClientRect().width, el.parentElement?.clientWidth || 0)
      if (w && Math.abs(w - containerW) > 1) setContainerW(w)
    }
    requestAnimationFrame(() => {
      measure()
      setTimeout(measure, 0)
      setTimeout(measure, 120)
      setTimeout(measure, 360)
    })
  }, [props.activateKey])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'IN' }),
      (window as any).api?.reports.monthly?.({ from: props.from, to: props.to, sphere: props.sphere, type: 'OUT' })
    ]).then(([inRes, outRes]) => {
      if (cancelled) return
      setInBuckets((inRes?.buckets || []).map((b: any) => ({ month: b.month, gross: b.gross })))
      setOutBuckets((outRes?.buckets || []).map((b: any) => ({ month: b.month, gross: b.gross })))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.sphere, props.refreshKey])
  const months = Array.from(new Set([...(inBuckets.map(b => b.month)), ...(outBuckets.map(b => b.month))])).sort()
  const maxVal = Math.max(1, ...months.map(m => Math.max(Math.abs(inBuckets.find(b => b.month === m)?.gross || 0), Math.abs(outBuckets.find(b => b.month === m)?.gross || 0))))
  const margin = { top: 22, right: 22, bottom: 42, left: 30 }
  const innerH = 188
  const height = innerH + margin.top + margin.bottom
  let baseStep = 54
  const minWidth = Math.max(340, months.length * baseStep + margin.left + margin.right)
  const width = Math.max(containerW || 0, minWidth)
  let step = baseStep
  if (containerW && months.length > 1) {
    const innerW = width - (margin.left + margin.right)
    step = Math.max(40, Math.min(140, Math.floor(innerW / (months.length - 1))))
  }
  const xFor = (idx: number) => margin.left + idx * step
  const yFor = (val: number) => margin.top + (innerH - Math.round((Math.abs(val) / maxVal) * innerH))
  const monthLabel = (m: string, withYear = false) => {
    const [y, mm] = m.split('-').map(Number)
    const d = new Date(Date.UTC(y, (mm - 1) as number, 1))
    const mon = d.toLocaleString('de-DE', { month: 'short' }).replace('.', '')
    return withYear ? `${mon} ${y}` : mon
  }
  const years = useMemo(() => Array.from(new Set(months.map(m => m.slice(0, 4)))), [months])
  const points = (arr: Array<{ month: string; gross: number }>) => months.map((m, i) => `${xFor(i)},${yFor(arr.find(b => b.month === m)?.gross || 0)}`).join(' ')
  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Linienverlauf Einnahmen (IN) vs. Ausgaben (OUT) – Brutto</strong>
        <div className="legend">
          <span className="legend-item"><span className="legend-swatch" style={{ background: '#2e7d32' }}></span>IN</span>
          <span className="legend-item"><span className="legend-swatch" style={{ background: '#c62828' }}></span>OUT</span>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {!loading && (
        <div ref={containerRef} style={{ overflowX: 'auto', position: 'relative' }}>
          {(() => {
            const idx = (typeof hoverIdx === 'number' ? hoverIdx : null)
            if (idx == null) return null
            const m = months[idx]
            const inn = inBuckets.find(b => b.month === m)?.gross || 0
            const out = outBuckets.find(b => b.month === m)?.gross || 0
            return (
              <div style={{ position: 'absolute', top: 6, left: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <strong style={{ fontSize: 12 }}>{monthLabel(m, true)}</strong>
                <span className="chip" style={{ background: '#2e7d32', color: '#fff' }}>IN {eurFmt.format(inn)}</span>
                <span className="chip" style={{ background: '#c62828', color: '#fff' }}>OUT {eurFmt.format(out)}</span>
              </div>
            )
          })()}
          <svg width={width} height={height} role="img" aria-label="IN vs OUT">
            {Array.from({ length: 4 }).map((_, i) => {
              const y = margin.top + (innerH / 4) * i
              return <line key={i} x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="var(--border)" opacity={0.5} />
            })}
            <polyline fill="none" stroke="#2e7d32" strokeWidth="2" points={points(inBuckets)} />
            <polyline fill="none" stroke="#c62828" strokeWidth="2" points={points(outBuckets)} />
            {months.map((m, i) => (
              <g key={m} style={{ cursor: 'pointer' }}>
                {(() => {
                  const left = (i === 0 ? margin.left : Math.round((xFor(i - 1) + xFor(i)) / 2))
                  const right = (i === months.length - 1 ? (width - margin.right) : Math.round((xFor(i) + xFor(i + 1)) / 2))
                  const hitX = Math.max(margin.left, left)
                  const hitW = Math.max(8, right - left)
                  return (
                    <rect x={hitX} y={margin.top} width={hitW} height={innerH} fill="transparent"
                      onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} onClick={() => setHoverIdx(i)}
                      onDoubleClick={() => {
                        const [yy, mm] = m.split('-').map(Number)
                        const from = new Date(Date.UTC(yy, (mm - 1) as number, 1)).toISOString().slice(0, 10)
                        const to = new Date(Date.UTC(yy, (mm - 1) as number + 1, 0)).toISOString().slice(0, 10)
                        const ev = new CustomEvent('apply-budget-jump', { detail: { from, to } })
                        window.dispatchEvent(ev)
                      }} />
                  )
                })()}
                <circle cx={xFor(i)} cy={yFor(inBuckets.find(b => b.month === m)?.gross || 0)} r={3} fill="#2e7d32">
                  <title>{`IN ${monthLabel(m, true)}: ${eurFmt.format(inBuckets.find(b => b.month === m)?.gross || 0)}`}</title>
                </circle>
                <circle cx={xFor(i)} cy={yFor(outBuckets.find(b => b.month === m)?.gross || 0)} r={3} fill="#c62828">
                  <title>{`OUT ${monthLabel(m, true)}: ${eurFmt.format(outBuckets.find(b => b.month === m)?.gross || 0)}`}</title>
                </circle>
                <text x={xFor(i)} y={margin.top + innerH + 18} textAnchor="middle" fontSize="10">{monthLabel(m, false)}</text>
              </g>
            ))}
            {years.length > 0 && (
              <text x={Math.round(width / 2)} y={margin.top + innerH + 34} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
                {years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`}
              </text>
            )}
          </svg>
        </div>
      )}
    </div>
  )
}
