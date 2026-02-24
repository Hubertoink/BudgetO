import React, { useEffect, useState } from 'react'
import FilterDropdown from './FilterDropdown'

interface TimeFilterDropdownProps {
  yearsAvail: number[]
  from: string
  to: string
  onApply: (v: { from: string; to: string }) => void
}

export default function TimeFilterDropdown({ yearsAvail, from, to, onApply }: TimeFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<string>(from)
  const [t, setT] = useState<string>(to)

  // Sync local state when props change
  useEffect(() => {
    setF(from)
    setT(to)
  }, [from, to])

  const hasFilters = !!(from || to)

  const handleApply = () => {
    onApply({ from: f, to: t })
    setOpen(false)
  }

  const handleReset = () => {
    setF('')
    setT('')
    onApply({ from: '', to: '' })
  }

  const selectedYear = (() => {
    if (!f || !t) return ''
    const fy = f.slice(0, 4)
    const ty = t.slice(0, 4)
    if (f === `${fy}-01-01` && t === `${fy}-12-31` && fy === ty) return fy
    return ''
  })()

  const handleYearSelect = (y: string) => {
    if (!y) {
      setF('')
      setT('')
      return
    }
    const yr = Number(y)
    const nf = new Date(Date.UTC(yr, 0, 1)).toISOString().slice(0, 10)
    const nt = new Date(Date.UTC(yr, 11, 31)).toISOString().slice(0, 10)
    setF(nf)
    setT(nt)
  }

  return (
    <FilterDropdown
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm-1 6v12h12V8H6zm2 2h3v3H8v-3z" />
        </svg>
      }
      title="Zeitraum"
      hasActiveFilters={hasFilters}
      alignRight
      width={340}
      ariaLabel="Zeitraum wählen"
      buttonTitle="Zeitraum"
      colorVariant="time"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="filter-dropdown__grid">
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Von</label>
          <input
            className="input"
            type="date"
            value={f}
            onChange={(e) => setF(e.target.value)}
          />
        </div>
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Bis</label>
          <input
            className="input"
            type="date"
            value={t}
            onChange={(e) => setT(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-dropdown__field" style={{ marginTop: 12 }}>
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
