import React, { useMemo } from 'react'
import { VoucherType, PaymentMethod } from '../../components/reports/types'
import ReportsAnnualBudget from '../../components/reports/ReportsAnnualBudget'
import ReportsSummary from '../../components/reports/ReportsSummary'
import ReportsMonthlyChart from '../../components/reports/ReportsMonthlyChart'
import ReportsCategoryDonut from '../../components/reports/ReportsCategoryDonut'
import ReportsPaymentMethodBars from '../../components/reports/ReportsPaymentMethodBars'
import { ReportsFilterDropdown } from '../../components/dropdowns'

export default function ReportsView(props: {
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
  yearsAvail: number[]
  filterSphere: any
  setFilterSphere: (v: any) => void
  filterType: VoucherType | null
  setFilterType: (v: VoucherType | null) => void
  filterPM: PaymentMethod | null
  setFilterPM: (v: PaymentMethod | null) => void
  onOpenExport: () => void
  refreshKey: number
  activateKey: number
}) {
  const { from, to, setFrom, setTo, yearsAvail, filterType, setFilterType, filterPM, setFilterPM, onOpenExport, refreshKey, activateKey } = props

  const rangeChipLabel = useMemo(() => {
    if (!from && !to) return null
    if (from && to) {
      const fy = from.slice(0, 4)
      const ty = to.slice(0, 4)
      if (from === `${fy}-01-01` && to === `${fy}-12-31` && fy === ty) return fy
    }
    return `${from || '…'} – ${to || '…'}`
  }, [from, to])

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; clear: () => void }> = []
    if (rangeChipLabel) {
      list.push({
        key: 'range',
        label: rangeChipLabel,
        clear: () => {
          setFrom('')
          setTo('')
        }
      })
    }
    if (filterType) list.push({ key: 'type', label: `Art: ${filterType}`, clear: () => setFilterType(null) })
    if (filterPM) list.push({ key: 'pm', label: `Zahlweg: ${filterPM}`, clear: () => setFilterPM(null) })
    return list
  }, [rangeChipLabel, filterType, filterPM, setFrom, setTo, setFilterType, setFilterPM])

  // Derive selected year from date filters (only when full year is selected)
  const selectedYear = useMemo(() => {
    if (!from || !to) return null
    const fy = from.slice(0, 4)
    const ty = to.slice(0, 4)
    if (from === `${fy}-01-01` && to === `${fy}-12-31` && fy === ty) {
      return Number(fy)
    }
    return null
  }, [from, to])

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 8px', alignItems: 'center' }}>
        {chips.map((c) => (
          <span key={c.key} className="chip">
            {c.label}
            <button className="chip-x" onClick={c.clear} aria-label={`Filter ${c.key} löschen`}>
              ×
            </button>
          </span>
        ))}

        {(filterType || filterPM || from || to) && (
          <div className="journal-toolbar__group">
            <button
              className="btn ghost filter-dropdown__trigger has-tooltip"
              data-tooltip="Alle Filter zurücksetzen"
              aria-label="Alle Filter zurücksetzen"
              title="Alle Filter zurücksetzen"
              onClick={() => {
                setFilterType(null)
                setFilterPM(null)
                setFrom('')
                setTo('')
              }}
              style={{ color: 'var(--accent)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div className="journal-toolbar__group">
          <button
            className="btn ghost filter-dropdown__trigger has-tooltip tooltip-left"
            data-tooltip="PDF Export"
            aria-label="PDF Export"
            title="PDF Export"
            onClick={() => onOpenExport()}
            style={{ color: 'var(--danger-strong)' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </button>

          <ReportsFilterDropdown
            yearsAvail={yearsAvail}
            from={from}
            to={to}
            filterType={filterType}
            filterPM={filterPM}
            onApply={({ from: nf, to: nt, filterType: ft, filterPM: fpm }) => {
              setFrom(nf)
              setTo(nt)
              setFilterType(ft)
              setFilterPM(fpm)
            }}
          />
        </div>
      </div>

      {/* Annual Budget Overview - only when a full year is selected */}
      <ReportsAnnualBudget year={selectedYear} refreshKey={refreshKey} />

      {/* KPIs and charts */}
      <ReportsSummary refreshKey={refreshKey} from={from || undefined} to={to || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ReportsCategoryDonut refreshKey={refreshKey} from={from || undefined} to={to || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
        <ReportsPaymentMethodBars refreshKey={refreshKey} from={from || undefined} to={to || undefined} />
      </div>
      <div style={{ height: 12 }} />
      <ReportsMonthlyChart activateKey={activateKey} refreshKey={refreshKey} from={from || undefined} to={to || undefined} type={filterType || undefined} paymentMethod={filterPM || undefined} />
    </>
  )
}

