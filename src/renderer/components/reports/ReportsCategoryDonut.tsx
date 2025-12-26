import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PaymentMethod, VoucherType } from './types'

type Row = { categoryId: number | null; categoryName: string; categoryColor: string | null; gross: number }

export default function ReportsCategoryDonut(props: { refreshKey?: number; from?: string; to?: string; type?: VoucherType; paymentMethod?: PaymentMethod }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const svgWrapRef = useRef<HTMLDivElement | null>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const p = (window as any).api?.reports?.byCategory?.({
      from: props.from,
      to: props.to,
      type: props.type,
      paymentMethod: props.paymentMethod
    })
    if (!p || typeof p.then !== 'function') {
      if (!cancelled) {
        setRows([])
        setError('Reports-API nicht verfügbar (bitte App neu starten).')
        setLoading(false)
      }
      return () => { cancelled = true }
    }
    p.then((res: any) => {
      if (cancelled || !res) return
      const r: Row[] = Array.isArray(res.rows) ? res.rows : []
      setRows(r)
    })
      .catch((e: any) => {
        if (cancelled) return
        setRows([])
        setError(String(e?.message || e || 'Fehler beim Laden der Kategorien.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [props.from, props.to, props.type, props.paymentMethod, props.refreshKey])

  const total = rows.reduce((a, b) => a + Math.abs(Number(b.gross) || 0), 0) || 1
  const size = { w: 360, h: 220 }
  const cx = 120
  const cy = 110
  const outerR = 90
  const innerR = 52

  const colors = (r: Row, idx: number): string => {
    if (r.categoryColor) return r.categoryColor
    const palette = ['#42a5f5', '#26a69a', '#ab47bc', '#ffa726', '#66bb6a', '#ef5350', '#8d6e63', '#7e57c2']
    return palette[idx % palette.length]
  }

  let angleAcc = -Math.PI / 2
  const arcs = rows
    .filter(r => (Number(r.gross) || 0) !== 0)
    .slice(0, 10)
    .map((r, idx) => {
      const gross = Number(r.gross) || 0
      const frac = Math.abs(gross) / total
      const angle = frac * Math.PI * 2
      const start = angleAcc
      const end = angleAcc + angle
      angleAcc = end
      return { row: r, idx, gross, frac, start, end }
    })

  return (
    <div className="card report-chart-card">
      <div className="report-chart-header report-chart-header--category">
        <strong>Nach Kategorie</strong>
        <div className="legend-container legend-container--category">
          <div className="legend legend--category">
            {arcs.map(a => (
              <span key={`${a.row.categoryId ?? 'NULL'}-${a.idx}`} className="legend-item">
                <span className="legend-swatch" style={{ background: colors(a.row, a.idx) }}></span>
                <span className="legend-label" title={a.row.categoryName}>{a.row.categoryName}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {loading && <div>Lade …</div>}
      {!loading && error && (
        <div className="helper">{error}</div>
      )}
      {!loading && (
        <div className="donut-chart-wrapper">
          <div ref={svgWrapRef} className="donut-svg-container">
            {(() => {
              const idx = hoverIdx
              if (idx == null || !arcs[idx] || !tooltipPos) return null
              const a = arcs[idx]
              const pct = Math.round(a.frac * 100)
              const c = colors(a.row, a.idx)
              return (
                <div className="chart-tooltip chart-tooltip-follow" style={{ left: tooltipPos.left, top: tooltipPos.top }}>
                  <div className="chart-tooltip-header">{a.row.categoryName}</div>
                  <div className="chart-tooltip-row"><span>Betrag</span> <strong style={{ color: c }}>{eurFmt.format(a.gross)}</strong></div>
                  <div className="chart-tooltip-row"><span>Anteil</span> <strong>{pct}%</strong></div>
                </div>
              )
            })()}
            <svg ref={svgRef} width={size.w} height={size.h} role="img" aria-label="Nach Kategorie">
              {arcs.map((a, arcIdx) => {
              const isSingle100 = arcs.length === 1 && Math.abs(a.frac - 1) < 0.0001
              const c = colors(a.row, a.idx)

              const updateTooltipFromEvent = (ev: React.MouseEvent<SVGGElement>) => {
                const wrap = svgWrapRef.current
                if (!wrap) return
                const rect = wrap.getBoundingClientRect()
                const x = ev.clientX - rect.left
                const y = ev.clientY - rect.top
                // Place tooltip next to cursor and clamp within container.
                // (Tooltip is not centered anymore, so long labels won't clip on the left edge.)
                const pad = 12
                const tooltipW = 320
                const leftWanted = x + 12
                const maxLeft = Math.max(pad, rect.width - pad - tooltipW)
                const left = Math.min(Math.max(leftWanted, pad), maxLeft)
                const top = Math.min(Math.max(y, pad), rect.height - pad)
                setTooltipPos({ left, top })
              }

              if (isSingle100) {
                const outerCircle = `M ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy} Z`
                const innerCircle = `M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`
                return (
                  <g
                    key={arcIdx}
                    onMouseEnter={(ev) => { setHoverIdx(arcIdx); updateTooltipFromEvent(ev) }}
                    onMouseMove={updateTooltipFromEvent}
                    onMouseLeave={() => { setHoverIdx(null); setTooltipPos(null) }}
                  >
                    <path d={outerCircle} fill={c} />
                    <path d={innerCircle} fill="var(--bg)" />
                    <text x={cx} y={cy} textAnchor="middle" fontSize="11" fill="#fff">100%</text>
                  </g>
                )
              }

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
                <g
                  key={arcIdx}
                  onMouseEnter={(ev) => { setHoverIdx(arcIdx); updateTooltipFromEvent(ev) }}
                  onMouseMove={updateTooltipFromEvent}
                  onMouseLeave={() => { setHoverIdx(null); setTooltipPos(null) }}
                >
                  <path d={d} fill={c} />
                  {pct >= 7 && (
                    <text x={lx} y={ly} textAnchor="middle" fontSize="11" fill="#fff">{`${pct}%`}</text>
                  )}
                </g>
              )
              })}
            </svg>
          </div>
          <div>
            <div className="helper">Summe (Brutto)</div>
            <div>{eurFmt.format(rows.reduce((a, b) => a + (Number(b.gross) || 0), 0))}</div>
          </div>
        </div>
      )}
    </div>
  )
}
