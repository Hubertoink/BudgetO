import React, { useEffect, useState } from 'react'
import type { WorkQueueCardProps } from './types'

export default function WorkQueueCard(_props: WorkQueueCardProps) {
  const [unlinked, setUnlinked] = useState<number>(0)
  const [locked, setLocked] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await (window as any).api?.workQueue?.summary?.()
      if (res?.ok) { setUnlinked(Number(res.unlinkedReceiptsCount||0)); setLocked(Number(res.lockedEntriesCount||0)) }
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => {
    let alive = true
    ;(async () => { if (alive) await load() })()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => { alive = false; window.removeEventListener('data-changed', onChanged) }
  }, [])

  const rows = [
    { label: 'Buchungen ohne Datei', value: unlinked },
    { label: 'Gesperrte Buchungen', value: locked },
  ]
  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Offene Aufgaben</strong>
        <span className="helper">Schnelle Übersicht</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} className="card" style={{ padding: 10, textAlign: 'center' }}>
            <div className="helper" style={{ marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{loading ? '…' : r.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
