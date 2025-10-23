import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { IncomeExpenseBarsProps } from './types'

type Bucket = { month: string; gross: number }

export default function IncomeExpenseBars({ from, to }: IncomeExpenseBarsProps) {
  const [rowsIn, setRowsIn] = useState<Bucket[]>([])
  const [rowsOut, setRowsOut] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(false)
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const monthKeys = (f: string, t: string) => {
      const out: string[] = []
      const [y0, m0] = [Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1]
      const [y1, m1] = [Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1]
      const d = new Date(Date.UTC(y0, m0, 1))
      while (d.getUTCFullYear() < y1 || (d.getUTCFullYear() === y1 && d.getUTCMonth() <= m1)) {
        out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
        d.setUTCMonth(d.getUTCMonth() + 1)
      }
      return out
    }
    const fill = (buckets: Bucket[], keys: string[]) => {
      const map = new Map(buckets.map(b => [String(b.month), b]))
      return keys.map(k => map.get(k) || { month: k, gross: 0 })
    }
    const load = async () => {
      try {
        setLoading(true)
        const [rin, rout] = await Promise.all([
          (window as any).api?.reports?.monthly?.({ from, to, type: 'IN' }),
          (window as any).api?.reports?.monthly?.({ from, to, type: 'OUT' }),
        ])
        const keys = monthKeys(from, to)
        const ins = fill(((rin?.buckets || rin || []) as Bucket[]).map(b => ({ month: String((b as any).month), gross: Number((b as any).gross)||0 })), keys)
        const outs = fill(((rout?.buckets || rout || []) as Bucket[]).map(b => ({ month: String((b as any).month), gross: Math.abs(Number((b as any).gross)||0) })), keys)
        if (!alive) return
        setRowsIn(ins)
        setRowsOut(outs)
      } catch {
        if (alive) { setRowsIn([]); setRowsOut([]) }
      } finally { if (alive) setLoading(false) }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => { alive = false; window.removeEventListener('data-changed', onChanged) }
  }, [from, to])

  const labels = rowsIn.map(r => r.month)
  const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
  const maxVal = Math.max(1,
    ...rowsIn.map(r => r.gross),
    ...rowsOut.map(r => r.gross)
  )

  const W = 760, H = 220, P = 40
  const xs = (i: number, n: number) => P + (i * (W - 2 * P)) / Math.max(1, n - 1)
  const baseY = H - 28
  const maxH = baseY - 16
  const barW = 10
  const gap = 6

  const mouseMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || !labels.length) return
    const rect = svg.getBoundingClientRect()
    const x = ev.clientX - rect.left
    let best = 0
    let bestDist = Math.abs(x - xs(0, labels.length))
    for (let i = 1; i < labels.length; i++) {
      const d = Math.abs(x - xs(i, labels.length))
      if (d < bestDist) { best = i; bestDist = d }
    }
    setHoverIdx(best)
  }

  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Einnahmen vs. Ausgaben</strong>
        <span className="helper">{from} → {to}</span>
      </header>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} onMouseMove={mouseMove} onMouseLeave={() => setHoverIdx(null)} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Einnahmen vs Ausgaben">
          {/* Axis */}
          <line x1={P/2} x2={W-P/2} y1={baseY} y2={baseY} stroke="var(--border)" />
          {/* Bars */}
          {labels.map((m, i) => {
            const xCenter = xs(i, labels.length)
            const hIn = Math.round((rowsIn[i]?.gross || 0) / maxVal * maxH)
            const hOut = Math.round((rowsOut[i]?.gross || 0) / maxVal * maxH)
            return (
              <g key={m}>
                {/* IN bar */}
                <rect x={xCenter - barW - gap/2} y={baseY - hIn} width={barW} height={hIn} fill="var(--success)" rx={2} />
                {/* OUT bar */}
                <rect x={xCenter + gap/2} y={baseY - hOut} width={barW} height={hOut} fill="var(--danger)" rx={2} />
              </g>
            )
          })}
          {/* X labels */}
          {labels.map((m, i) => {
            if (labels.length > 8 && i % Math.ceil(labels.length/8) !== 0 && i !== labels.length - 1) return null
            const x = xs(i, labels.length)
            const mon = monthNames[Math.max(0, Math.min(11, Number(m.slice(5)) - 1))] || m.slice(5)
            return <text key={m} x={x} y={H-6} fill="var(--text-dim)" fontSize={11} textAnchor="middle">{mon}</text>
          })}
          {/* Hover guide */}
          {hoverIdx != null && labels[hoverIdx] && (
            <g>
              <line x1={xs(hoverIdx, labels.length)} x2={xs(hoverIdx, labels.length)} y1={16} y2={H-28} stroke="var(--border)" strokeDasharray="3 4" />
            </g>
          )}
        </svg>
        {hoverIdx != null && (
          <div style={{ position: 'absolute', left: `${(xs(hoverIdx, labels.length)/W)*100}%`, top: 8, transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', pointerEvents: 'none', boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{monthNames[Math.max(0, Math.min(11, Number(String(labels[hoverIdx]).slice(5)) - 1))] || String(labels[hoverIdx]).slice(5)}</div>
            <div><span className="helper">Einnahmen</span> <strong>{eur.format(rowsIn[hoverIdx]?.gross || 0)}</strong></div>
            <div><span className="helper">Ausgaben</span> <strong>{eur.format(rowsOut[hoverIdx]?.gross || 0)}</strong></div>
          </div>
        )}
        {loading && <div className="helper" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>Laden…</div>}
      </div>
    </section>
  )
}
