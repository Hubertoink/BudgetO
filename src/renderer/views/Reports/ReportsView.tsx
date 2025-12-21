import React from 'react'
import { VoucherType, PaymentMethod } from '../../components/reports/types'
import ReportsSummary from '../../components/reports/ReportsSummary'
import ReportsMonthlyChart from '../../components/reports/ReportsMonthlyChart'
import ReportsCategoryDonut from '../../components/reports/ReportsCategoryDonut'
import ReportsPaymentMethodBars from '../../components/reports/ReportsPaymentMethodBars'

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

  const hasActiveFilters = filterType || filterPM || from || to

  return (
    <>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-dim)' }}>Zeitraum:</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
          <span style={{ color: 'var(--text-dim)' }}>Jahr:</span>
          <select className="input" value={(() => {
            if (!from || !to) return ''
            const fy = from.slice(0, 4)
            const ty = to.slice(0, 4)
            if (from === `${fy}-01-01` && to === `${fy}-12-31` && fy === ty) return fy
            return ''
          })()} onChange={(e) => {
            const y = e.target.value
            if (!y) return
            const yr = Number(y)
            const f = new Date(Date.UTC(yr, 0, 1)).toISOString().slice(0, 10)
            const t = new Date(Date.UTC(yr, 11, 31)).toISOString().slice(0, 10)
            setFrom(f); setTo(t)
          }} style={{ width: 100 }}>
            <option value="">—</option>
            {yearsAvail.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <span style={{ color: 'var(--text-dim)' }}>Art:</span>
          <select className="input" value={filterType ?? ''} onChange={(e) => setFilterType((e.target.value as VoucherType | any) || null)} style={{ width: 120 }}>
            <option value="">Alle</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
          <span style={{ color: 'var(--text-dim)' }}>Zahlweg:</span>
          <select className="input" value={filterPM ?? ''} onChange={(e) => { const v = e.target.value as PaymentMethod | any; props.setFilterPM(v || null) }} style={{ width: 100 }}>
            <option value="">Alle</option>
            <option value="BAR">Bar</option>
            <option value="BANK">Bank</option>
          </select>
          {hasActiveFilters && (
            <button className="btn danger" title="Filter zurücksetzen" onClick={() => { setFilterType(null); setFilterPM(null); setFrom(''); setTo(''); }} style={{ width: 32, height: 32, padding: 0, display: 'grid', placeContent: 'center' }}>
              ✕
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" title="Exportieren" onClick={() => onOpenExport()} style={{ width: 32, height: 32, padding: 0, display: 'grid', placeContent: 'center', background: '#c62828', color: '#fff' }}>
            📄
          </button>
        </div>
      </div>

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

