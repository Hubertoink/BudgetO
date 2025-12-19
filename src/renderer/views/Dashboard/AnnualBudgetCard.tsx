import React, { useEffect, useState } from 'react'

interface AnnualBudgetUsage {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export default function AnnualBudgetCard({ year }: { year: number }) {
  const [usage, setUsage] = useState<AnnualBudgetUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await (window as any).api?.annualBudgets?.usage?.({ year, costCenterId: null })
        if (!cancelled) setUsage(res || null)
      } catch (e) {
        console.error('Error loading annual budget usage:', e)
        if (!cancelled) setUsage(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
  }, [year])

  if (loading) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="helper">Jahresbudget {year}</div>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="helper">Lädt…</span>
        </div>
      </div>
    )
  }

  if (!usage || usage.budgeted === 0) {
    return null // Don't show if no budget defined
  }

  const { budgeted, spent, income, remaining, percentage } = usage
  const isOverBudget = remaining < 0
  const isNearBudget = percentage >= 80 && percentage < 100

  return (
    <div className="card card--accent" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <strong>💰 Jahresbudget {year}</strong>
        </div>
        <div 
          style={{ 
            fontSize: 13, 
            fontWeight: 600,
            color: isOverBudget ? 'var(--danger)' : isNearBudget ? 'var(--warning)' : 'var(--success)'
          }}
        >
          {percentage.toFixed(1)}% ausgeschöpft
        </div>
      </div>

      {/* Progress Bar */}
      <div 
        style={{ 
          height: 16, 
          background: 'var(--border)', 
          borderRadius: 8, 
          overflow: 'hidden',
          marginBottom: 16
        }}
      >
        <div 
          style={{ 
            height: '100%', 
            width: `${Math.min(100, percentage)}%`,
            background: isOverBudget ? 'var(--danger)' : isNearBudget ? 'var(--warning)' : 'var(--success)',
            transition: 'width 0.3s ease',
            borderRadius: 8
          }} 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
        <div>
          <div className="helper" style={{ marginBottom: 4 }}>Budgetiert</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{eurFmt.format(budgeted)}</div>
        </div>
        <div>
          <div className="helper" style={{ marginBottom: 4 }}>Ausgaben</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--danger)' }}>{eurFmt.format(spent)}</div>
        </div>
        <div>
          <div className="helper" style={{ marginBottom: 4 }}>Verbleibend</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: isOverBudget ? 'var(--danger)' : 'var(--success)' }}>
            {eurFmt.format(remaining)}
          </div>
        </div>
      </div>

      {/* Optional: Show income separately */}
      {income > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="helper">Einnahmen (nicht gegen Budget gerechnet)</span>
            <span style={{ color: 'var(--success)', fontWeight: 500 }}>{eurFmt.format(income)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
