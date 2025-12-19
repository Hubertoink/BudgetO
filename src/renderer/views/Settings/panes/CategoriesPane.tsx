import React from 'react'
import { createPortal } from 'react-dom'
import ModalHeader from '../../../components/ModalHeader'

interface CustomCategory {
  id: number
  name: string
  color: string | null
  description: string | null
  sortOrder: number
  isActive: boolean
  usageCount?: number
}

interface CategoriesPaneProps {
  notify: (type: 'success' | 'error', message: string) => void
}

/**
 * CategoriesPane - Custom Category Management
 * Allows users to define their own categories to replace the fixed Sphären system.
 * Shows usage counts and warns before deleting categories with associated vouchers.
 */
export function CategoriesPane({ notify }: CategoriesPaneProps) {
  const [categories, setCategories] = React.useState<CustomCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editModal, setEditModal] = React.useState<{
    id?: number
    name: string
    color: string
    description: string
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    id: number
    name: string
    usageCount: number
  } | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function loadCategories() {
    setLoading(true)
    try {
      const res = await (window as any).api?.customCategories?.list?.({ includeInactive: true, includeUsage: true })
      setCategories(res?.categories || [])
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadCategories()
  }, [])

  async function saveCategory() {
    if (!editModal || !editModal.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    setSaving(true)
    try {
      if (editModal.id) {
        await (window as any).api?.customCategories?.update?.({
          id: editModal.id,
          name: editModal.name.trim(),
          color: editModal.color || null,
          description: editModal.description.trim() || null
        })
        notify('success', 'Kategorie aktualisiert')
      } else {
        await (window as any).api?.customCategories?.create?.({
          name: editModal.name.trim(),
          color: editModal.color || null,
          description: editModal.description.trim() || null
        })
        notify('success', 'Kategorie erstellt')
      }
      setEditModal(null)
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setSaving(true)
    try {
      const res = await (window as any).api?.customCategories?.delete?.({ id: deleteConfirm.id })
      if (res?.affectedVouchers > 0) {
        notify('success', `Kategorie gelöscht. ${res.affectedVouchers} Buchung(en) betroffen.`)
      } else {
        notify('success', 'Kategorie gelöscht')
      }
      setDeleteConfirm(null)
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(cat: CustomCategory) {
    try {
      await (window as any).api?.customCategories?.update?.({
        id: cat.id,
        isActive: !cat.isActive
      })
      notify('success', cat.isActive ? 'Kategorie deaktiviert' : 'Kategorie aktiviert')
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const PRESET_COLORS = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
    '#00BCD4', '#E91E63', '#795548', '#607D8B', '#3F51B5'
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📂</span>
            <strong style={{ fontSize: 16 }}>Kategorien</strong>
            <span className="chip" style={{ marginLeft: 8, fontSize: 11 }}>{categories.length}</span>
          </div>
          <div className="helper">
            Definiere eigene Kategorien für Buchungen. Diese ersetzen die festen Sphären (Ideell, Zweck, etc.) 
            und erlauben eine flexible Einteilung nach deinen Bedürfnissen.
          </div>
        </div>
        <button 
          className="btn primary" 
          onClick={() => setEditModal({ name: '', color: '#4CAF50', description: '' })} 
          style={{ whiteSpace: 'nowrap' }}
        >
          + Neue Kategorie
        </button>
      </div>

      {/* Info Box */}
      <div className="card" style={{ padding: 12, background: 'color-mix(in oklab, var(--accent) 10%, transparent)', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span>💡</span>
          <div className="helper" style={{ fontSize: 12 }}>
            <strong>Hinweis:</strong> Kategorien können Buchungen zugeordnet werden, um sie thematisch zu gruppieren. 
            Beim Löschen einer Kategorie werden die betroffenen Buchungen nicht gelöscht – die Kategorie-Zuordnung wird nur entfernt.
          </div>
        </div>
      </div>

      {/* Categories List */}
      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="helper">Lädt Kategorien...</div>
        </div>
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Noch keine Kategorien vorhanden</div>
          <div className="helper">Erstelle deine erste Kategorie mit dem Button oben.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {categories.map(cat => {
            const bgColor = cat.color ? `${cat.color}15` : 'var(--surface)'
            const borderColor = cat.color || 'var(--border)'
            return (
              <div 
                key={cat.id} 
                className="card"
                style={{ 
                  padding: 14, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  background: bgColor,
                  borderLeft: `4px solid ${borderColor}`,
                  opacity: cat.isActive ? 1 : 0.6
                }}
              >
                {/* Color indicator */}
                <div 
                  style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 8, 
                    background: cat.color || 'var(--muted)', 
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 16,
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }} 
                >
                  {cat.name.charAt(0).toUpperCase()}
                </div>
                
                {/* Name, description and usage */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                    {!cat.isActive && (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--muted)', borderRadius: 4 }}>
                        Deaktiviert
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <div className="helper" style={{ fontSize: 11, marginTop: 2 }}>{cat.description}</div>
                  )}
                  <div className="helper" style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: (cat.usageCount ?? 0) > 0 ? '#4CAF50' : 'var(--border)' 
                    }} />
                    {(cat.usageCount ?? 0) === 0 
                      ? 'Nicht verwendet' 
                      : `${cat.usageCount} Buchung${(cat.usageCount ?? 0) !== 1 ? 'en' : ''}`
                    }
                  </div>
                </div>
                
                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button 
                    className="btn ghost" 
                    onClick={() => toggleActive(cat)}
                    title={cat.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    style={{ padding: '6px 8px', fontSize: 12 }}
                  >
                    {cat.isActive ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button 
                    className="btn ghost" 
                    onClick={() => setEditModal({
                      id: cat.id,
                      name: cat.name,
                      color: cat.color || '#4CAF50',
                      description: cat.description || ''
                    })} 
                    title="Bearbeiten"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                  >
                    ✏️
                  </button>
                  <button 
                    className="btn ghost" 
                    onClick={() => setDeleteConfirm({ id: cat.id, name: cat.name, usageCount: cat.usageCount ?? 0 })} 
                    title="Löschen"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editModal && createPortal(
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <ModalHeader 
              title={editModal.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'} 
              onClose={() => setEditModal(null)} 
            />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div className="field">
                <label>Name *</label>
                <input 
                  className="input"
                  value={editModal.name}
                  onChange={e => setEditModal({ ...editModal, name: e.target.value })}
                  placeholder="z. B. Verwaltung, Sport, Kultur"
                  autoFocus
                />
              </div>
              
              <div className="field">
                <label>Beschreibung</label>
                <input 
                  className="input"
                  value={editModal.description}
                  onChange={e => setEditModal({ ...editModal, description: e.target.value })}
                  placeholder="Optionale Beschreibung..."
                />
              </div>
              
              <div className="field">
                <label>Farbe</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditModal({ ...editModal, color })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: color,
                        border: editModal.color === color ? '3px solid var(--text)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease'
                      }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={editModal.color || '#4CAF50'}
                    onChange={e => setEditModal({ ...editModal, color: e.target.value })}
                    style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    title="Eigene Farbe wählen"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="field">
                <label>Vorschau</label>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '8px 12px', 
                  background: `${editModal.color}20`,
                  borderLeft: `4px solid ${editModal.color}`,
                  borderRadius: 6
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: editModal.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 12
                  }}>
                    {(editModal.name || 'K').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 500 }}>{editModal.name || 'Kategoriename'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn ghost" onClick={() => setEditModal(null)} disabled={saving}>
                  Abbrechen
                </button>
                <button className="btn primary" onClick={saveCategory} disabled={saving || !editModal.name.trim()}>
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title="Kategorie löschen?" onClose={() => setDeleteConfirm(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du die Kategorie "{deleteConfirm.name}" wirklich löschen?
                </div>
                {deleteConfirm.usageCount > 0 ? (
                  <div style={{ 
                    padding: 12, 
                    background: '#F4433615', 
                    borderRadius: 8, 
                    border: '1px solid #F4433640',
                    marginTop: 8
                  }}>
                    <div style={{ color: '#F44336', fontWeight: 600 }}>
                      ⚠️ {deleteConfirm.usageCount} Buchung{deleteConfirm.usageCount !== 1 ? 'en' : ''} betroffen
                    </div>
                    <div className="helper" style={{ marginTop: 4 }}>
                      Die Kategorie-Zuordnung wird entfernt. Die Buchungen selbst bleiben erhalten.
                    </div>
                  </div>
                ) : (
                  <div className="helper">
                    Diese Kategorie wird von keiner Buchung verwendet.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn ghost" onClick={() => setDeleteConfirm(null)} disabled={saving}>
                  Abbrechen
                </button>
                <button className="btn danger" onClick={confirmDelete} disabled={saving}>
                  {saving ? 'Löschen...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
