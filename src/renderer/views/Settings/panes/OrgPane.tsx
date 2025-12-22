import React from 'react'
import { OrgPaneProps } from '../types'

interface ActiveOrg {
  id: string
  name: string
  dbRoot: string
}

interface AnnualBudgetUsage {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

/**
 * OrgPane - Organization Settings
 * 
 * Handles:
 * - Organization name (for active organization in switcher)
 * - Tax Exemption Certificate (Steuerbefreiungsbescheid)
 * - Annual Budget (Jahresbudget)
 */
export function OrgPane({ notify }: OrgPaneProps) {
  // Active organization (for the switcher)
  const [activeOrg, setActiveOrg] = React.useState<ActiveOrg | null>(null)
  const [activeOrgName, setActiveOrgName] = React.useState<string>('')
  const [savingOrg, setSavingOrg] = React.useState(false)
  
  // Annual Budget state
  const [budgetYear, setBudgetYear] = React.useState<number>(new Date().getFullYear())
  const [budgetAmount, setBudgetAmount] = React.useState<string>('')
  const [budgetDescription, setBudgetDescription] = React.useState<string>('')
  const [budgetUsage, setBudgetUsage] = React.useState<AnnualBudgetUsage | null>(null)
  const [savingBudget, setSavingBudget] = React.useState(false)
  const [budgetLoaded, setBudgetLoaded] = React.useState(false)

  async function loadActiveOrg() {
    try {
      const res = await (window as any).api?.organizations?.active?.()
      if (res?.organization) {
        setActiveOrg(res.organization)
        setActiveOrgName(res.organization.name || '')
      }
    } catch (e: any) {
      console.error('Error loading active organization:', e)
    }
  }

  async function loadAnnualBudget(year: number) {
    try {
      const budget = await (window as any).api?.annualBudgets?.get?.({ year, costCenterId: null })
      const usage = await (window as any).api?.annualBudgets?.usage?.({ year, costCenterId: null })
      if (budget) {
        setBudgetAmount(String(budget.amount))
        setBudgetDescription(budget.description || '')
      } else {
        setBudgetAmount('')
        setBudgetDescription('')
      }
      setBudgetUsage(usage || null)
      setBudgetLoaded(true)
    } catch (e: any) {
      console.error('Error loading annual budget:', e)
    }
  }

  React.useEffect(() => {
    loadAnnualBudget(budgetYear)
  }, [budgetYear])

  React.useEffect(() => {
    loadActiveOrg()
  }, [])

  async function saveAnnualBudget() {
    setSavingBudget(true)
    try {
      const amount = parseFloat(budgetAmount.replace(',', '.')) || 0
      await (window as any).api?.annualBudgets?.upsert?.({
        year: budgetYear,
        amount,
        costCenterId: null,
        description: budgetDescription.trim() || null
      })
      notify('success', `Jahresbudget ${budgetYear} gespeichert`)
      await loadAnnualBudget(budgetYear)
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSavingBudget(false)
    }
  }

  async function saveOrgName() {
    if (!activeOrg || !activeOrgName.trim()) return
    setSavingOrg(true)
    try {
      await (window as any).api?.organizations?.rename?.({ orgId: activeOrg.id, name: activeOrgName.trim() })
      notify('success', 'Sachgebietname geändert')
      await loadActiveOrg()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally { setSavingOrg(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Active Organization Name (for switcher) */}
      {activeOrg && (
        <div style={{ marginBottom: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>🏢 Aktives Sachgebiet</strong>
            <div className="helper">Name des Sachgebiets im Sachgebiet-Wechsler</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: 400 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Sachgebietname</label>
              <input 
                className="input" 
                value={activeOrgName} 
                onChange={(e) => setActiveOrgName(e.target.value)} 
                placeholder="z. B. Hauptverein" 
              />
            </div>
            <button 
              className="btn" 
              disabled={savingOrg || !activeOrgName.trim() || activeOrgName === activeOrg.name} 
              onClick={saveOrgName}
            >
              Umbenennen
            </button>
          </div>
        </div>
      )}

      {/* Annual Budget (Jahresbudget) Section */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 12 }}>
          <strong>💰 Jahresbudget</strong>
          <div className="helper">Geplantes Gesamtbudget für das Sachgebiet pro Jahr</div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="field" style={{ minWidth: 100 }}>
            <label>Jahr</label>
            <select 
              className="input" 
              value={budgetYear} 
              onChange={(e) => setBudgetYear(parseInt(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Budget (€)</label>
            <input 
              className="input" 
              type="text"
              value={budgetAmount} 
              onChange={(e) => setBudgetAmount(e.target.value)} 
              placeholder="z. B. 50000" 
            />
          </div>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label>Beschreibung (optional)</label>
            <input 
              className="input" 
              value={budgetDescription} 
              onChange={(e) => setBudgetDescription(e.target.value)} 
              placeholder="z. B. Förderbudget Jugendarbeit" 
            />
          </div>
          <button 
            className="btn primary" 
            disabled={savingBudget || !budgetAmount} 
            onClick={saveAnnualBudget}
          >
            Speichern
          </button>
        </div>

        {/* Budget Usage Display */}
        {budgetLoaded && budgetUsage && budgetUsage.budgeted > 0 && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              background: 'var(--surface)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>Budget {budgetYear}</span>
              <span style={{ color: budgetUsage.remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {eurFmt.format(budgetUsage.remaining)} verbleibend
              </span>
            </div>
            
            {/* Progress Bar */}
            <div 
              style={{ 
                height: 12, 
                background: 'var(--border)', 
                borderRadius: 6, 
                overflow: 'hidden',
                marginBottom: 12
              }}
            >
              <div 
                style={{ 
                  height: '100%', 
                  width: `${Math.min(100, budgetUsage.percentage)}%`,
                  background: budgetUsage.percentage > 100 ? 'var(--danger)' : budgetUsage.percentage > 80 ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 13 }}>
              <div>
                <div className="helper">Budgetiert</div>
                <div style={{ fontWeight: 500 }}>{eurFmt.format(budgetUsage.budgeted)}</div>
              </div>
              <div>
                <div className="helper">Ausgaben</div>
                <div style={{ fontWeight: 500, color: 'var(--danger)' }}>{eurFmt.format(budgetUsage.spent)}</div>
              </div>
              <div>
                <div className="helper">Einnahmen</div>
                <div style={{ fontWeight: 500, color: 'var(--success)' }}>{eurFmt.format(budgetUsage.income)}</div>
              </div>
              <div>
                <div className="helper">Ausschöpfung</div>
                <div style={{ fontWeight: 500 }}>{budgetUsage.percentage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {budgetLoaded && (!budgetUsage || budgetUsage.budgeted === 0) && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Noch kein Budget für {budgetYear} hinterlegt.
          </div>
        )}
      </div>
    </div>
  )
}
