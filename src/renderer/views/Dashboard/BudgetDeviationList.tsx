import React, { useEffect, useMemo, useState } from 'react'
import type { BudgetDeviationListProps } from './types'

type Slice = { key: 'IDEELL'|'ZWECK'|'VERMOEGEN'|'WGB'; value: number }

// Transform the former list into a donut showing totals by sphere (saldo IN-OUT, absolute shares).
export default function BudgetDeviationList({ from, to }: BudgetDeviationListProps) {
  const [data, setData] = useState<Slice[]>([])
  const [loading, setLoading] = useState(false)
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        setLoading(true)
        // Use reports.summary (without sphere filter) to aggregate by sphere for the selected period
        const s = await (window as any).api?.reports?.summary?.({ from, to })
        const arr = (s?.bySphere || []) as Array<{ key: Slice['key']; gross: number }>
        const slices: Slice[] = arr.map((r) => ({ key: r.key, value: Math.abs(Number(r.gross) || 0) }))
        if (alive) setData(slices)
      } catch { if (alive) setData([]) } finally { if (alive) setLoading(false) }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [from, to])

  const total = Math.max(0, data.reduce((a, b) => a + (b.value || 0), 0))
  const colors: Record<Slice['key'], string> = {
    IDEELL: 'var(--accent)',
    ZWECK: '#4CC38A',
    VERMOEGEN: '#F5C451',
    WGB: '#9C27B0'
  }

  const size = 160
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 6
  const r = R * 0.64
  let a0 = -Math.PI / 2
  const single = data.filter(s => (s.value || 0) > 0).length === 1
  const paths = data.map((s, idx) => {
    const frac = total > 0 ? (s.value / total) : 0
    if (single && frac > 0.9999) {
      // Render a full ring using stroke for the single-slice case to avoid degenerate 360° arc
      return <circle key={s.key + idx} cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={colors[s.key]} strokeWidth={R - r} />
    }
    const a1 = a0 + frac * Math.PI * 2
    const d = arcPath(cx, cy, R, r, a0, a1)
    const el = <path key={s.key + idx} d={d} fill={colors[s.key]} opacity={frac > 0 ? 1 : 0} />
    a0 = a1
    return el
  })

  // center label: Gesamt (Saldo absoluter Anteile)
  const centerValue = eur.format(total)

  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Sphären‑Anteile</strong>
        <span className="helper">{from} → {to}</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Anteile nach Sphäre">
          {/* background ring */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--muted)" strokeWidth={R - r} />
          {paths}
          {/* center label */}
          <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text)" fontWeight={700} fontSize={14}>{centerValue}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-dim)" fontSize={11}>Summe (|IN|+|OUT|)</text>
        </svg>
        <div style={{ display: 'grid', gap: 6 }}>
          {data.map((s) => (
            <div key={s.key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[s.key] }} />
              <div style={{ color: 'var(--text)' }}>{labelSphere(s.key)}</div>
              <div style={{ justifySelf: 'end', fontVariantNumeric: 'tabular-nums' }}>{eur.format(s.value)}</div>
            </div>
          ))}
          {(!data.length && !loading) && <div className="helper">Keine Daten im Zeitraum.</div>}
        </div>
      </div>
    </section>
  )
}

function labelSphere(k: Slice['key']): string {
  return k === 'IDEELL' ? 'IDEELL' : k === 'ZWECK' ? 'ZWECK' : k === 'VERMOEGEN' ? 'VERMÖGEN' : 'WGB'
}

function arcPath(cx: number, cy: number, R: number, r: number, a0: number, a1: number): string {
  const toXY = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)] as const
  const [x1, y1] = toXY(a0, R)
  const [x2, y2] = toXY(a1, R)
  const [x3, y3] = toXY(a1, r)
  const [x4, y4] = toXY(a0, r)
  const large = (a1 - a0) > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`
}
