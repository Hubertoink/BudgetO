import React, { useState, useEffect } from 'react'
import FilterDropdown from './FilterDropdown'

interface InvoiceFilterDropdownProps {
  // Current filter values
  status: 'ALL' | 'OPEN' | 'PARTIAL' | 'PAID'
  sphere: '' | 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  budgetId: number | ''
  tag: string
  dueFrom: string
  dueTo: string
  // Data for dropdowns
  budgets: Array<{ id: number; name?: string | null; year: number }>
  tags: Array<{ id: number; name: string }>
  yearsAvail: number[]
  // Callback
  onApply: (filters: {
    status: 'ALL' | 'OPEN' | 'PARTIAL' | 'PAID'
    sphere: '' | 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    budgetId: number | ''
    tag: string
    dueFrom: string
    dueTo: string
  }) => void
}

export default function InvoiceFilterDropdown({
  status: statusProp,
  sphere: sphereProp,
  budgetId: budgetIdProp,
  tag: tagProp,
  dueFrom: dueFromProp,
  dueTo: dueToProp,
  budgets,
  tags,
  yearsAvail,
  onApply
}: InvoiceFilterDropdownProps) {
  // Local state for editing
  const [status, setStatus] = useState(statusProp)
  const [sphere, setSphere] = useState(sphereProp)
  const [budgetId, setBudgetId] = useState(budgetIdProp)
  const [tag, setTag] = useState(tagProp)
  const [dueFrom, setDueFrom] = useState(dueFromProp)
  const [dueTo, setDueTo] = useState(dueToProp)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [open, setOpen] = useState(false)

  // Sync when props change
  useEffect(() => {
    setStatus(statusProp)
    setSphere(sphereProp)
    setBudgetId(budgetIdProp)
    setTag(tagProp)
    setDueFrom(dueFromProp)
    setDueTo(dueToProp)
  }, [statusProp, sphereProp, budgetIdProp, tagProp, dueFromProp, dueToProp])

  const hasFilters = status !== 'ALL' || sphere !== '' || budgetId !== '' || tag !== '' || dueFrom !== '' || dueTo !== ''

  function handleYearSelect(year: string) {
    setSelectedYear(year)
    if (!year) {
      setDueFrom('')
      setDueTo('')
    } else {
      setDueFrom(`${year}-01-01`)
      setDueTo(`${year}-12-31`)
    }
  }

  function handleApply() {
    onApply({ status, sphere, budgetId, tag, dueFrom, dueTo })
    setOpen(false)
  }

  function handleReset() {
    setStatus('ALL')
    setSphere('')
    setBudgetId('')
    setTag('')
    setDueFrom('')
    setDueTo('')
    setSelectedYear('')
    onApply({ status: 'ALL', sphere: '', budgetId: '', tag: '', dueFrom: '', dueTo: '' })
  }

  return (
    <FilterDropdown
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 4h18v2L14 13v6l-4 2v-8L3 6V4z" />
        </svg>
      }
      title="Filter"
      hasActiveFilters={hasFilters}
      alignRight
      width={380}
      ariaLabel="Filter"
      buttonTitle="Filter"
      colorVariant="filter"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="filter-dropdown__grid">
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ALL">Alle</option>
            <option value="OPEN">Offen</option>
            <option value="PARTIAL">Teilweise</option>
            <option value="PAID">Bezahlt</option>
          </select>
        </div>

        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Sphäre</label>
          <select
            className="input"
            value={sphere}
            onChange={(e) => setSphere(e.target.value as typeof sphere)}
          >
            <option value="">Alle</option>
            <option value="IDEELL">IDEELL</option>
            <option value="ZWECK">ZWECK</option>
            <option value="VERMOEGEN">VERMÖGEN</option>
            <option value="WGB">WGB</option>
          </select>
        </div>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Budget</label>
        <select
          className="input"
          value={String(budgetId)}
          onChange={(e) => setBudgetId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Alle</option>
          {budgets.map(b => (
            <option key={b.id} value={b.id}>
              {b.year}{b.name ? ` – ${b.name}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Tag</label>
        <select
          className="input"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">Alle</option>
          {tags.map(t => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__divider" />

      <div className="filter-dropdown__grid">
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Fällig von</label>
          <input
            className="input"
            type="date"
            value={dueFrom}
            onChange={(e) => { setDueFrom(e.target.value); setSelectedYear('') }}
          />
        </div>
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Fällig bis</label>
          <input
            className="input"
            type="date"
            value={dueTo}
            onChange={(e) => { setDueTo(e.target.value); setSelectedYear('') }}
          />
        </div>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Schnellauswahl Jahr</label>
        <select
          className="input"
          value={selectedYear}
          onChange={(e) => handleYearSelect(e.target.value)}
        >
          <option value="">—</option>
          {yearsAvail.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__actions">
        <button className="btn" onClick={handleReset}>
          Zurücksetzen
        </button>
        <button className="btn primary" onClick={handleApply}>
          Übernehmen
        </button>
      </div>
    </FilterDropdown>
  )
}
