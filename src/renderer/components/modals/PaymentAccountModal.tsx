import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type PaymentAccountKind = 'CASH' | 'BANK' | 'PAYPAL' | 'CARD' | 'OTHER'
export type PaymentAccountValue = { id?: number; name: string; kind: PaymentAccountKind; iban?: string | null; color?: string | null; sortOrder?: number; isActive?: number }
const kinds: Record<PaymentAccountKind, string> = { CASH: 'Bar', BANK: 'Bankkonto', PAYPAL: 'PayPal', CARD: 'Karte', OTHER: 'Sonstiges' }
const palette = ['#2962FF', '#00B8D4', '#00C853', '#FFD600', '#FF9100', '#FF3D00', '#F50057', '#7C4DFF', '#9C27B0']

function contrast(color?: string | null) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#fff'
  const n = parseInt(color.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > .6 ? '#111' : '#fff'
}

export default function PaymentAccountModal({ value, onClose, onSaved, notify }: { value: PaymentAccountValue; onClose: () => void; onSaved: () => void; notify: (type: 'success' | 'error' | 'info', text: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const color = draft.color || '#2962FF'
  return createPortal(<div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
    <div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 520 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>💳</span><h2 style={{ margin: 0 }}>{draft.id ? 'Zahlungskonto bearbeiten' : 'Neues Zahlungskonto'}</h2></div><button className="btn ghost" onClick={onClose} aria-label="Schließen">✕</button></header>
      <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, background: `${color}20`, borderLeft: `4px solid ${color}` }}><div style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 10, background: color, color: contrast(color), fontWeight: 700 }}>{(draft.name || '?')[0].toUpperCase()}</div><div><strong>{draft.name || 'Kontoname'}</strong><div className="helper">{kinds[draft.kind]}{draft.iban ? ` · ${draft.iban}` : ''}</div></div></div>
      <div style={{ display: 'grid', gap: 14 }}>
        <label className="field">Name<input className="input" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Girokonto, PayPal, Vereinskasse" autoFocus /></label>
        <div className="row"><label className="field" style={{ flex: 1 }}>Typ<select className="input" value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as PaymentAccountKind })}>{Object.entries(kinds).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field" style={{ flex: 1 }}>Reihenfolge<input className="input" type="number" min="1" value={draft.sortOrder || 1} onChange={event => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label></div>
        <label className="field">IBAN / Kennung (optional)<input className="input" value={draft.iban || ''} onChange={event => setDraft({ ...draft, iban: event.target.value || null })} /></label>
        <div className="field"><label>Farbe</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{palette.map(item => <button type="button" key={item} aria-label={`Farbe ${item}`} onClick={() => setDraft({ ...draft, color: item })} style={{ width: 32, height: 32, borderRadius: 8, background: item, border: color === item ? '3px solid var(--text)' : '2px solid transparent', transform: color === item ? 'scale(1.08)' : undefined, cursor: 'pointer' }} />)}<input type="color" value={color} onChange={event => setDraft({ ...draft, color: event.target.value })} title="Eigene Farbe" style={{ width: 38, height: 32 }} /></div></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={draft.isActive !== 0} onChange={event => setDraft({ ...draft, isActive: event.target.checked ? 1 : 0 })} /> Konto aktiv</label>
      </div>
      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" disabled={!draft.name.trim()} onClick={async () => { try { await window.api!.paymentAccounts.upsert({ ...draft, name: draft.name.trim(), isActive: draft.isActive !== 0 }); onSaved() } catch (error: any) { notify('error', error?.message || 'Speichern fehlgeschlagen.') } }}>Speichern</button></footer>
    </div>
  </div>, document.body)
}
