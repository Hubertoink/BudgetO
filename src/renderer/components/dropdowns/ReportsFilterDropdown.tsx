import React, { useEffect, useMemo, useState } from 'react'
import FilterDropdown from './FilterDropdown'
import type { VoucherType, PaymentMethod } from '../reports/types'

const parseVoucherType = (v: string): VoucherType | null => {
  if (v === 'IN' || v === 'OUT' || v === 'TRANSFER') return v
  return null
}

const parsePaymentMethod = (v: string): PaymentMethod | null => {
  if (v === 'BAR' || v === 'BANK') return v
  return null
}

export default function ReportsFilterDropdown(props: {
  yearsAvail: number[]
  from: string
  to: string
  filterType: VoucherType | null
  filterPM: PaymentMethod | null
  onApply: (v: { from: string; to: string; filterType: VoucherType | null; filterPM: PaymentMethod | null }) => void
}) {
  const { yearsAvail, from, to, filterType, filterPM, onApply } = props

  const [f, setF] = useState<string>(from)
  const [t, setT] = useState<string>(to)
  const [type, setType] = useState<VoucherType | null>(filterType)
  const [pm, setPm] = useState<PaymentMethod | null>(filterPM)

  useEffect(() => {
    setF(from)
    setT(to)
    setType(filterType)
    setPm(filterPM)
  }, [from, to, filterType, filterPM])

  const hasFilters = !!(from || to || filterType || filterPM)

  const selectedYear = useMemo(() => {
    if (!f || !t) return ''
    const fy = f.slice(0, 4)
    const ty = t.slice(0, 4)
    if (f === `${fy}-01-01` && t === `${fy}-12-31` && fy === ty) return fy
    return ''
  }, [f, t])

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

  const handleApply = () => {
    onApply({ from: f, to: t, filterType: type, filterPM: pm })
  }

  const handleReset = () => {
    setF('')
    setT('')
    setType(null)
    setPm(null)
    onApply({ from: '', to: '', filterType: null, filterPM: null })
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
      tooltipAlign="left"
    >
      <div className="filter-dropdown__field" style={{ marginBottom: 10 }}>
        <label className="filter-dropdown__label">Zeitraum</label>
        <div className="filter-dropdown__grid">
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Von</label>
            <input className="input" type="date" value={f} onChange={(e) => setF(e.target.value)} />
          </div>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Bis</label>
            <input className="input" type="date" value={t} onChange={(e) => setT(e.target.value)} />
          </div>
        </div>

        <div className="filter-dropdown__field" style={{ marginTop: 12 }}>
          <label className="filter-dropdown__label">Schnellauswahl Jahr</label>
          <select className="input" value={selectedYear} onChange={(e) => handleYearSelect(e.target.value)}>
            <option value="">—</option>
            {yearsAvail.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-dropdown__divider" />

      <div className="filter-dropdown__grid">
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Art</label>
          <select className="input" value={type ?? ''} onChange={(e) => setType(parseVoucherType(e.target.value))}>
            <option value="">Alle</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
        </div>

        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Zahlweg</label>
          <select className="input" value={pm ?? ''} onChange={(e) => setPm(parsePaymentMethod(e.target.value))}>
            <option value="">Alle</option>
            <option value="BAR">Bar</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
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
