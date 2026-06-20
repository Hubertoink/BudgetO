import React from 'react'
import { OrgPaneProps } from '../types'

type BudgetCadence = 'ANNUAL' | 'MONTHLY'

interface ActiveOrg { id: string; name: string; dbRoot: string }
interface BudgetPeriod { id: number; cadence: BudgetCadence; year: number; month: number | null; amount: number; description: string | null }
interface BudgetUsage { budgeted: number; baseBudgeted?: number; carryover?: number; spent: number; income: number; remaining: number; percentage: number; configuredPeriods?: number; projectedIncome?: number; projectedSpent?: number; projectedRemaining?: number }

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' })

function monthName(month: number, long = false) {
  const value = new Intl.DateTimeFormat('de-DE', { month: long ? 'long' : 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2020, month - 1, 1)))
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function OrgPane({ notify }: OrgPaneProps) {
  const now = new Date()
  const [activeOrg, setActiveOrg] = React.useState<ActiveOrg | null>(null)
  const [activeOrgName, setActiveOrgName] = React.useState('')
  const [savingOrg, setSavingOrg] = React.useState(false)
  const [cadence, setCadence] = React.useState<BudgetCadence>('ANNUAL')
  const [carrySurplus, setCarrySurplus] = React.useState(false)
  const [carryDeficit, setCarryDeficit] = React.useState(false)
  const [budgetYear, setBudgetYear] = React.useState(now.getFullYear())
  const [budgetMonth, setBudgetMonth] = React.useState(now.getMonth() + 1)
  const [periods, setPeriods] = React.useState<BudgetPeriod[]>([])
  const [budgetAmount, setBudgetAmount] = React.useState('')
  const [budgetDescription, setBudgetDescription] = React.useState('')
  const [budgetUsage, setBudgetUsage] = React.useState<BudgetUsage | null>(null)
  const [yearUsage, setYearUsage] = React.useState<BudgetUsage | null>(null)
  const [savingBudget, setSavingBudget] = React.useState(false)
  const [loadingBudget, setLoadingBudget] = React.useState(true)

  const activePeriod = React.useMemo(() => periods.find((p) => p.cadence === cadence && (cadence === 'ANNUAL' || p.month === budgetMonth)) || null, [periods, cadence, budgetMonth])

  const loadActiveOrg = React.useCallback(async () => {
    try {
      const res = await window.api?.organizations?.active?.()
      if (res?.organization) {
        setActiveOrg(res.organization)
        setActiveOrgName(res.organization.name || '')
      }
    } catch (error) { console.error('Error loading active organization:', error) }
  }, [])

  const loadBudgetData = React.useCallback(async (nextCadence = cadence, year = budgetYear, month = budgetMonth) => {
    setLoadingBudget(true)
    try {
      const [listRes, usageRes, yearUsageRes] = await Promise.all([
        window.api?.budgetPeriods?.list?.({ year }),
        window.api?.budgetPeriods?.usage?.({ cadence: nextCadence, year, month: nextCadence === 'MONTHLY' ? month : null }),
        window.api?.budgetPeriods?.yearUsage?.({ year })
      ])
      setPeriods((listRes?.periods || []) as BudgetPeriod[])
      setBudgetUsage(usageRes || null)
      setYearUsage(yearUsageRes || null)
    } catch (error) {
      console.error('Error loading budget periods:', error)
      setPeriods([])
      setBudgetUsage(null)
      setYearUsage(null)
    } finally { setLoadingBudget(false) }
  }, [cadence, budgetYear, budgetMonth])

  React.useEffect(() => {
    void loadActiveOrg()
    window.api?.budgetPeriods?.config?.get?.().then((res) => {
      setCadence(res?.cadence || 'ANNUAL')
      setCarrySurplus(Boolean(res?.carrySurplus))
      setCarryDeficit(Boolean(res?.carryDeficit))
    }).catch(() => setCadence('ANNUAL'))
  }, [loadActiveOrg])

  React.useEffect(() => { void loadBudgetData(cadence, budgetYear, budgetMonth) }, [cadence, budgetYear, budgetMonth, loadBudgetData])

  React.useEffect(() => {
    setBudgetAmount(activePeriod ? String(activePeriod.amount) : '')
    setBudgetDescription(activePeriod?.description || '')
  }, [activePeriod])

  async function changeCadence(next: BudgetCadence) {
    if (next === cadence || savingBudget) return
    setSavingBudget(true)
    try {
      await window.api?.budgetPeriods?.config?.set?.({ cadence: next })
      setCadence(next)
      window.dispatchEvent(new Event('budget-period-config-changed'))
      notify('success', next === 'MONTHLY' ? 'Monatliche Budgetlogik aktiviert' : 'Jährliche Budgetlogik aktiviert')
      window.dispatchEvent(new Event('data-changed'))
    } catch (error: any) { notify('error', error?.message || String(error)) } finally { setSavingBudget(false) }
  }

  async function saveBudget() {
    const amount = Number(budgetAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) return notify('error', 'Bitte ein gültiges Budget eingeben')
    setSavingBudget(true)
    try {
      await window.api?.budgetPeriods?.upsert?.({ cadence, year: budgetYear, month: cadence === 'MONTHLY' ? budgetMonth : null, amount, description: budgetDescription.trim() || null })
      notify('success', cadence === 'MONTHLY' ? `Monatsbudget ${monthName(budgetMonth, true)} ${budgetYear} gespeichert` : `Jahresbudget ${budgetYear} gespeichert`)
      await loadBudgetData(cadence, budgetYear, budgetMonth)
      window.dispatchEvent(new Event('data-changed'))
    } catch (error: any) { notify('error', error?.message || String(error)) } finally { setSavingBudget(false) }
  }

  async function updateCarryover(next: { carrySurplus?: boolean; carryDeficit?: boolean }) {
    setSavingBudget(true)
    try {
      const result = await window.api?.budgetPeriods?.config?.set?.(next)
      setCarrySurplus(Boolean(result?.carrySurplus))
      setCarryDeficit(Boolean(result?.carryDeficit))
      notify('success', 'Monatsübertrag aktualisiert')
      await loadBudgetData(cadence, budgetYear, budgetMonth)
      window.dispatchEvent(new Event('data-changed'))
    } catch (error: any) { notify('error', error?.message || String(error)) } finally { setSavingBudget(false) }
  }

  async function fillMonths(amount: number) {
    setSavingBudget(true)
    try {
      const result = await window.api?.budgetPeriods?.fillYear?.({ year: budgetYear, amount, description: budgetDescription.trim() || null, overwrite: true })
      notify('success', `${result?.updated || 12} Monatsbudgets für ${budgetYear} gespeichert`)
      await loadBudgetData('MONTHLY', budgetYear, budgetMonth)
      window.dispatchEvent(new Event('data-changed'))
    } catch (error: any) { notify('error', error?.message || String(error)) } finally { setSavingBudget(false) }
  }

  async function saveOrgName() {
    if (!activeOrg || !activeOrgName.trim()) return
    setSavingOrg(true)
    try {
      await window.api?.organizations?.rename?.({ orgId: activeOrg.id, name: activeOrgName.trim() })
      notify('success', 'Sachgebietname geändert')
      await loadActiveOrg()
      window.dispatchEvent(new Event('data-changed'))
    } catch (error: any) { notify('error', error?.message || String(error)) } finally { setSavingOrg(false) }
  }

  const hasMonthlyPeriods = periods.some((p) => p.cadence === 'MONTHLY')
  const annualPeriod = periods.find((p) => p.cadence === 'ANNUAL')
  const displayUsage = cadence === 'MONTHLY' ? budgetUsage : yearUsage
  const displayLabel = cadence === 'MONTHLY' ? `${monthName(budgetMonth, true)} ${budgetYear}` : String(budgetYear)

  return (
    <div className="org-budget-pane">
      {activeOrg && (
        <section className="org-settings-section">
          <div className="settings-section-heading"><strong>🏢 Aktives Sachgebiet</strong><div className="helper">Name des Sachgebiets im Sachgebiet-Wechsler</div></div>
          <div className="org-name-row">
            <div className="field"><label>Sachgebietname</label><input className="input" value={activeOrgName} onChange={(e) => setActiveOrgName(e.target.value)} placeholder="z. B. Hauptverein" /></div>
            <button className="btn" disabled={savingOrg || !activeOrgName.trim() || activeOrgName === activeOrg.name} onClick={saveOrgName}>Umbenennen</button>
          </div>
        </section>
      )}

      <section className="org-settings-section budget-period-settings">
        <div className="budget-period-heading">
          <div><strong>💰 Budgetplanung</strong><div className="helper">Startbudget für das Sachgebiet – Einnahmen erhöhen, Ausgaben reduzieren den verfügbaren Betrag.</div></div>
          <div className="budget-cadence-switch" role="group" aria-label="Budgetrhythmus">
            <button className={`btn ghost ${cadence === 'ANNUAL' ? 'active' : ''}`} onClick={() => void changeCadence('ANNUAL')}>Jährlich</button>
            <button className={`btn ghost ${cadence === 'MONTHLY' ? 'active' : ''}`} onClick={() => void changeCadence('MONTHLY')}>Monatlich</button>
          </div>
        </div>

        <div className="budget-period-toolbar">
          <div className="field budget-year-field"><label>Jahr</label><select className="input" value={budgetYear} onChange={(e) => setBudgetYear(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
          {cadence === 'MONTHLY' && (
            <div className="budget-month-strip" role="tablist" aria-label="Budgetmonat">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const period = periods.find((p) => p.cadence === 'MONTHLY' && p.month === month)
                return <button key={month} role="tab" aria-selected={budgetMonth === month} className={`budget-month-chip ${budgetMonth === month ? 'active' : ''} ${period ? 'configured' : ''}`} onClick={() => setBudgetMonth(month)}><span>{monthFmt.format(new Date(Date.UTC(2020, month - 1, 1)))}</span>{period ? <small>{eurFmt.format(period.amount)}</small> : <small>—</small>}</button>
              })}
            </div>
          )}
        </div>

        {cadence === 'MONTHLY' && !hasMonthlyPeriods && annualPeriod && (
          <div className="budget-conversion-hint card">
            <div><strong>Monatsplanung einrichten</strong><div className="helper">Das vorhandene Jahresbudget bleibt erhalten. Du kannst es gleichmäßig auf zwölf Monate verteilen.</div></div>
            <button className="btn" disabled={savingBudget} onClick={() => void fillMonths(Math.round((annualPeriod.amount / 12) * 100) / 100)}>Jahresbudget ÷ 12</button>
          </div>
        )}

        {cadence === 'MONTHLY' && <div className="budget-carryover-options card"><div><strong>Monatsübertrag</strong><div className="helper">Bestimmt, ob der tatsächliche Restbetrag den Startwert des Folgemonats verändert.</div></div><div className="budget-carryover-switches"><button className={`toggle-switch ${carrySurplus ? 'active' : ''}`} role="switch" aria-checked={carrySurplus} disabled={savingBudget} onClick={() => void updateCarryover({ carrySurplus: !carrySurplus })}><span className="toggle-track"><span className="toggle-thumb" /></span><span>Überschuss übertragen</span></button><button className={`toggle-switch ${carryDeficit ? 'active' : ''}`} role="switch" aria-checked={carryDeficit} disabled={savingBudget} onClick={() => void updateCarryover({ carryDeficit: !carryDeficit })}><span className="toggle-track"><span className="toggle-thumb" /></span><span>Unterdeckung übertragen</span></button></div></div>}

        <div className="budget-period-form">
          <div className="field"><label>{cadence === 'MONTHLY' ? `Startbudget ${monthName(budgetMonth, true)}` : 'Jahres-Startbudget'} (€)</label><input className="input" inputMode="decimal" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="z. B. 3000" /></div>
          <div className="field budget-description-field"><label>Beschreibung (optional)</label><input className="input" value={budgetDescription} onChange={(e) => setBudgetDescription(e.target.value)} placeholder={cadence === 'MONTHLY' ? 'z. B. Persönliches Monatsbudget' : 'z. B. Förderbudget Jugendarbeit'} /></div>
          <button className="btn primary" disabled={savingBudget || budgetAmount === ''} onClick={() => void saveBudget()}>Speichern</button>
          {cadence === 'MONTHLY' && <button className="btn" disabled={savingBudget || budgetAmount === ''} onClick={() => { const amount = Number(budgetAmount.replace(',', '.')); if (Number.isFinite(amount) && amount >= 0) void fillMonths(amount) }}>Auf alle Monate anwenden</button>}
        </div>

        {!loadingBudget && displayUsage && displayUsage.budgeted > 0 ? (
          <div className="budget-usage-card">
            <div className="budget-usage-title"><strong>Budget {displayLabel}</strong><span style={{ color: displayUsage.remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>{eurFmt.format(displayUsage.remaining)} verbleibend</span></div>
            <div className="budget-usage-progress"><span style={{ width: `${Math.min(100, Math.max(0, displayUsage.percentage))}%`, background: displayUsage.remaining < 0 ? 'var(--danger)' : displayUsage.percentage > 80 ? 'var(--warning)' : 'var(--success)' }} /></div>
            <div className="budget-usage-kpis"><div><span className="helper">{cadence === 'MONTHLY' && displayUsage.carryover ? 'Effektives Startbudget' : 'Startbudget'}</span><strong>{eurFmt.format(displayUsage.budgeted)}</strong>{cadence === 'MONTHLY' && displayUsage.carryover ? <small className={displayUsage.carryover < 0 ? 'danger-text' : 'success-text'}>{eurFmt.format(displayUsage.baseBudgeted ?? displayUsage.budgeted)} {displayUsage.carryover < 0 ? '−' : '+'} Übertrag {eurFmt.format(Math.abs(displayUsage.carryover))}</small> : null}</div><div><span className="helper">Ausgaben</span><strong className="danger-text">{eurFmt.format(displayUsage.spent)}</strong></div><div><span className="helper">Einnahmen</span><strong className="success-text">{eurFmt.format(displayUsage.income)}</strong></div><div><span className="helper">Ausschöpfung</span><strong>{displayUsage.percentage.toFixed(1)}%</strong></div></div>
            {((displayUsage.projectedIncome || 0) > 0 || (displayUsage.projectedSpent || 0) > 0) && <div className="budget-forecast"><span>↻ Offene Wiederholungen: <strong className="success-text">+{eurFmt.format(displayUsage.projectedIncome || 0)}</strong> / <strong className="danger-text">−{eurFmt.format(displayUsage.projectedSpent || 0)}</strong></span><span>Voraussichtlich <strong>{eurFmt.format(displayUsage.projectedRemaining ?? displayUsage.remaining)}</strong></span></div>}
          </div>
        ) : !loadingBudget ? <div className="helper">Für {displayLabel} ist noch kein Budget geplant.</div> : null}

        {yearUsage && yearUsage.budgeted > 0 && (
          <div className="budget-year-end-link card"><div><strong>📊 Jahresabschluss {budgetYear}</strong><div className="helper">{cadence === 'MONTHLY' ? `${yearUsage.configuredPeriods || 0} Monatsbudgets ergeben zusammen ${eurFmt.format(yearUsage.budgeted)}.` : 'Das geplante Jahresbudget wird im Jahresabschluss berücksichtigt.'}</div></div><button className="btn" onClick={() => { try { sessionStorage.setItem('yearEnd.prefillYear', String(budgetYear)) } catch {} window.dispatchEvent(new CustomEvent('settings:selectTile', { detail: { tile: 'yearEnd', year: budgetYear } })) }}>Zum Jahresabschluss…</button></div>
        )}
      </section>
    </div>
  )
}
