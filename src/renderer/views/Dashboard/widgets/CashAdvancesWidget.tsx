import React, { useEffect, useMemo, useState } from 'react'

type CashAdvanceStats = {
  totalOpen: number
  totalResolved: number
  totalOverdue: number
  openAmount: number
  overdueAmount: number
}

export default function CashAdvancesWidget() {
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CashAdvanceStats | null>(null)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        setLoading(true)
        const res = await (window as any).api?.cashAdvances?.stats?.()
        if (!alive) return
        setStats((res || null) as CashAdvanceStats | null)
      } catch {
        if (!alive) return
        setStats(null)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => {
      alive = false
      window.removeEventListener('data-changed', onChanged)
    }
  }, [])

  const hasAny = !!stats && (stats.totalOpen + stats.totalOverdue + stats.totalResolved) > 0

  return (
    <section className="card" style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <strong>Barvorschüsse</strong>
      </header>

      {loading ? (
        <div className="helper" style={{ marginTop: 8 }}>Lädt…</div>
      ) : !hasAny ? (
        <div className="helper" style={{ marginTop: 8 }}>Keine Barvorschüsse vorhanden.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="helper">Offen</div>
            <div className="summary-value-overflow">{stats?.totalOpen || 0}</div>
            <div className="helper" style={{ marginTop: 6 }}>{eur.format(stats?.openAmount || 0)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="helper">Überfällig</div>
            <div className="summary-value-overflow" style={{ color: 'var(--danger)' }}>{stats?.totalOverdue || 0}</div>
            <div className="helper" style={{ marginTop: 6 }}>{eur.format(stats?.overdueAmount || 0)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="helper">Abgeschlossen</div>
            <div className="summary-value-overflow">{stats?.totalResolved || 0}</div>
          </div>
        </div>
      )}
    </section>
  )
}
