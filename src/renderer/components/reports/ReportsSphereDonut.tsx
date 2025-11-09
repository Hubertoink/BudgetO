import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Sphere } from './types'

export default function ReportsSphereDonut(props: { refreshKey?: number; from?: string; to?: string }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Array<{ key: Sphere; gross: number }>>([])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
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
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', position: 'relative' }}>
          {(() => {
            const idx = hoverIdx
            if (idx == null || !arcs[idx]) return null
            const a = arcs[idx]
            const pct = Math.round(a.frac * 100)
            return (
              <div style={{ position: 'absolute', top: 6, left: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', pointerEvents: 'none', boxShadow: 'var(--shadow-1)', fontSize: 12, zIndex: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.key}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Betrag</span> <strong style={{ color: colors[a.key] }}>{eurFmt.format(a.gross)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Anteil</span> <strong>{pct}%</strong></div>
              </div>
            )
          })()}
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
                <g key={idx} onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(null)}>
                  <path d={d} fill={colors[a.key]} />
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
