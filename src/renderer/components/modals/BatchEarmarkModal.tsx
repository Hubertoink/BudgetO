import React, { useState } from 'react'
import { createPortal } from 'react-dom'

export interface BatchEarmarkModalProps {
  onClose: () => void
  earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
  tagDefs: Array<{ id: number; name: string; color?: string | null }>
  budgets: Array<{ id: number; label: string }>
  currentFilters: { paymentMethod?: 'BAR' | 'BANK'; sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; type?: 'IN' | 'OUT' | 'TRANSFER'; from?: string; to?: string; q?: string }
  onApplied: (updated: number) => void
  notify?: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}

const BatchEarmarkModal: React.FC<BatchEarmarkModalProps> = ({ onClose, earmarks, tagDefs, budgets, currentFilters, onApplied, notify }) => {
  const [mode, setMode] = useState<'EARMARK' | 'TAGS' | 'BUDGET'>('EARMARK')
  const [earmarkId, setEarmarkId] = useState<number | ''>('')
  const [onlyWithout, setOnlyWithout] = useState<boolean>(false)
  const [tagInput, setTagInput] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [budgetId, setBudgetId] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)

  const selectedEarmark = earmarks.find(e => e.id === (typeof earmarkId === 'number' ? earmarkId : -1))
  const addTag = (t: string) => {
    const v = (t || '').trim()
    if (!v) return
    if (!selectedTags.some(x => x.toLowerCase() === v.toLowerCase())) setSelectedTags(prev => [...prev, v])
  }
  const removeTag = (name: string) => setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== name.toLowerCase()))

  async function run() {
    try {
      setBusy(true)
      if (mode === 'EARMARK') {
        if (!earmarkId) { notify?.('error', 'Bitte eine Zweckbindung wählen'); return }
        const payload: any = { earmarkId: Number(earmarkId), ...currentFilters }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignEarmark?.(payload)
        const n = res?.updated ?? 0
        onApplied(n); onClose()
      } else if (mode === 'TAGS') {
        const tags = selectedTags.length ? selectedTags : (tagInput || '').split(',').map(s => s.trim()).filter(Boolean)
        if (!tags.length) { notify?.('error', 'Bitte mindestens einen Tag angeben'); return }
        const res = await (window as any).api?.vouchers.batchAssignTags?.({ tags, ...currentFilters })
        const n = res?.updated ?? 0
        onApplied(n); onClose()
      } else if (mode === 'BUDGET') {
        if (!budgetId) { notify?.('error', 'Bitte ein Budget wählen'); return }
        const payload: any = { budgetId: Number(budgetId), ...currentFilters }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignBudget?.(payload)
        const n = res?.updated ?? 0
        onApplied(n); onClose()
      }
    } catch (e: any) {
      notify?.('error', e?.message || String(e))
    } finally { setBusy(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Batch zuweisen</h2>
          <button className="btn danger" onClick={onClose}>Schließen</button>
        </header>
        <div className="row">
          <div className="field" style={{ gridColumn: '1 / span 2' }}>
            <label>Was soll zugewiesen werden?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn ${mode === 'EARMARK' ? 'primary' : ''}`} onClick={() => setMode('EARMARK')}>Zweckbindung</button>
              <button className={`btn ${mode === 'TAGS' ? 'primary' : ''}`} onClick={() => setMode('TAGS')}>Tags</button>
              <button className={`btn ${mode === 'BUDGET' ? 'primary' : ''}`} onClick={() => setMode('BUDGET')}>Budget</button>
            </div>
          </div>

          {mode === 'EARMARK' && (
            <>
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label>Zweckbindung</label>
                <select className="input" value={earmarkId as any} onChange={(e) => setEarmarkId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— bitte wählen —</option>
                  {earmarks.map(em => (
                    <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
                  ))}
                </select>
                {selectedEarmark?.color && (
                  <div className="helper" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span>Farbe:</span>
                    <span title={selectedEarmark.color || ''} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: selectedEarmark.color || undefined }} />
                  </div>
                )}
              </div>
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label><input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} /> Nur Buchungen ohne Zweckbindung aktualisieren</label>
              </div>
            </>
          )}

          {mode === 'TAGS' && (
            <>
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label>Tags hinzufügen</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(selectedTags || []).map(t => (
                    <span key={t} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {t}
                      <button className="btn" title="Entfernen" onClick={() => removeTag(t)}>×</button>
                    </span>
                  ))}
                </div>
                <input className="input" placeholder="Tags, kommasepariert…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { addTag(tagInput.trim()); setTagInput('') } }} />
                {!!tagDefs.length && (
                  <div className="helper">Vorschläge: {(tagDefs || []).slice(0, 8).map(t => (
                    <button key={t.id} className="btn ghost" onClick={() => addTag(t.name)}>{t.name}</button>
                  ))}</div>
                )}
                <div className="helper">Tipp: Mit Enter hinzufügen. Bereits existierende Tags werden automatisch wiederverwendet.</div>
              </div>
            </>
          )}

          {mode === 'BUDGET' && (
            <>
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label>Budget</label>
                <select className="input" value={budgetId as any} onChange={(e) => setBudgetId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— bitte wählen —</option>
                  {budgets.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / span 2' }}>
                <label><input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} /> Nur Buchungen ohne Budget aktualisieren</label>
              </div>
            </>
          )}

          <div className="card" style={{ gridColumn: '1 / span 2', padding: 10 }}>
            <div className="helper">Betroffene Buchungen: Aktuelle Filter werden angewandt (Suche, Zeitraum, Sphäre, Art, Zahlweg).</div>
            <ul style={{ margin: '6px 0 0 16px' }}>
              {currentFilters.q && <li>Suche: <code>{currentFilters.q}</code></li>}
              {currentFilters.from && currentFilters.to && <li>Zeitraum: {currentFilters.from} – {currentFilters.to}</li>}
              {currentFilters.sphere && <li>Sphäre: {currentFilters.sphere}</li>}
              {currentFilters.type && <li>Art: {currentFilters.type}</li>}
              {currentFilters.paymentMethod && <li>Zahlweg: {currentFilters.paymentMethod}</li>}
              {onlyWithout && mode === 'EARMARK' && <li>Nur ohne bestehende Zweckbindung</li>}
              {onlyWithout && mode === 'BUDGET' && <li>Nur ohne bestehendes Budget</li>}
            </ul>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" disabled={busy || (mode === 'EARMARK' && !earmarkId) || (mode === 'BUDGET' && !budgetId)} onClick={run}>Übernehmen</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BatchEarmarkModal
