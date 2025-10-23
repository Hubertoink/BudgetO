import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { BalanceAreaChartProps } from './types'

type Bucket = { month: string; net: number; vat: number; gross: number }

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'] as const

function monthKeys(from: string, to: string): string[] {
  if (!from || !to) return []
  const out: string[] = []
  const [y0, m0] = [Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1]
  const [y1, m1] = [Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1]
  const d = new Date(Date.UTC(y0, m0, 1))
  while (d.getUTCFullYear() < y1 || (d.getUTCFullYear() === y1 && d.getUTCMonth() <= m1)) {
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
}

export default function BalanceAreaChart({ from, to }: BalanceAreaChartProps) {
  const [rows, setRows] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const svgRef = useRef<SVGSVGElement | null>(null)
  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await (window as any).api?.reports?.monthly?.({ from, to })
        const buckets: Bucket[] = (res?.buckets || res || []) as Bucket[]
        if (!alive) return
        const keys = monthKeys(from, to)
        const map = new Map<string, Bucket>()
        for (const b of buckets) map.set(String((b as any).month), { month: String((b as any).month), net: Number((b as any).net)||0, vat: Number((b as any).vat)||0, gross: Number((b as any).gross)||0 })
        const filled = keys.map((k) => map.get(k) || { month: k, net: 0, vat: 0, gross: 0 })
        setRows(filled)
      } catch {
        if (alive) setRows([])
      } finally { if (alive) setLoading(false) }
    })()
    const onChanged = () => {
      // refresh when data changes globally
      try { (window as any).api?.reports?.monthly?.({ from, to }).then((res: any) => {
        const buckets: Bucket[] = (res?.buckets || res || []) as Bucket[]
        const keys = monthKeys(from, to)
        const map = new Map<string, Bucket>()
        for (const b of buckets) map.set(String((b as any).month), { month: String((b as any).month), net: Number((b as any).net)||0, vat: Number((b as any).vat)||0, gross: Number((b as any).gross)||0 })
        const filled = keys.map((k) => map.get(k) || { month: k, net: 0, vat: 0, gross: 0 })
        setRows(filled)
      }) } catch { }
    }
    window.addEventListener('data-changed', onChanged)
    return () => { alive = false; window.removeEventListener('data-changed', onChanged) }
  }, [from, to])

  // Prepare values for chart: we use gross as signed monthly saldo (IN positive, OUT negative)
  const series = rows.map(r => Number(r.gross) || 0)
  const minV = Math.min(0, ...series)
  const maxV = Math.max(0, ...series)
  const range = Math.max(1, maxV - minV)
  const pad = range * 0.08
  const yMin = minV - pad
  const yMax = maxV + pad
  const labels = rows.map(r => r.month)

  // Build simple SVG line + filled area around zero for clarity
  const W = 760, H = 240, P = 36
  const xs = (i: number, n: number) => P + (i * (W - 2 * P)) / Math.max(1, n - 1)
  const ys = (v: number) => {
    const top = 16
    const bottom = H - 28
    return top + (yMax - v) * (bottom - top) / Math.max(1e-9, (yMax - yMin))
  }
  const points = series.map((v, i) => `${xs(i, series.length)},${ys(v)}`).join(' ')
  const areaPath = (() => {
    if (!series.length) return ''
    const top = series.map((v, i) => `${xs(i, series.length)},${ys(v)}`).join(' ')
    const baseline = (yMin <= 0 && yMax >= 0) ? 0 : (yMin > 0 ? yMin : yMax)
    const bottom = `${xs(series.length-1, series.length)},${ys(baseline)} ${xs(0, series.length)},${ys(baseline)}`
    return `M ${top} L ${bottom} Z`
  })()

  // X labels every k months to avoid clutter
  const tickEvery = Math.max(1, Math.ceil(labels.length / 6))

  // hover logic
  const onMouseMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || !labels.length) return
    const rect = svg.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const xsArr = labels.map((_m, i) => xs(i, labels.length))
    let best = 0
    let bestDist = Math.abs(x - xsArr[0])
    for (let i = 1; i < xsArr.length; i++) {
      const d = Math.abs(x - xsArr[i])
      if (d < bestDist) { bestDist = d; best = i }
    }
    setHoverIdx(best)
  }
  const onLeave = () => setHoverIdx(null)

  

  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Kassenstand (Saldo monatlich)</strong>
        <span className="helper">{from} → {to}</span>
      </header>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} onMouseMove={onMouseMove} onMouseLeave={onLeave} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Monatlicher Saldo">
          {/* Zero/baseline axis */}
          {(yMin <= 0 && yMax >= 0) && (<line x1={P/2} x2={W-P/2} y1={ys(0)} y2={ys(0)} stroke="var(--border)" strokeWidth={1} />)}
          {/* Area fill */}
          <path d={areaPath} fill="color-mix(in oklab, var(--accent) 22%, transparent)" />
          {/* Line */}
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2} />
          {/* Ticks and labels */}
          {labels.map((m, i) => {
            if (i % tickEvery !== 0 && i !== labels.length - 1) return null
            const x = xs(i, labels.length)
            const monIdx = Math.max(0, Math.min(11, Number(m.slice(5)) - 1))
            const mon = MONTH_NAMES[monIdx] || m.slice(5)
            return (
              <g key={m}>
                <line x1={x} x2={x} y1={H-18} y2={H-14} stroke="var(--border)" />
                <text x={x} y={H-4} fill="var(--text-dim)" fontSize={11} textAnchor="middle">{mon}</text>
              </g>
            )
          })}
          {/* Hover focus */}
          {hoverIdx != null && labels[hoverIdx] && (
            <g>
              <line x1={xs(hoverIdx, labels.length)} x2={xs(hoverIdx, labels.length)} y1={16} y2={H-28} stroke="var(--border)" strokeDasharray="3 4" />
              <circle cx={xs(hoverIdx, labels.length)} cy={ys(series[hoverIdx])} r={3} fill="var(--accent)" />
            </g>
          )}
        </svg>
        {hoverIdx != null && (
          <div style={{ position: 'absolute', left: `${(xs(hoverIdx, labels.length)/W)*100}%`, top: 8, transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', pointerEvents: 'none', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{MONTH_NAMES[Math.max(0, Math.min(11, Number(String(labels[hoverIdx]).slice(5)) - 1))] || String(labels[hoverIdx]).slice(5)}</div>
            <div style={{ fontWeight: 700 }}>{eur.format(series[hoverIdx] || 0)}</div>
          </div>
        )}
        {loading && <div className="helper" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>Laden…</div>}
      </div>
      <div className="helper" style={{ marginTop: 6 }}>Werte: IN positiv, OUT negativ. Grundlage: Brutto je Monat.</div>
    </section>
  )
}
