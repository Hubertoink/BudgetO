import React, { useCallback, useEffect, useMemo, useState } from 'react'

interface BudgetUsage {
  cadence: 'ANNUAL' | 'MONTHLY'
  year: number
  month: number | null
  budgeted: number
  baseBudgeted?: number
  carryover?: number
  spent: number
  income: number
  remaining: number
  percentage: number
  configuredPeriods?: number
  projectedIncome?: number
  projectedSpent?: number
  projectedRemaining?: number
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export default function AnnualBudgetCard({ year, month, period }: { year: number; month?: number | null; period: 'MONAT' | 'JAHR' }) {
  const [usage, setUsage] = useState<BudgetUsage | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const config = await window.api?.budgetPeriods?.config?.get?.()
      if (period === 'MONAT' && config?.cadence === 'MONTHLY') {
        const [usageRes, budget] = await Promise.all([
          window.api?.budgetPeriods?.usage?.({ cadence: 'MONTHLY', year, month: month || 1 }),
          window.api?.budgetPeriods?.get?.({ cadence: 'MONTHLY', year, month: month || 1 })
        ])
        setUsage(usageRes || null)
        setDescription(budget?.description || null)
      } else {
        const usageRes = await window.api?.budgetPeriods?.yearUsage?.({ year })
        setUsage(usageRes || null)
        if (usageRes?.cadence === 'ANNUAL') {
          const budget = await window.api?.budgetPeriods?.get?.({ cadence: 'ANNUAL', year })
          setDescription(budget?.description || null)
        } else setDescription(null)
      }
    } catch (error) {
      console.error('Error loading budget period:', error)
      setUsage(null)
      setDescription(null)
    } finally { setLoading(false) }
  }, [year, month, period])

  useEffect(() => {
    void refresh()
    const onChanged = () => void refresh()
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [refresh])

  const label = useMemo(() => {
    if (period === 'MONAT' && usage?.cadence === 'MONTHLY') {
      const value = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, (month || 1) - 1, 1)))
      return `Monatsbudget ${value.charAt(0).toUpperCase() + value.slice(1)}`
    }
    return usage?.cadence === 'MONTHLY' ? `Monatsbudgets ${year}` : `Jahresbudget ${year}`
  }, [period, year, month, usage?.cadence])

  const budgeted = usage?.budgeted ?? 0
  const remaining = usage?.remaining ?? 0
  const percentage = usage?.percentage ?? 0
  const isOverBudget = remaining < 0
  const isNearBudget = percentage >= 80 && !isOverBudget

  return (
    <div className="card card--accent" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div><strong>💰 {label}</strong>{description ? <div className="helper" style={{ marginTop: 4 }}>{description}</div> : null}</div>
        {usage?.cadence === 'MONTHLY' && period === 'JAHR' ? <span className="badge">{usage.configuredPeriods || 0}/12 Monate</span> : null}
      </div>
      {loading ? <div className="helper" style={{ padding: 12 }}>Lädt…</div> : budgeted === 0 ? (
        <div style={{ padding: 12 }}><div className="helper" style={{ marginBottom: 6 }}>Für diesen Zeitraum ist noch kein Budget hinterlegt.</div><div style={{ fontWeight: 600 }}>Lege es unter Einstellungen → Sachgebiet an.</div></div>
      ) : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span className="helper">Startbudget</span><strong style={{ color: isOverBudget ? 'var(--danger)' : isNearBudget ? 'var(--warning)' : 'var(--success)' }}>{percentage.toFixed(1)}% ausgeschöpft</strong></div>
        <div style={{ height: 14, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}><div style={{ height: '100%', width: `${Math.min(100, Math.max(0, percentage))}%`, background: isOverBudget ? 'var(--danger)' : isNearBudget ? 'var(--warning)' : 'var(--success)' }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
          <div><div className="helper">{usage?.carryover ? 'Effektives Startbudget' : 'Startbudget'}</div><strong>{eurFmt.format(budgeted)}</strong>{usage?.carryover ? <div className="helper">inkl. {usage.carryover > 0 ? '+' : '−'}{eurFmt.format(Math.abs(usage.carryover))} Übertrag</div> : null}</div>
          <div><div className="helper">Einnahmen</div><strong style={{ color: 'var(--success)' }}>{eurFmt.format(usage?.income || 0)}</strong></div>
          <div><div className="helper">Ausgaben</div><strong style={{ color: 'var(--danger)' }}>{eurFmt.format(usage?.spent || 0)}</strong></div>
          <div><div className="helper">Verbleibend</div><strong style={{ color: isOverBudget ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(remaining)}</strong></div>
        </div>
        {(((usage?.projectedIncome || 0) > 0) || ((usage?.projectedSpent || 0) > 0)) && <div className="budget-forecast"><span>↻ Geplante Wiederholungen: <strong style={{ color: 'var(--success)' }}>+{eurFmt.format(usage?.projectedIncome || 0)}</strong> / <strong style={{ color: 'var(--danger)' }}>−{eurFmt.format(usage?.projectedSpent || 0)}</strong></span><span>Voraussichtlich <strong>{eurFmt.format(usage?.projectedRemaining ?? remaining)}</strong></span></div>}
      </>}
    </div>
  )
}
