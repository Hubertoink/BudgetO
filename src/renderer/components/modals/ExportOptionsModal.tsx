import React, { useEffect, useState } from 'react'

export default function ExportOptionsModal({ open, onClose, fields, setFields, amountMode, setAmountMode, sortDir, setSortDir, onExport, dateFrom, dateTo, exportType = 'standard', setExportType, fiscalYear, setFiscalYear, includeBindings, setIncludeBindings, includeVoucherList, setIncludeVoucherList, includeBudgets, setIncludeBudgets, categoryId, setCategoryId, filterFrom, setFilterFrom, filterTo, setFilterTo, filterCategoryId, setFilterCategoryId, filterType, setFilterType, filterPM, setFilterPM }: {
  open: boolean
  onClose: () => void
  fields: Array<'date' | 'voucherNo' | 'type' | 'sphere' | 'description' | 'paymentMethod' | 'netAmount' | 'vatAmount' | 'grossAmount' | 'tags'>
  setFields: (f: Array<'date' | 'voucherNo' | 'type' | 'sphere' | 'description' | 'paymentMethod' | 'netAmount' | 'vatAmount' | 'grossAmount' | 'tags'>) => void
  amountMode: 'POSITIVE_BOTH' | 'OUT_NEGATIVE'
  setAmountMode: (m: 'POSITIVE_BOTH' | 'OUT_NEGATIVE') => void
  sortDir: 'ASC' | 'DESC'
  setSortDir: (v: 'ASC' | 'DESC') => void
  onExport: (fmt: 'CSV' | 'XLSX' | 'PDF' | 'PDF_FISCAL') => Promise<void>
  dateFrom?: string
  dateTo?: string
  exportType?: 'standard' | 'fiscal'
  setExportType?: (t: 'standard' | 'fiscal') => void
  fiscalYear?: number
  setFiscalYear?: (y: number) => void
  includeBindings?: boolean
  setIncludeBindings?: (v: boolean) => void
  includeVoucherList?: boolean
  setIncludeVoucherList?: (v: boolean) => void
  includeBudgets?: boolean
  setIncludeBudgets?: (v: boolean) => void
  // Optional: Kategorie-Filter (wichtig für Jahresabschluss)
  categoryId?: number | null
  setCategoryId?: (v: number | null) => void

  // Optional: Filter (Standard-Export)
  filterFrom?: string
  setFilterFrom?: (v: string) => void
  filterTo?: string
  setFilterTo?: (v: string) => void
  filterCategoryId?: number | null
  setFilterCategoryId?: (v: number | null) => void
  filterType?: 'IN' | 'OUT' | 'TRANSFER' | null
  setFilterType?: (v: 'IN' | 'OUT' | 'TRANSFER' | null) => void
  filterPM?: 'BAR' | 'BANK' | null
  setFilterPM?: (v: 'BAR' | 'BANK' | null) => void
}) {
  const all: Array<{ key: any; label: string }> = [
    { key: 'date', label: 'Datum' },
    { key: 'voucherNo', label: 'Nr.' },
    { key: 'type', label: 'Typ' },
    { key: 'sphere', label: 'Kategorie' },
    { key: 'description', label: 'Beschreibung' },
    { key: 'paymentMethod', label: 'Zahlweg' },
    { key: 'netAmount', label: 'Netto' },
    { key: 'vatAmount', label: 'MwSt' },
    { key: 'grossAmount', label: 'Brutto' },
    { key: 'tags', label: 'Tags' }
  ]

  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])

  // Load available years (years with actual bookings)
  useEffect(() => {
    let cancelled = false
    if (!open) return
    ;(async () => {
      try {
        const res = await (window as any).api?.reports?.years?.()
        if (!cancelled && res?.years) {
          setAvailableYears(res.years.sort((a: number, b: number) => b - a))
        }
      } catch {
        if (!cancelled) setAvailableYears([])
      }
    })()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    let cancelled = false
    if (!open) return
    const shouldLoadCategories = Boolean(setCategoryId || setFilterCategoryId)
    if (!shouldLoadCategories) return
    ;(async () => {
      try {
        const res = await (window as any).api?.customCategories?.list?.({ includeInactive: false })
        const rows = (res?.rows || res?.categories || []) as any[]
        const mapped = rows
          .filter((r) => r && typeof r.id === 'number')
          .map((r) => ({ id: Number(r.id), name: String(r.name || `#${r.id}`) }))
        if (!cancelled) setCategories(mapped)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => { cancelled = true }
  }, [open, setCategoryId, setFilterCategoryId])
  const toggle = (k: any) => {
    const set = new Set(fields)
    if (set.has(k)) set.delete(k)
    else set.add(k)
    setFields(Array.from(set) as any)
  }
  
  const applyJournalColumns = () => {
    try {
      const stored = localStorage.getItem('journalCols')
      if (!stored) return
      const cols = JSON.parse(stored)
      const mapping: Record<string, any> = {
        'date': 'date',
        'voucherNo': 'voucherNo',
        'type': 'type',
        'sphere': 'sphere',
        'description': 'description',
        'paymentMethod': 'paymentMethod',
        'net': 'netAmount',
        'vat': 'vatAmount',
        'gross': 'grossAmount'
      }
      const newFields: any[] = []
      Object.entries(cols).forEach(([key, visible]) => {
        if (visible && mapping[key]) {
          newFields.push(mapping[key])
        }
      })
      if (newFields.length > 0) {
        setFields(newFields as any)
      }
    } catch (e) {
      console.error('Failed to apply journal columns:', e)
    }
  }
  
  if (!open) return null
  
  const currentYear = new Date().getFullYear()
  // For fiscal export year dropdown, include current year + availableYears
  const fiscalYears = [...new Set([currentYear, ...availableYears])].sort((a, b) => b - a)
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Export Optionen</h2>
            {(dateFrom || dateTo) && (
              <div className="helper" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span>📅</span>
                <span>{dateFrom || '…'} – {dateTo || '…'}</span>
              </div>
            )}
          </div>
          <button className="btn danger" onClick={onClose}>Schließen</button>
        </header>
        
        {/* Export Type Selection */}
        {setExportType && (
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Export-Art</label>
            <div className="btn-group" role="group">
              <button 
                className="btn" 
                onClick={() => setExportType('standard')} 
                style={{ background: exportType === 'standard' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}
              >
                📊 Standard (Controlling)
              </button>
              <button 
                className="btn" 
                onClick={() => setExportType('fiscal')} 
                style={{ background: exportType === 'fiscal' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}
              >
                🏛️ Jahresabschluss
              </button>
            </div>
            <div className="helper" style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
              {exportType === 'standard' 
                ? 'Standard-Export für Controlling und Analyse mit frei wählbaren Feldern und Zeitraum' 
                : 'Jahresabschluss-Report (PDF) – optional nach Kategorie gefiltert'}
            </div>
          </div>
        )}
        
        {/* Fiscal Year Selection (only for fiscal export) */}
        {exportType === 'fiscal' && setFiscalYear && (
          <>
            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <label>Geschäftsjahr</label>
              <select 
                className="input" 
                value={fiscalYear || currentYear} 
                onChange={(e) => setFiscalYear(Number(e.target.value))}
              >
                {fiscalYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="helper" style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
                Zeitraum: 01.01.{fiscalYear || currentYear} – 31.12.{fiscalYear || currentYear}
              </div>
            </div>

            {setCategoryId && (
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label>Kategorie (optional)</label>
                <select
                  className="input"
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Alle</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="helper" style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
                  Filtert den Jahresabschluss auf eine Kategorie.
                </div>
              </div>
            )}
            
            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <label>Zusätzliche Optionen</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="chip" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={includeBindings ?? false} 
                    onChange={(e) => setIncludeBindings?.(e.target.checked)} 
                    style={{ marginRight: 6 }} 
                  />
                  Zweckbindungen einbeziehen
                </label>
                <label className="chip" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={includeBudgets ?? false} 
                    onChange={(e) => setIncludeBudgets?.(e.target.checked)} 
                    style={{ marginRight: 6 }} 
                  />
                  Budgets einbeziehen
                </label>
                <label className="chip" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={includeVoucherList ?? false} 
                    onChange={(e) => setIncludeVoucherList?.(e.target.checked)} 
                    style={{ marginRight: 6 }} 
                  />
                  Detaillierte Belegübersicht anhängen
                </label>
              </div>
            </div>
          </>
        )}
        
        {/* Standard export options (only for standard export) */}
        {exportType === 'standard' && (
          <>
            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label>Felder</label>
                <button className="btn" onClick={applyJournalColumns} title="Übernimmt die aktuelle Spaltenauswahl aus der Buchungsansicht">
                  📋 Aus Buchungsansicht übernehmen
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {all.map(f => (
                  <label key={f.key} className="chip" style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggle(f.key)} style={{ marginRight: 6 }} />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="helper" style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>Hinweis: Die Auswahl „Tags" gilt nur für CSV/XLSX, nicht für den PDF-Report.</div>
            </div>

            {/* Filter Section - clean card design */}
            <div 
              className="export-filter-card"
              style={{ 
                gridColumn: '1 / span 2',
                background: 'color-mix(in oklab, var(--accent) 6%, var(--surface))',
                border: '1px solid color-mix(in oklab, var(--accent) 20%, var(--border))',
                borderRadius: 8,
                padding: '10px 12px',
                marginTop: 4
              }}
            >
              {/* Header with info tooltip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 15 }}>🔍</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Daten filtern</span>
                <div 
                  className="export-filter-info-trigger"
                  style={{ 
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: 'var(--on-accent, #fff)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'help',
                    userSelect: 'none'
                  }}
                >
                  i
                  <div 
                    className="export-filter-info-popup"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 260,
                      padding: '10px 12px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--text)',
                      zIndex: 100,
                      pointerEvents: 'none',
                      opacity: 0,
                      transition: 'opacity 0.15s ease'
                    }}
                  >
                    <strong>Wozu Filter?</strong><br/>
                    Grenze den Export auf einen bestimmten Zeitraum, eine Kategorie, Buchungstyp oder Zahlweg ein. So erhältst du genau die Daten, die du benötigst.
                  </div>
                </div>
                {/* Active filter indicator */}
                {(filterFrom || filterTo || filterCategoryId != null || filterType || filterPM) && (
                  <span 
                    style={{ 
                      marginLeft: 'auto',
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: 'var(--accent)',
                      color: 'var(--on-accent, #fff)',
                      fontWeight: 500
                    }}
                  >
                    Filter aktiv
                  </span>
                )}
              </div>

              {/* Year quick-select buttons - only years with bookings */}
              {availableYears.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 5 }}>Jahr</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {availableYears.map((y) => {
                      const yStart = `${y}-01-01`
                      const yEnd = `${y}-12-31`
                      const isActive = filterFrom === yStart && filterTo === yEnd
                      return (
                        <button
                          key={y}
                          className="btn"
                          onClick={() => {
                            if (isActive) {
                              setFilterFrom?.('')
                              setFilterTo?.('')
                            } else {
                              setFilterFrom?.(yStart)
                              setFilterTo?.(yEnd)
                            }
                          }}
                          style={{
                            minWidth: 48,
                            padding: '3px 8px',
                            fontSize: 12,
                            fontWeight: isActive ? 600 : 400,
                            background: isActive 
                              ? 'var(--accent)' 
                              : 'var(--surface)',
                            color: isActive ? 'var(--on-accent, #fff)' : 'var(--text)',
                            border: '1px solid var(--border)',
                            borderRadius: 6
                          }}
                        >
                          {y}
                        </button>
                      )
                    })}
                    {(filterFrom || filterTo || filterCategoryId != null || filterType || filterPM) && (
                      <button
                        className="btn ghost"
                        onClick={() => { setFilterFrom?.(''); setFilterTo?.(''); setFilterCategoryId?.(null); setFilterType?.(null); setFilterPM?.(null) }}
                        style={{ fontSize: 11, padding: '3px 6px' }}
                        title="Alle Filter zurücksetzen"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Date range inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Von</div>
                  <input
                    className="input"
                    type="date"
                    value={filterFrom ?? ''}
                    onChange={(e) => setFilterFrom?.(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Bis</div>
                  <input
                    className="input"
                    type="date"
                    value={filterTo ?? ''}
                    onChange={(e) => setFilterTo?.(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Dropdowns row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Kategorie</div>
                  <select
                    className="input"
                    value={filterCategoryId ?? ''}
                    onChange={(e) => setFilterCategoryId?.(e.target.value ? Number(e.target.value) : null)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Alle</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Typ</div>
                  <select
                    className="input"
                    value={filterType ?? ''}
                    onChange={(e) => setFilterType?.(e.target.value ? (e.target.value as any) : null)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Alle</option>
                    <option value="IN">Einnahme</option>
                    <option value="OUT">Ausgabe</option>
                    <option value="TRANSFER">Umbuchung</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Zahlweg</div>
                  <select
                    className="input"
                    value={filterPM ?? ''}
                    onChange={(e) => setFilterPM?.(e.target.value ? (e.target.value as any) : null)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Alle</option>
                    <option value="BAR">Bar</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <label>Betragsdarstellung</label>
              <div className="btn-group" role="group">
                <button className="btn" onClick={() => setAmountMode('POSITIVE_BOTH')} style={{ background: amountMode === 'POSITIVE_BOTH' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Beide positiv</button>
                <button className="btn" onClick={() => setAmountMode('OUT_NEGATIVE')} style={{ background: amountMode === 'OUT_NEGATIVE' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Ausgaben negativ</button>
              </div>
            </div>
            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <label>Sortierung (Datum)</label>
              <div className="btn-group" role="group">
                <button className="btn" onClick={() => setSortDir('ASC')} style={{ background: sortDir === 'ASC' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Aufsteigend</button>
                <button className="btn" onClick={() => setSortDir('DESC')} style={{ background: sortDir === 'DESC' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}>Absteigend</button>
              </div>
            </div>
          </>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          {exportType === 'fiscal' ? (
            <button className="btn primary" onClick={() => onExport('PDF_FISCAL')}>📄 PDF (Jahresabschluss)</button>
          ) : (
            <>
              <button className="btn" onClick={() => onExport('CSV')}>CSV</button>
              <button className="btn" onClick={() => onExport('PDF')}>PDF</button>
              <button className="btn primary" onClick={() => onExport('XLSX')}>XLSX</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
