import React, { useMemo, useState } from 'react'

// Local contrast text helper to ensure readable tag chips
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

export default function TagsEditor({ label, value, onChange, tagDefs, className }: { label?: string; value: string[]; onChange: (v: string[]) => void; tagDefs: Array<{ id: number; name: string; color?: string | null }>; className?: string }) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const sugg = useMemo(() => {
    const q = input.trim().toLowerCase()
    const existing = new Set((value || []).map(v => v.toLowerCase()))
    return (tagDefs || []).filter(t => !existing.has((t.name || '').toLowerCase()) && (!q || t.name.toLowerCase().includes(q))).slice(0, 8)
  }, [input, tagDefs, value])
  function addTag(name: string) {
    const n = (name || '').trim()
    if (!n) return
    if (!(value || []).includes(n)) onChange([...(value || []), n])
    setInput('')
  }
  function removeTag(name: string) {
    onChange((value || []).filter(v => v !== name))
  }
  const colorFor = (name: string) => (tagDefs || []).find(t => (t.name || '').toLowerCase() === (name || '').toLowerCase())?.color
  return (
    <div className={`field ${className || ''}`.trim()} style={{ gridColumn: '1 / span 2' }}>
      {label && <label>{label}</label>}
      <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 34 }}>
        {(value || []).map((t) => {
          const bg = colorFor(t) || undefined
          const fg = contrastText(bg)
          return (
            <span key={t} className="chip" style={{ background: bg, color: bg ? fg : undefined }}>
              {t}
              <button className="chip-x" onClick={() => removeTag(t)} aria-label={`Tag ${t} entfernen`} type="button">×</button>
            </span>
          )
        })}
        {/* Quick add via dropdown */}
        <select
          className="input"
          value=""
          onChange={(e) => { const name = e.target.value; if (name) addTag(name) }}
          style={{ minWidth: 140 }}
          title="Tag aus Liste hinzufügen"
        >
          <option value="">+ Tag auswählen…</option>
          {(tagDefs || []).filter(t => !(value || []).some(v => v.toLowerCase() === (t.name || '').toLowerCase())).map(t => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
            if (e.key === 'Backspace' && !input && (value || []).length) { removeTag((value || [])[value.length - 1]) }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={(value || []).length ? '' : 'Tag hinzufügen…'}
          style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }}
        />
      </div>
      {focused && sugg.length > 0 && (
        <div className="card" style={{ padding: 6, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sugg.map(s => {
            const bg = s.color || undefined
            const fg = contrastText(bg)
            return <button key={s.id} type="button" className="btn" style={{ background: bg, color: bg ? fg : undefined }} onClick={() => addTag(s.name)}>{s.name}</button>
          })}
        </div>
      )}
    </div>
  )
}
