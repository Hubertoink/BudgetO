import React, { useMemo } from 'react'
import AnnualBudgetCard from '../AnnualBudgetCard'

export default function BudgetOverviewWidget(props: {
  year: number
  periodLabel: string
  income: number
  expenses: number
  saldo: number
}) {
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <AnnualBudgetCard year={props.year} />

      <div className="dashboard-grid-auto">
        <div className="card card--success summary-card">
          <div className="helper">Einnahmen ({props.periodLabel})</div>
          <div className="summary-value">{eur.format(props.income || 0)}</div>
        </div>
        <div className="card card--danger summary-card">
          <div className="helper">Ausgaben ({props.periodLabel})</div>
          <div className="summary-value">{eur.format(props.expenses || 0)}</div>
        </div>
        <div className="card card--accent summary-card">
          <div className="helper">Saldo ({props.periodLabel})</div>
          <div
            className="summary-value"
            style={{ color: props.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {eur.format(props.saldo || 0)}
          </div>
        </div>
      </div>
    </div>
  )
}
