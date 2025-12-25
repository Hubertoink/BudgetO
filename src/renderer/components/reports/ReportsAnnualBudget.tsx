import React, { useEffect, useMemo, useState } from 'react'

interface BudgetData {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
}

export default function ReportsAnnualBudget({ year, refreshKey }: { year: number | null; refreshKey?: number }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BudgetData | null>(null)
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  useEffect(() => {
    if (!year) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(window as any).api?.annualBudgets?.usage?.({ year })
      .then((res: BudgetData | null) => {
        if (!cancelled) setData(res)
      })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [year, refreshKey])

  if (!year) return null
  if (loading) {
    return (
      <div className="card" style={{ marginTop: 12, padding: 16 }}>
        <div style={{ color: 'var(--text-dim)' }}>Lade Jahresbudget…</div>
      </div>
    )
  }
  if (!data) return null

  const percentUsed = data.percentage
  const isOverBudget = data.remaining < 0
  const remainingColor = isOverBudget ? 'var(--danger)' : 'var(--success)'

  return (
    <div className="card annual-budget-card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
      {/* Header with gradient */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <strong style={{ fontSize: 15 }}>Jahresbudget {year}</strong>
              <div className="helper" style={{ marginTop: 2 }}>Budgetauslastung für das Kalenderjahr</div>
            </div>
          </div>
          <div style={{
            background: isOverBudget ? 'rgba(198, 40, 40, 0.2)' : 'rgba(46, 125, 50, 0.2)',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: remainingColor
          }}>
            {percentUsed.toFixed(1)}% genutzt
          </div>
        </div>
      </div>

      {/* Budget flow visualization */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {/* Ausgangsstand */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16, opacity: 0.8 }}>🎯</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ausgangsstand</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {eurFmt.format(data.budgeted)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Geplantes Budget</div>
          </div>

          {/* Einnahmen */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.08) 0%, rgba(46, 125, 50, 0.03) 100%)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(46, 125, 50, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>📈</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zugänge</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2e7d32' }}>
              +{eurFmt.format(data.income)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Einnahmen {year}</div>
          </div>

          {/* Ausgaben */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(198, 40, 40, 0.08) 0%, rgba(198, 40, 40, 0.03) 100%)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(198, 40, 40, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>📉</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abgänge</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#c62828' }}>
              -{eurFmt.format(data.spent)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Ausgaben {year}</div>
          </div>

          {/* Restbudget - hervorgehoben */}
          <div style={{
            background: isOverBudget
              ? 'linear-gradient(135deg, rgba(198, 40, 40, 0.15) 0%, rgba(198, 40, 40, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(46, 125, 50, 0.15) 0%, rgba(46, 125, 50, 0.08) 100%)',
            borderRadius: 12,
            padding: 16,
            border: isOverBudget ? '2px solid rgba(198, 40, 40, 0.4)' : '2px solid rgba(46, 125, 50, 0.4)',
            boxShadow: isOverBudget
              ? '0 4px 20px rgba(198, 40, 40, 0.15)'
              : '0 4px 20px rgba(46, 125, 50, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>💰</span>
              <span style={{ fontSize: 12, color: remainingColor, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Restbudget</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: remainingColor }}>
              {eurFmt.format(data.remaining)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              {isOverBudget ? 'Überschreitung!' : 'Verfügbar'}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            height: 8,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min(100, percentUsed)}%`,
              background: isOverBudget
                ? 'linear-gradient(90deg, #c62828, #ef5350)'
                : percentUsed > 80
                  ? 'linear-gradient(90deg, #f9a825, #ffca28)'
                  : 'linear-gradient(90deg, #2e7d32, #66bb6a)',
              borderRadius: 4,
              transition: 'width 0.5s ease-out'
            }} />
            {percentUsed > 100 && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(30, percentUsed - 100)}%`,
                background: 'repeating-linear-gradient(45deg, #c62828, #c62828 4px, #ef5350 4px, #ef5350 8px)',
                borderRadius: '0 4px 4px 0'
              }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>0%</span>
            <span style={{ color: percentUsed > 80 ? (isOverBudget ? '#ef5350' : '#ffca28') : 'var(--text-dim)' }}>
              {data.budgeted > 0 ? `${eurFmt.format(data.spent - data.income)} von ${eurFmt.format(data.budgeted)} verbraucht` : 'Kein Budget definiert'}
            </span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
