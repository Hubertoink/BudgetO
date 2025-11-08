import React from 'react'
import { TagsPaneProps } from '../types'

/**
 * TagsPane - Tag Management
 * Displays existing tags with usage counts and allows opening the global tag manager.
 */
export function TagsPane({ tagDefs, setTagDefs, notify, openTagsManager, bumpDataVersion }: TagsPaneProps) {
  // Simple add tag inline (delegates to modal in future phase)
  const [newTag, setNewTag] = React.useState('')
  const [color, setColor] = React.useState<string>('')
  const [busy, setBusy] = React.useState(false)

  async function createTag() {
    const name = (newTag || '').trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await window.api?.tags?.upsert?.({ name, color: color || undefined })
      if (res?.id) {
        const exists = tagDefs.some(t => t.id === res.id || t.name.toLowerCase() === name.toLowerCase())
        notify('success', `Tag ${exists ? 'aktualisiert' : 'angelegt'}: ${name}`)
        setTagDefs(prev => {
          if (exists) return prev.map(t => t.id === res.id ? { ...t, color: color || null, name } : t)
          return [...prev, { id: res.id, name, color: color || null, usage: 0 }]
        })
        setNewTag(''); setColor('')
        bumpDataVersion()
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally { setBusy(false) }
  }

  async function deleteTag(id: number) {
    if (!window.confirm('Tag wirklich löschen?')) return
    try {
      const res = await window.api?.tags?.delete?.({ id })
      if (res?.id) {
        setTagDefs(prev => prev.filter(t => t.id !== id))
        notify('success', 'Tag gelöscht')
        bumpDataVersion()
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>Tags</strong>
        <div className="helper">Verwalte Farben & Namen. Tags färben Buchungszeilen zur schnelleren visuellen Orientierung.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={openTagsManager}>Tags-Manager öffnen…</button>
      </div>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field">
            <label>Neuer Tag</label>
            <input className="input" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Name" />
          </div>
          <div className="field">
            <label>Farbe (optional)</label>
            <input className="input" value={color} onChange={e => setColor(e.target.value)} placeholder="#RRGGBB" />
          </div>
          <button className="btn primary" disabled={busy || !newTag.trim()} onClick={createTag}>Anlegen</button>
        </div>
        <div className="helper">Bestehende Tags:</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {tagDefs.length === 0 && <div className="helper">Keine Tags vorhanden.</div>}
          {tagDefs.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t.color && <span style={{ width: 16, height: 16, borderRadius: 4, background: t.color }} title={t.color} />}
                <strong>{t.name}</strong>
              </span>
              <span className="helper" style={{ marginLeft: 'auto' }}>Verwendung: {t.usage ?? 0}</span>
              <button className="btn ghost" onClick={() => deleteTag(t.id)} title="Löschen">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
