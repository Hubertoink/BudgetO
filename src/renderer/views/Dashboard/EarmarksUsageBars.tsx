import React, { useEffect, useMemo, useState } from 'react'
import type { EarmarksUsageBarsProps } from './types'

type Row = { id: number; name: string; pct: number }

export default function EarmarksUsageBars({ limit = 6, from, to, sphere }: EarmarksUsageBarsProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const fmtPct = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 }), [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        setLoading(true)
        const list = await (window as any).api?.bindings?.list?.({ activeOnly: true })
        const earmarks = (list?.rows || list || []) as Array<{ id: number; name: string; code?: string; budget?: number|null }>
        const withUsage: Row[] = []
        for (const e of earmarks) {
          const u = await (window as any).api?.bindings?.usage?.({ earmarkId: e.id, from, to, sphere })
          const allocated = Number(u?.allocated || 0)
          const released = Number(u?.released || 0)
          const budget = Number(e?.budget || u?.budget || 0)
          const available = Math.max(0.01, budget + allocated)
          const pct = Math.max(0, Math.min(1, released / available))
          withUsage.push({ id: e.id, name: e.name || String(e.code || e.id), pct })
        }
        withUsage.sort((a, b) => b.pct - a.pct)
        if (alive) setRows(withUsage.slice(0, limit))
      } catch { if (alive) setRows([]) } finally { if (alive) setLoading(false) }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [from, to, sphere, limit])

  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Zweckbindungen – Verwendung</strong>
        <span className="helper">Top {limit}</span>
      </header>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0 && !loading && <div className="helper">Keine aktiven Zweckbindungen im Zeitraum.</div>}
        {rows.map((r) => {
          const pct100 = Math.round(r.pct * 100)
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
              <div className="helper">{pct100}%</div>
              <div style={{ gridColumn: '1 / -1', height: 8, borderRadius: 6, background: 'var(--muted)', overflow: 'hidden' }}>
                <div style={{ width: pct100 + '%', height: '100%', background: pct100 > 100 ? 'var(--danger)' : 'var(--accent)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
