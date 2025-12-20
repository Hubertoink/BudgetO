import React, { useEffect, useState, useCallback } from 'react'
import { useToast } from '../../context/ToastContext'

interface AnnualBudgetUsage {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export default function AnnualBudgetCard({ year }: { year: number }) {
  const { notify } = useToast()

  const [usage, setUsage] = useState<AnnualBudgetUsage | null>(null)
  const [budgetInfo, setBudgetInfo] = useState<{ amount: number; description: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [descInput, setDescInput] = useState('')

  const refresh = useCallback(async (opts?: { keepInputs?: boolean }) => {
    try {
      setLoading(true)
      const [budget, usageRes] = await Promise.all([
        (window as any).api?.annualBudgets?.get?.({ year, costCenterId: null }),
        (window as any).api?.annualBudgets?.usage?.({ year, costCenterId: null })
      ])

      setBudgetInfo(budget ? { amount: Number(budget.amount) || 0, description: budget.description || null } : null)
      setUsage(usageRes || null)

      if (!opts?.keepInputs) {
        const amt = budget ? String(budget.amount ?? '') : usageRes ? String(usageRes.budgeted ?? '') : ''
        setAmountInput(amt)
        setDescInput(budget?.description || '')
      }
    } catch (e) {
      console.error('Error loading annual budget:', e)
      setBudgetInfo(null)
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    refresh()
    const onChanged = () => refresh({ keepInputs: editing })
    window.addEventListener('data-changed', onChanged)
    return () => window.removeEventListener('data-changed', onChanged)
  }, [refresh, editing])

  const save = async () => {
    const amount = parseFloat(amountInput.replace(',', '.')) || 0
    setSaving(true)
    try {
      await (window as any).api?.annualBudgets?.upsert?.({
        year,
        amount,
        costCenterId: null,
        description: descInput.trim() || null
      })
      notify('success', `Jahresbudget ${year} gespeichert`)
      setEditing(false)
      await refresh()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const budgeted = usage?.budgeted ?? budgetInfo?.amount ?? 0
  const spent = usage?.spent ?? 0
  const income = usage?.income ?? 0
  const remaining = usage?.remaining ?? (budgeted - Math.max(0, spent - income))
  const percentage = usage?.percentage ?? (budgeted > 0 ? Math.min(200, Math.max(0, ((spent - income) / budgeted) * 100)) : 0)

  const isOverBudget = remaining < 0
  const isNearBudget = percentage >= 80 && percentage < 100
  const showEmpty = !loading && budgeted === 0 && !editing

  return (
    <div className="card card--accent" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div>
          <strong>💰 Jahresbudget {year}</strong>
          {budgetInfo?.description ? (
            <div className="helper" style={{ marginTop: 4 }}>{budgetInfo.description}</div>
          ) : null}
        </div>
        {!editing ? (
          <button className="btn ghost" onClick={() => { setEditing(true); setAmountInput(budgeted ? String(budgeted) : ''); setDescInput(budgetInfo?.description || '') }}>
            {showEmpty ? 'Budget erfassen' : 'Bearbeiten'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => { setEditing(false); refresh() }} disabled={saving}>Abbrechen</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="helper">Lädt…</span>
        </div>
      ) : editing ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label htmlFor={`annual-budget-${year}`}>Budget (€)</label>
            <input
              id={`annual-budget-${year}`}
              className="input"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="z.B. 25000"
            />
          </div>
          <div className="field">
            <label htmlFor={`annual-budget-desc-${year}`}>Notiz</label>
            <input
              id={`annual-budget-desc-${year}`}
              className="input"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="Optionaler Hinweis zum Budget"
            />
          </div>
        </div>
      ) : showEmpty ? (
        <div style={{ padding: 12 }}>
          <div className="helper" style={{ marginBottom: 6 }}>Noch kein Jahresbudget hinterlegt.</div>
          <div style={{ fontWeight: 600 }}>Leg ein Budget an, um den Fortschritt zu verfolgen.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="helper">Geplant</div>
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

          {income > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="helper">Einnahmen (nicht gegen Budget gerechnet)</span>
                <span style={{ color: 'var(--success)', fontWeight: 500 }}>{eurFmt.format(income)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
