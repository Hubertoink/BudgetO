import React, { useEffect, useMemo, useState } from 'react'
import type { CashCheckPaneProps } from '../types'

import CashCheckModal from '../../../components/modals/CashCheckModal'
import CashCheckAuditorsModal from '../../../components/modals/CashCheckAuditorsModal'

type CashCheckRow = {
  id: number
  year: number
  date: string
  soll: number
  ist: number
  diff: number
  voucherId: number | null
  voucherNo: string | null
  budgetId: number | null
  budgetLabel: string | null
  note: string | null
  inspector1Name: string | null
  inspector2Name: string | null
  createdAt: string
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

function fmtDate(d: string): string {
  const s = String(d || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(d || '')
  const [y, m, dd] = s.split('-').map((x) => Number(x))
  if (!y || !m || !dd) return s
  return `${dd.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${y}`
}

function isAuditorsRequiredError(e: any): boolean {
  const msg = String(e?.message || e || '')
  return msg.includes('KASSENPRUEFER_REQUIRED')
}

export function CashCheckPane(props: CashCheckPaneProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [yearsAvail, setYearsAvail] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CashCheckRow[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [auditorsFor, setAuditorsFor] = useState<CashCheckRow | null>(null)
  const [retryExportAfterAuditors, setRetryExportAfterAuditors] = useState(false)

  const yearsForSelect = useMemo(() => {
    const fallback = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)
    const ys = (yearsAvail && yearsAvail.length ? yearsAvail : fallback).filter((y) => Number.isFinite(y) && y > 1900)
    return Array.from(new Set(ys)).sort((a, b) => b - a)
  }, [yearsAvail])

  async function loadYears() {
    try {
      const res = await window.api.reports.years()
      const ys = ((res as any)?.years || []) as number[]
      setYearsAvail(ys)
    } catch {
      setYearsAvail([])
    }
  }

  async function loadRows(activeYear: number) {
    setLoading(true)
    try {
      const res = await window.api.cashChecks.list({ year: activeYear })
      setRows(((res as any)?.rows || []) as CashCheckRow[])
    } catch (e: any) {
      props.notify('error', String(e?.message || e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYears()
  }, [])

  useEffect(() => {
    loadRows(year)
  }, [year])

  async function exportPdf(r: CashCheckRow) {
    try {
      const res = await window.api.cashChecks.exportPdf({ id: r.id })
      const filePath = (res as any)?.filePath as string
      props.notify(
        'success',
        'PDF erstellt',
        8000,
        filePath
          ? {
              label: 'Im Ordner anzeigen',
              onClick: () => {
                ;(window.api as any).shell?.showItemInFolder?.(filePath)
              }
            }
          : undefined
      )
    } catch (e: any) {
      if (isAuditorsRequiredError(e)) {
        setRetryExportAfterAuditors(true)
        setAuditorsFor(r)
        return
      }
      props.notify('error', String(e?.message || e))
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>Kassenprüfung</strong>
        <div className="helper">Soll/Ist-Barbestand prüfen, Differenz ausgleichen, PDF exportieren.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 120 }}>
          <label>Jahr</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearsForSelect.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button className="btn primary" onClick={() => setShowCreate(true)}>
          + Neue Kassenprüfung
        </button>
        <button className="btn" onClick={() => loadRows(year)} disabled={loading}>
          Aktualisieren
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--surface)' }}>
        <table cellPadding={6} style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th align="left" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Datum
              </th>
              <th align="right" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Soll
              </th>
              <th align="right" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Ist
              </th>
              <th align="right" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Diff
              </th>
              <th align="left" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Ausgleich
              </th>
              <th align="left" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Prüfer
              </th>
              <th align="left" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, width: 220 }}>
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ paddingTop: 10, color: 'var(--text-dim)' }}>
                  Laden…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ paddingTop: 10, color: 'var(--text-dim)' }}>
                  Keine Kassenprüfungen für {year}.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const auditors = [r.inspector1Name, r.inspector2Name].filter((x) => (x || '').trim()).join(' / ')
                return (
                  <tr key={r.id}>
                    <td style={{ paddingTop: 6 }}>{fmtDate(r.date)}</td>
                    <td align="right" style={{ paddingTop: 6 }}>
                      {eurFmt.format(r.soll || 0)}
                    </td>
                    <td align="right" style={{ paddingTop: 6 }}>
                      {eurFmt.format(r.ist || 0)}
                    </td>
                    <td
                      align="right"
                      style={{
                        paddingTop: 6,
                        fontWeight: 700,
                        color: r.diff === 0 ? 'var(--text)' : r.diff > 0 ? 'var(--success)' : 'var(--danger)'
                      }}
                    >
                      {eurFmt.format(r.diff || 0)}
                    </td>
                    <td style={{ paddingTop: 6, color: 'var(--text-dim)' }}>{r.voucherNo || '—'}</td>
                    <td style={{ paddingTop: 6, color: auditors ? 'var(--text)' : 'var(--text-dim)' }}>{auditors || '—'}</td>
                    <td style={{ paddingTop: 6 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn" onClick={() => exportPdf(r)}>
                          PDF
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setRetryExportAfterAuditors(false)
                            setAuditorsFor(r)
                          }}
                        >
                          Prüfer…
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CashCheckModal
          year={year}
          notify={props.notify}
          onCreated={() => {
            loadRows(year)
            props.bumpDataVersion()
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {auditorsFor && (
        <CashCheckAuditorsModal
          cashCheckId={auditorsFor.id}
          initialInspector1Name={auditorsFor.inspector1Name}
          initialInspector2Name={auditorsFor.inspector2Name}
          notify={props.notify}
          onSaved={(names) => {
            const id = auditorsFor.id
            setAuditorsFor(null)
            const updated = rows.map((r) => (r.id === id ? { ...r, ...names } : r))
            setRows(updated)
            if (retryExportAfterAuditors) {
              setRetryExportAfterAuditors(false)
              const row = updated.find((x) => x.id === id)
              if (row) exportPdf(row)
            }
          }}
          onClose={() => setAuditorsFor(null)}
        />
      )}
    </div>
  )
}
