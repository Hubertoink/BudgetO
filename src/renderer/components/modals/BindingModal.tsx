import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Local contrast helper (kept self-contained)
function contrastText(bg?: string | null) {
  if (!bg) return '#000'
  const m = /^#?([0-9a-fA-F]{6})$/.exec(bg.trim())
  if (!m) return '#000'
  const hex = m[1]
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#000' : '#fff'
}

const EARMARK_PALETTE = ['#7C4DFF', '#2962FF', '#00B8D4', '#00C853', '#AEEA00', '#FFD600', '#FF9100', '#FF3D00', '#F50057', '#9C27B0']

export type BindingModalValue = {
  id?: number
  code: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  isActive?: boolean
  color?: string | null
  budget?: number | null
}

export default function BindingModal({ value, onClose, onSaved }: { value: BindingModalValue; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(value)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [draftColor, setDraftColor] = useState<string>(value.color || '#00C853')
  const [draftError, setDraftError] = useState<string>('')
  const [askDelete, setAskDelete] = useState(false)
  useEffect(() => { setV(value); setDraftColor(value.color || '#00C853'); setDraftError(''); setAskDelete(false) }, [value])

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{v.id ? 'Zweckbindung bearbeiten' : 'Zweckbindung anlegen'}</h2>
          <button className="btn danger" onClick={onClose}>Schließen</button>
        </header>
        <div className="row">
          <div className="field">
            <label>Code</label>
            <input className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
          </div>
          <div className="field">
            <label>Name</label>
            <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: '1 / span 2' }}>
            <label>Beschreibung</label>
            <input className="input" value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Von</label>
            <input className="input" type="date" value={v.startDate ?? ''} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} />
          </div>
          <div className="field">
            <label>Bis</label>
            <input className="input" type="date" value={v.endDate ?? ''} onChange={(e) => setV({ ...v, endDate: e.target.value || null })} />
          </div>
          <div className="field">
            <label>Status</label>
            <select className="input" value={(v.isActive ?? true) ? '1' : '0'} onChange={(e) => setV({ ...v, isActive: e.target.value === '1' })}>
              <option value="1">aktiv</option>
              <option value="0">inaktiv</option>
            </select>
          </div>
          <div className="field">
            <label>Budget (€)</label>
            <input className="input" type="number" step="0.01" value={(v.budget ?? '') as any}
              onChange={(e) => {
                const val = e.target.value
                setV({ ...v, budget: val === '' ? null : Number(val) })
              }} />
          </div>
          <div className="field" style={{ gridColumn: '1 / span 2' }}>
            <label>Farbe</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EARMARK_PALETTE.map((c) => (
                <button key={c} type="button" className="btn" onClick={() => setV({ ...v, color: c })} title={c} style={{ padding: 0, width: 28, height: 28, borderRadius: 6, border: v.color === c ? '2px solid var(--text)' : '2px solid transparent', background: c }}>
                  <span aria-hidden="true" />
                </button>
              ))}
              <button type="button" className="btn" onClick={() => setShowColorPicker(true)} title="Eigene Farbe" style={{ height: 28, background: v.color || 'var(--muted)', color: v.color ? contrastText(v.color) : 'var(--text)' }}>
                Eigene…
              </button>
              <button type="button" className="btn" onClick={() => setV({ ...v, color: null })} title="Keine Farbe" style={{ height: 28 }}>Keine</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <div>
            {!!v.id && (
              <button className="btn danger" onClick={() => setAskDelete(true)}>🗑 Löschen</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Abbrechen</button>
            <button className="btn primary" onClick={async () => { await (window as any).api?.bindings.upsert?.(v as any); onSaved(); onClose() }}>Speichern</button>
          </div>
        </div>
      </div>
      {askDelete && v.id && (
        <div className="modal-overlay" onClick={() => setAskDelete(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Zweckbindung löschen</h3>
              <button className="btn ghost" onClick={() => setAskDelete(false)} aria-label="Schließen">✕</button>
            </div>
            <div>Möchtest du die Zweckbindung <strong>{v.code}</strong> – {v.name} wirklich löschen?</div>
            <div className="helper">Hinweis: Die Zuordnung bestehender Buchungen bleibt erhalten; es wird nur die Zweckbindung entfernt.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setAskDelete(false)}>Abbrechen</button>
              <button className="btn danger" onClick={async () => { await (window as any).api?.bindings.delete?.({ id: v.id as number }); setAskDelete(false); onSaved(); onClose() }}>Ja, löschen</button>
            </div>
          </div>
        </div>
      )}
      {showColorPicker && (
        <div className="modal-overlay" onClick={() => setShowColorPicker(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Eigene Farbe wählen</h3>
              <button className="btn ghost" onClick={() => setShowColorPicker(false)} aria-label="Schließen">✕</button>
            </div>
            <div className="row">
              <div className="field">
                <label>Picker</label>
                <input type="color" value={draftColor} onChange={(e) => { setDraftColor(e.target.value); setDraftError('') }} style={{ width: 60, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent' }} />
              </div>
              <div className="field">
                <label>HEX</label>
                <input className="input" value={draftColor} onChange={(e) => { setDraftColor(e.target.value); setDraftError('') }} placeholder="#00C853" />
                {draftError && <div className="helper" style={{ color: 'var(--danger)' }}>{draftError}</div>}
              </div>
            </div>
            <div className="card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: draftColor, border: '1px solid var(--border)' }} />
              <div className="helper">Kontrast: <span style={{ background: draftColor, color: contrastText(draftColor), padding: '2px 6px', borderRadius: 6 }}>{contrastText(draftColor)}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowColorPicker(false)}>Abbrechen</button>
              <button className="btn primary" onClick={() => {
                const hex = draftColor.trim()
                const ok = /^#([0-9a-fA-F]{6})$/.test(hex)
                if (!ok) { setDraftError('Bitte gültigen HEX-Wert eingeben (z. B. #00C853)'); return }
                setV({ ...v, color: hex })
                setShowColorPicker(false)
              }}>Übernehmen</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
