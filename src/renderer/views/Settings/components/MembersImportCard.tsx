import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface MembersImportCardProps {
  notify?: (type: 'success' | 'error' | 'info', text: string, ms?: number, action?: { label: string; onClick: () => void }) => void
}

type RowEditMap = Record<number, Record<string, any>>

type ExecuteResult = {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  rowStatuses?: Array<{ row: number; ok: boolean; message?: string }>
  errorFilePath?: string
}

const FIELD_KEYS = [
  { key: 'memberNo', label: 'Mitgliedsnummer', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'join_date', label: 'Eintrittsdatum', required: true },
  { key: 'status', label: 'Status' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'street', label: 'Straße' },
  { key: 'zip', label: 'PLZ' },
  { key: 'city', label: 'Ort' },
  { key: 'address', label: 'Adresse (alternativ)' },
  { key: 'leave_date', label: 'Austrittsdatum' },
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
  { key: 'contribution_amount', label: 'Beitrag' },
  { key: 'contribution_interval', label: 'Intervall' },
  { key: 'mandate_ref', label: 'Mandatsreferenz' },
  { key: 'mandate_date', label: 'Mandatsdatum' },
  { key: 'next_due_date', label: 'Nächste Fälligkeit' },
  { key: 'boardRole', label: 'Vorstandsrolle' },
  { key: 'notes', label: 'Notizen' }
] as const

function bufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
  }
  return btoa(binary)
}

export function MembersImportCard({ notify }: MembersImportCardProps) {
  const [fileName, setFileName] = useState('')
  const [base64, setBase64] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [sample, setSample] = useState<Array<Record<string, any>>>([])
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)

  const [mapping, setMapping] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {}
    for (const f of FIELD_KEYS) init[f.key] = null
    return init
  })

  const [updateExisting, setUpdateExisting] = useState<boolean>(true)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set())
  const [rowEdits, setRowEdits] = useState<RowEditMap>({})

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [showErrorsModal, setShowErrorsModal] = useState(false)

  const fileRef = useRef<HTMLInputElement | null>(null)

  const effectiveHeaderRowIndex = headerRowIndex || 1
  const rowNumberForSampleIndex = useMemo(() => {
    return (i: number) => effectiveHeaderRowIndex + 1 + i
  }, [effectiveHeaderRowIndex])

  useEffect(() => {
    if (!sample.length) {
      setSelectedRows(new Set())
      return
    }
    const next = new Set<number>()
    for (let i = 0; i < sample.length; i++) next.add(rowNumberForSampleIndex(i))
    setSelectedRows(next)
  }, [sample, rowNumberForSampleIndex])

  async function processFile(f: File) {
    setError('')
    setResult(null)
    setRowEdits({})
    setFileName(f.name)

    try {
      const buf = await f.arrayBuffer()
      const b64 = bufferToBase64(buf)
      setBase64(b64)
      setBusy(true)
      try {
        const prev = await (window as any).api?.members?.import?.preview?.({ fileBase64: b64 })
        if (prev) {
          setHeaders(prev.headers || [])
          setSample(prev.sample || [])
          setMapping(prev.suggestedMapping || {})
          setHeaderRowIndex(prev.headerRowIndex ?? null)
        }
      } finally {
        setBusy(false)
      }
    } catch (e: any) {
      setBusy(false)
      setError('Datei konnte nicht gelesen werden: ' + (e?.message || String(e)))
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    await processFile(f)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer?.files?.[0]
    if (f) processFile(f)
  }

  function toggleRow(rowNumber: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  function setEdit(rowNumber: number, header: string, value: any) {
    setRowEdits((prev) => {
      const next: RowEditMap = { ...prev }
      next[rowNumber] = { ...(next[rowNumber] || {}), [header]: value }
      return next
    })
  }

  async function onImport() {
    setError('')
    if (!base64) {
      setError('Bitte zuerst eine XLSX-Datei auswählen.')
      return
    }

    const missingRequired = ['memberNo', 'name', 'join_date'].filter((k) => !mapping?.[k])
    if (missingRequired.length) {
      setError('Pflichtfelder sind nicht zugeordnet: ' + missingRequired.join(', '))
      return
    }

    setBusy(true)
    try {
      const payload = {
        fileBase64: base64,
        mapping,
        options: {
          updateExisting,
          selectedRows: Array.from(selectedRows),
          rowEdits: Object.fromEntries(Object.entries(rowEdits).map(([k, v]) => [String(k), v]))
        }
      }

      const res = (await (window as any).api?.members?.import?.execute?.(payload)) as ExecuteResult
      setResult(res)
      window.dispatchEvent(new Event('data-changed'))

      if (res?.errors?.length) {
        setShowErrorsModal(true)
        notify?.('error', `Import mit ${res.errors.length} Fehler(n).`, 6000)
        if (res.errorFilePath) {
          notify?.('info', `Fehler-Excel gespeichert: ${res.errorFilePath}`)
        }
      } else {
        notify?.('success', `Import abgeschlossen: ${res.imported} neu, ${res.updated} aktualisiert, ${res.skipped} übersprungen`, 5000)
      }
    } catch (e: any) {
      setError(e?.message || String(e))
      notify?.('error', e?.message || String(e), 6000)
    } finally {
      setBusy(false)
    }
  }

  async function onTemplate() {
    setError('')
    try {
      const res = await (window as any).api?.members?.import?.template?.({})
      if (res?.filePath) {
        notify?.('success', `Vorlage gespeichert: ${res.filePath}`, 5000, {
          label: 'Ordner öffnen',
          onClick: () => (window as any).api?.shell?.showItemInFolder?.(res.filePath)
        })
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg && /abbruch/i.test(msg)) return
      setError('Vorlage konnte nicht erstellt werden: ' + msg)
      notify?.('error', 'Vorlage konnte nicht erstellt werden: ' + msg)
    }
  }

  async function onTestdata() {
    setError('')
    try {
      const res = await (window as any).api?.members?.import?.testdata?.({})
      if (res?.filePath) {
        notify?.('success', `Testdaten gespeichert: ${res.filePath}`, 5000, {
          label: 'Ordner öffnen',
          onClick: () => (window as any).api?.shell?.showItemInFolder?.(res.filePath)
        })
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg && /abbruch/i.test(msg)) return
      setError('Testdaten konnten nicht erstellt werden: ' + msg)
      notify?.('error', 'Testdaten konnten nicht erstellt werden: ' + msg)
    }
  }

  // Helper to render a single mapping field with label and select
  const Field = ({ keyName }: { keyName: string }) => {
    const f = FIELD_KEYS.find((k) => k.key === keyName)!
    const current = mapping[f.key] || ''
    const requiredMark = f.required ? ' *' : ''
    return (
      <label key={f.key} className="field-row">
        <span className="field-label">
          {f.label}
          {requiredMark}
        </span>
        <select
          className="input"
          value={current}
          onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}
        >
          <option value="">— nicht zuordnen —</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h || '(leer)'}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="card" style={{ padding: 12, borderColor: 'rgba(80, 180, 180, 0.35)' }}>
      <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
      <div
        className="input import-dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={onDrop}
        style={{
          marginTop: 4,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderRadius: 12,
          borderColor: 'rgba(80, 180, 180, 0.5)'
        }}
        title="Datei hier ablegen oder auswählen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>
            Datei auswählen
          </button>
          <span className="helper">{fileName || 'Keine ausgewählt'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onTemplate}>
            Vorlage herunterladen
          </button>
          <button className="btn" onClick={onTestdata}>
            Testdatei erzeugen
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</div>}

      {!!headers.length && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>Zuordnung</strong>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                <span>Bestehende anhand Mitgliedsnummer aktualisieren</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
              {FIELD_KEYS.map((f) => (
                <Field key={f.key} keyName={f.key} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong>Vorschau (erste {sample.length} Zeilen)</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn primary" onClick={onImport} disabled={busy || !sample.length}>Import starten</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table cellPadding={6} style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th align="left">Import</th>
                  <th align="right">Zeile</th>
                  {headers.slice(0, 10).map((h) => (
                    <th align="left" key={h}>{h}</th>
                  ))}
                  {headers.length > 10 && <th align="left">…</th>}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => {
                  const rowNumber = rowNumberForSampleIndex(i)
                  const checked = selectedRows.has(rowNumber)
                  return (
                    <tr key={rowNumber} style={{ opacity: checked ? 1 : 0.5 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(rowNumber)}
                          aria-label={`Zeile ${rowNumber} importieren`}
                        />
                      </td>
                      <td align="right">{rowNumber}</td>
                      {headers.slice(0, 10).map((h) => {
                        const editVal = rowEdits?.[rowNumber]?.[h]
                        const value = editVal !== undefined ? editVal : row?.[h]
                        return (
                          <td key={h}>
                            <input
                              className="input"
                              value={value ?? ''}
                              onChange={(e) => setEdit(rowNumber, h, e.target.value)}
                              style={{ minWidth: 140 }}
                              disabled={!checked}
                            />
                          </td>
                        )
                      })}
                      {headers.length > 10 && <td className="helper">…</td>}
                    </tr>
                  )
                })}
                {sample.length === 0 && (
                  <tr><td colSpan={14} className="helper">Keine Vorschau-Daten.</td></tr>
                )}
              </tbody>
            </table>
            <div className="helper" style={{ marginTop: 6 }}>
              Hinweis: Die Vorschau zeigt nur die ersten Zeilen. Ohne Auswahl werden alle Zeilen importiert; mit Auswahl nur die markierten.
            </div>
          </div>

          {result && (
            <div style={{ display: 'grid', gap: 6 }}>
              <strong>Ergebnis</strong>
              <div className="helper">
                Neu: {result.imported} · Aktualisiert: {result.updated} · Übersprungen: {result.skipped} · Fehler: {result.errors?.length || 0}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {!!result.errors?.length && <button className="btn" onClick={() => setShowErrorsModal(true)}>Fehler anzeigen</button>}
                {result.errorFilePath && (
                  <button className="btn" onClick={() => (window as any).api?.shell?.showItemInFolder?.(result.errorFilePath)} title={String(result.errorFilePath)}>
                    Fehler-Datei öffnen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showErrorsModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowErrorsModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px, 96vw)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Import-Fehler</h2>
              <button className="btn danger" onClick={() => setShowErrorsModal(false)}>Schließen</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table cellPadding={6} style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th align="right">Zeile</th>
                    <th align="left">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.errors || []).map((e, idx) => (
                    <tr key={idx}>
                      <td align="right">{e.row}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                  {(result?.errors || []).length === 0 && (
                    <tr><td colSpan={2} className="helper">Keine Fehler.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
