import React from 'react'
import { createPortal } from 'react-dom'
import ModalHeader from '../../../components/ModalHeader'
import { useAuth } from '../../../context/authHooks'

interface CustomCategory {
  id: number
  name: string
  color: string | null
  description: string | null
  sortOrder: number
  isActive: boolean
  usageCount?: number
}

interface Taxonomy {
  id: number
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  termCount?: number
  usageCount?: number
}

interface Term {
  id: number
  taxonomyId: number
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

const PRESET_COLORS = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
  '#00BCD4', '#E91E63', '#795548', '#607D8B', '#3F51B5'
]

type TabType = 'categories' | number // 'categories' or taxonomy ID

const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  padding: 0,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--text-dim)'
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6c2.35 0 4.28.7 5.84 1.64M21.5 12s-3.5 6-9.5 6c-2.35 0-4.28-.7-5.84-1.64" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7V5.8c0-.99.81-1.8 1.8-1.8h2.4c.99 0 1.8.81 1.8 1.8V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 7l.9 12.2c.07.99.9 1.8 1.9 1.8h4.4c1 0 1.83-.81 1.9-1.8L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * CategoriesPane - Unified Category & Taxonomy Management
 * Uses a tabbed interface to manage categories and user-defined taxonomies
 */
export function CategoriesPane({ notify }: CategoriesPaneProps) {
  const { canWrite } = useAuth()
  
  // Tab state
  const [activeTab, setActiveTab] = React.useState<TabType>('categories')
  
  // Categories state
  const [categories, setCategories] = React.useState<CustomCategory[]>([])
  const [loadingCategories, setLoadingCategories] = React.useState(true)
  const [categoryModal, setCategoryModal] = React.useState<{
    id?: number
    name: string
    color: string
    description: string
  } | null>(null)
  const [categoryDelete, setCategoryDelete] = React.useState<{
    id: number
    name: string
    usageCount: number
  } | null>(null)
  
  // Taxonomies state
  const [taxonomies, setTaxonomies] = React.useState<Taxonomy[]>([])
  const [loadingTaxonomies, setLoadingTaxonomies] = React.useState(true)
  const [taxonomyModal, setTaxonomyModal] = React.useState<{
    id?: number
    name: string
    description: string
  } | null>(null)
  const [taxonomyDelete, setTaxonomyDelete] = React.useState<{
    id: number
    name: string
    usageCount: number
  } | null>(null)
  
  // Terms state (for selected taxonomy)
  const [terms, setTerms] = React.useState<Term[]>([])
  const [loadingTerms, setLoadingTerms] = React.useState(false)
  const [termModal, setTermModal] = React.useState<{
    id?: number
    taxonomyId: number
    name: string
    color: string
    description: string
  } | null>(null)
  const [termDelete, setTermDelete] = React.useState<{
    id: number
    name: string
    usageCount: number
  } | null>(null)
  
  const [saving, setSaving] = React.useState(false)

  // Reset modals when write access changes
  React.useEffect(() => {
    if (!canWrite) {
      setCategoryModal(null)
      setCategoryDelete(null)
      setTaxonomyModal(null)
      setTaxonomyDelete(null)
      setTermModal(null)
      setTermDelete(null)
    }
  }, [canWrite])

  // Load categories
  async function loadCategories() {
    setLoadingCategories(true)
    try {
      const res = await (window as any).api?.customCategories?.list?.({ includeInactive: true, includeUsage: true })
      setCategories(res?.categories || [])
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setLoadingCategories(false)
    }
  }

  // Load taxonomies
  async function loadTaxonomies() {
    setLoadingTaxonomies(true)
    try {
      const res = await (window as any).api?.taxonomies?.list?.({ includeInactive: true, includeCounts: true })
      setTaxonomies(res?.taxonomies || [])
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setLoadingTaxonomies(false)
    }
  }

  // Load terms for a taxonomy
  async function loadTerms(taxonomyId: number) {
    setLoadingTerms(true)
    try {
      const res = await (window as any).api?.taxonomies?.terms?.list?.({ taxonomyId, includeInactive: true, includeUsage: true })
      setTerms(res?.terms || [])
    } catch (e: any) {
      notify('error', e?.message || String(e))
      setTerms([])
    } finally {
      setLoadingTerms(false)
    }
  }

  React.useEffect(() => {
    loadCategories()
    loadTaxonomies()
  }, [])

  // Load terms when switching to a taxonomy tab
  React.useEffect(() => {
    if (typeof activeTab === 'number') {
      loadTerms(activeTab)
    }
  }, [activeTab])

  // Category CRUD
  async function saveCategory() {
    if (!categoryModal || !categoryModal.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    setSaving(true)
    try {
      if (categoryModal.id) {
        await (window as any).api?.customCategories?.update?.({
          id: categoryModal.id,
          name: categoryModal.name.trim(),
          color: categoryModal.color || null,
          description: categoryModal.description.trim() || null
        })
        notify('success', 'Kategorie aktualisiert')
      } else {
        await (window as any).api?.customCategories?.create?.({
          name: categoryModal.name.trim(),
          color: categoryModal.color || null,
          description: categoryModal.description.trim() || null
        })
        notify('success', 'Kategorie erstellt')
      }
      setCategoryModal(null)
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteCategory() {
    if (!categoryDelete) return
    setSaving(true)
    try {
      const res = await (window as any).api?.customCategories?.delete?.({ id: categoryDelete.id })
      const affected = res?.affectedVouchers ?? 0
      notify('success', affected > 0 ? `Kategorie gelöscht. ${affected} Buchung(en) betroffen.` : 'Kategorie gelöscht')
      setCategoryDelete(null)
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleCategoryActive(cat: CustomCategory) {
    try {
      await (window as any).api?.customCategories?.update?.({ id: cat.id, isActive: !cat.isActive })
      notify('success', cat.isActive ? 'Kategorie deaktiviert' : 'Kategorie aktiviert')
      await loadCategories()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // Taxonomy CRUD
  async function saveTaxonomy() {
    if (!taxonomyModal || !taxonomyModal.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    setSaving(true)
    try {
      if (taxonomyModal.id) {
        await (window as any).api?.taxonomies?.update?.({
          id: taxonomyModal.id,
          name: taxonomyModal.name.trim(),
          description: taxonomyModal.description.trim() || null
        })
        notify('success', 'Taxonomie aktualisiert')
      } else {
        await (window as any).api?.taxonomies?.create?.({
          name: taxonomyModal.name.trim(),
          description: taxonomyModal.description.trim() || null
        })
        notify('success', 'Taxonomie erstellt')
      }
      setTaxonomyModal(null)
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTaxonomy() {
    if (!taxonomyDelete) return
    setSaving(true)
    try {
      const res = await (window as any).api?.taxonomies?.delete?.({ id: taxonomyDelete.id })
      const affected = res?.affectedVouchers ?? 0
      notify('success', affected > 0 ? `Taxonomie gelöscht. ${affected} Buchung(en) betroffen.` : 'Taxonomie gelöscht')
      setTaxonomyDelete(null)
      if (activeTab === taxonomyDelete.id) setActiveTab('categories')
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleTaxonomyActive(tx: Taxonomy) {
    try {
      await (window as any).api?.taxonomies?.update?.({ id: tx.id, isActive: !tx.isActive })
      notify('success', tx.isActive ? 'Taxonomie deaktiviert' : 'Taxonomie aktiviert')
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  // Term CRUD
  async function saveTerm() {
    if (!termModal || !termModal.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    setSaving(true)
    try {
      if (termModal.id) {
        await (window as any).api?.taxonomies?.terms?.update?.({
          id: termModal.id,
          name: termModal.name.trim(),
          color: termModal.color || null,
          description: termModal.description.trim() || null
        })
        notify('success', 'Begriff aktualisiert')
      } else {
        await (window as any).api?.taxonomies?.terms?.create?.({
          taxonomyId: termModal.taxonomyId,
          name: termModal.name.trim(),
          color: termModal.color || null,
          description: termModal.description.trim() || null
        })
        notify('success', 'Begriff erstellt')
      }
      const tid = termModal.taxonomyId
      setTermModal(null)
      await loadTerms(tid)
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTerm() {
    if (!termDelete || typeof activeTab !== 'number') return
    setSaving(true)
    try {
      const res = await (window as any).api?.taxonomies?.terms?.delete?.({ id: termDelete.id })
      const affected = res?.affectedVouchers ?? 0
      notify('success', affected > 0 ? `Begriff gelöscht. ${affected} Buchung(en) betroffen.` : 'Begriff gelöscht')
      setTermDelete(null)
      await loadTerms(activeTab)
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleTermActive(term: Term) {
    try {
      await (window as any).api?.taxonomies?.terms?.update?.({ id: term.id, isActive: !term.isActive })
      notify('success', term.isActive ? 'Begriff deaktiviert' : 'Begriff aktiviert')
      if (typeof activeTab === 'number') await loadTerms(activeTab)
      await loadTaxonomies()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      notify('error', e?.message || String(e))
    }
  }

  const selectedTaxonomy = typeof activeTab === 'number' ? taxonomies.find(t => t.id === activeTab) : null

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Tabbed Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {/* Categories Tab */}
        <button
          type="button"
          className={`btn ${activeTab === 'categories' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('categories')}
          style={{
            borderRadius: '8px 8px 0 0',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            marginBottom: -2,
            borderBottom: activeTab === 'categories' ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>📂</span>
          <span>Kategorien</span>
          <span className="chip chip-count" style={{ fontSize: 10, marginLeft: 4 }}>{categories.length}</span>
        </button>

        {/* Taxonomy Tabs */}
        {taxonomies.map(tx => (
          <button
            key={tx.id}
            type="button"
            className={`btn ${activeTab === tx.id ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab(tx.id)}
            style={{
              borderRadius: '8px 8px 0 0',
              marginBottom: -2,
              borderBottom: activeTab === tx.id ? '2px solid var(--accent)' : '2px solid transparent',
              opacity: tx.isActive ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>🏷️</span>
            <span>{tx.name}</span>
            <span className="chip chip-count" style={{ fontSize: 10, marginLeft: 4 }}>{tx.termCount ?? 0}</span>
          </button>
        ))}

        {/* Add Taxonomy Button */}
        {canWrite && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTaxonomyModal({ name: '', description: '' })}
            title="Neue Taxonomie erstellen"
            style={{ borderRadius: '8px 8px 0 0', marginBottom: -2, padding: '6px 10px' }}
          >
            <span style={{ fontSize: 16 }}>+</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' ? (
        /* Categories Content */
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div className="helper" style={{ maxWidth: 600 }}>
              Definiere eigene Kategorien für Buchungen. Diese ersetzen die festen Sphären und erlauben eine flexible thematische Einteilung.
            </div>
            {canWrite && (
              <button
                type="button"
                className="btn primary"
                onClick={() => setCategoryModal({ name: '', color: '#4CAF50', description: '' })}
                style={{ whiteSpace: 'nowrap' }}
              >
                + Neue Kategorie
              </button>
            )}
          </div>

          {/* Categories Grid */}
          {loadingCategories ? (
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
            <div className="categories-card-grid">
              {categories.map(cat => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  canWrite={canWrite}
                  onEdit={() => setCategoryModal({ id: cat.id, name: cat.name, color: cat.color || '#4CAF50', description: cat.description || '' })}
                  onDelete={() => setCategoryDelete({ id: cat.id, name: cat.name, usageCount: cat.usageCount ?? 0 })}
                  onToggle={() => toggleCategoryActive(cat)}
                />
              ))}
            </div>
          )}
        </div>
      ) : selectedTaxonomy ? (
        /* Taxonomy Content */
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Taxonomy Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 15 }}>{selectedTaxonomy.name}</strong>
                {!selectedTaxonomy.isActive && (
                  <span className="chip" style={{ background: 'var(--muted)', fontSize: 10 }}>Deaktiviert</span>
                )}
              </div>
              {selectedTaxonomy.description && (
                <div className="helper">{selectedTaxonomy.description}</div>
              )}
              <div className="helper" style={{ marginTop: 4, fontSize: 11 }}>
                {(selectedTaxonomy.usageCount ?? 0) === 0 ? 'Nicht verwendet' : `${selectedTaxonomy.usageCount} Buchung(en)`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canWrite && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setTaxonomyModal({ id: selectedTaxonomy.id, name: selectedTaxonomy.name, description: selectedTaxonomy.description || '' })}
                    title="Taxonomie bearbeiten"
                  >
                    ✎ Bearbeiten
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => toggleTaxonomyActive(selectedTaxonomy)}
                    title={selectedTaxonomy.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    aria-label={selectedTaxonomy.isActive ? 'Taxonomie deaktivieren' : 'Taxonomie aktivieren'}
                    style={iconButtonStyle}
                  >
                    {selectedTaxonomy.isActive ? <IconEye /> : <IconEyeOff />}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setTaxonomyDelete({ id: selectedTaxonomy.id, name: selectedTaxonomy.name, usageCount: selectedTaxonomy.usageCount ?? 0 })}
                    title="Taxonomie löschen"
                    aria-label="Taxonomie löschen"
                    style={iconButtonStyle}
                  >
                    <IconTrash />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Terms Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="helper">
              Begriffe definieren die Auswahl-Optionen für diese Taxonomie. Buchungen können einen Begriff pro Taxonomie zugeordnet bekommen.
            </div>
            {canWrite && (
              <button
                type="button"
                className="btn primary"
                onClick={() => setTermModal({ taxonomyId: selectedTaxonomy.id, name: '', color: '#4CAF50', description: '' })}
                style={{ whiteSpace: 'nowrap' }}
              >
                + Neuer Begriff
              </button>
            )}
          </div>

          {/* Terms Grid */}
          {loadingTerms ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="helper">Lädt Begriffe...</div>
            </div>
          ) : terms.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏷️</div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Noch keine Begriffe vorhanden</div>
              <div className="helper">Füge Begriffe hinzu, um diese Taxonomie in Buchungen verwenden zu können.</div>
            </div>
          ) : (
            <div className="categories-card-grid">
              {terms.map(term => (
                <TermCard
                  key={term.id}
                  term={term}
                  canWrite={canWrite}
                  onEdit={() => setTermModal({ id: term.id, taxonomyId: term.taxonomyId, name: term.name, color: term.color || '#4CAF50', description: term.description || '' })}
                  onDelete={() => setTermDelete({ id: term.id, name: term.name, usageCount: term.usageCount ?? 0 })}
                  onToggle={() => toggleTermActive(term)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="helper">Wähle einen Tab aus.</div>
        </div>
      )}

      {/* Category Create/Edit Modal */}
      {categoryModal && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setCategoryModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title={categoryModal.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'} onClose={() => setCategoryModal(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div className="field">
                <label>Name *</label>
                <input
                  className="input"
                  value={categoryModal.name}
                  onChange={e => setCategoryModal({ ...categoryModal, name: e.target.value })}
                  placeholder="z. B. Verwaltung, Sport, Kultur"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Beschreibung</label>
                <input
                  className="input"
                  value={categoryModal.description}
                  onChange={e => setCategoryModal({ ...categoryModal, description: e.target.value })}
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
                      onClick={() => setCategoryModal({ ...categoryModal, color })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: color,
                        border: categoryModal.color === color ? '3px solid var(--text)' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={categoryModal.color || '#4CAF50'}
                    onChange={e => setCategoryModal({ ...categoryModal, color: e.target.value })}
                    style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    title="Eigene Farbe"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setCategoryModal(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn primary" onClick={saveCategory} disabled={saving || !categoryModal.name.trim()}>
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Category Delete Modal */}
      {categoryDelete && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setCategoryDelete(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title="Kategorie löschen?" onClose={() => setCategoryDelete(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du "{categoryDelete.name}" wirklich löschen?
                </div>
                {categoryDelete.usageCount > 0 && (
                  <div style={{ padding: 12, background: '#F4433615', borderRadius: 8, border: '1px solid #F4433640' }}>
                    <div style={{ color: '#F44336', fontWeight: 600 }}>
                      ⚠️ {categoryDelete.usageCount} Buchung(en) betroffen
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setCategoryDelete(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn danger" onClick={confirmDeleteCategory} disabled={saving}>
                  {saving ? 'Lösche...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Taxonomy Create/Edit Modal */}
      {taxonomyModal && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setTaxonomyModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title={taxonomyModal.id ? 'Taxonomie bearbeiten' : 'Neue Taxonomie'} onClose={() => setTaxonomyModal(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div className="field">
                <label>Name *</label>
                <input
                  className="input"
                  value={taxonomyModal.name}
                  onChange={e => setTaxonomyModal({ ...taxonomyModal, name: e.target.value })}
                  placeholder="z. B. Projekt, Förderprogramm, Zielgruppe"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Beschreibung</label>
                <input
                  className="input"
                  value={taxonomyModal.description}
                  onChange={e => setTaxonomyModal({ ...taxonomyModal, description: e.target.value })}
                  placeholder="Optional…"
                />
              </div>
              <div className="helper" style={{ padding: 12, background: 'color-mix(in oklab, var(--accent) 10%, transparent)', borderRadius: 8 }}>
                💡 Taxonomien erscheinen als eigene Tabs und sind in den Buchungsmodalen auswählbar, sobald mindestens ein Begriff definiert ist.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setTaxonomyModal(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn primary" onClick={saveTaxonomy} disabled={saving || !taxonomyModal.name.trim()}>
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Taxonomy Delete Modal */}
      {taxonomyDelete && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setTaxonomyDelete(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title="Taxonomie löschen?" onClose={() => setTaxonomyDelete(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du "{taxonomyDelete.name}" wirklich löschen?
                </div>
                {taxonomyDelete.usageCount > 0 && (
                  <div style={{ padding: 12, background: '#F4433615', borderRadius: 8, border: '1px solid #F4433640' }}>
                    <div style={{ color: '#F44336', fontWeight: 600 }}>
                      ⚠️ {taxonomyDelete.usageCount} Buchung(en) betroffen
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setTaxonomyDelete(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn danger" onClick={confirmDeleteTaxonomy} disabled={saving}>
                  {saving ? 'Lösche...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Term Create/Edit Modal */}
      {termModal && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setTermModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title={termModal.id ? 'Begriff bearbeiten' : 'Neuer Begriff'} onClose={() => setTermModal(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
              <div className="field">
                <label>Name *</label>
                <input
                  className="input"
                  value={termModal.name}
                  onChange={e => setTermModal({ ...termModal, name: e.target.value })}
                  placeholder="z. B. Projekt Alpha, Fördertopf 2025"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Beschreibung</label>
                <input
                  className="input"
                  value={termModal.description}
                  onChange={e => setTermModal({ ...termModal, description: e.target.value })}
                  placeholder="Optional…"
                />
              </div>
              <div className="field">
                <label>Farbe</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTermModal({ ...termModal, color })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: color,
                        border: termModal.color === color ? '3px solid var(--text)' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={termModal.color || '#4CAF50'}
                    onChange={e => setTermModal({ ...termModal, color: e.target.value })}
                    style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    title="Eigene Farbe"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setTermModal(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn primary" onClick={saveTerm} disabled={saving || !termModal.name.trim()}>
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Term Delete Modal */}
      {termDelete && canWrite && createPortal(
        <div className="modal-overlay" onClick={() => setTermDelete(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <ModalHeader title="Begriff löschen?" onClose={() => setTermDelete(null)} />
            <div style={{ display: 'grid', gap: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Möchtest du "{termDelete.name}" wirklich löschen?
                </div>
                {termDelete.usageCount > 0 && (
                  <div style={{ padding: 12, background: '#F4433615', borderRadius: 8, border: '1px solid #F4433640' }}>
                    <div style={{ color: '#F44336', fontWeight: 600 }}>
                      ⚠️ {termDelete.usageCount} Buchung(en) betroffen
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setTermDelete(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="btn danger" onClick={confirmDeleteTerm} disabled={saving}>
                  {saving ? 'Lösche...' : 'Löschen'}
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

/* Category Card Component */
function CategoryCard({
  category,
  canWrite,
  onEdit,
  onDelete,
  onToggle
}: {
  category: CustomCategory
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const bgColor = category.color ? `${category.color}15` : 'var(--surface)'
  const borderColor = category.color || 'var(--border)'
  return (
    <div
      className="card"
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: canWrite ? '40px minmax(0, 1fr) auto' : '40px minmax(0, 1fr)',
        alignItems: 'start',
        columnGap: 12,
        background: bgColor,
        borderLeft: `4px solid ${borderColor}`,
        opacity: category.isActive ? 1 : 0.6
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: category.color || 'var(--muted)',
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
        {category.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, wordBreak: 'break-word' }}>{category.name}</span>
          {!category.isActive && (
            <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--muted)', borderRadius: 4 }}>Deaktiviert</span>
          )}
        </div>
        {category.description && (
          <div className="helper" style={{ fontSize: 11, marginTop: 2 }}>{category.description}</div>
        )}
        <div className="helper" style={{ fontSize: 11, marginTop: 4 }}>
          {(category.usageCount ?? 0) === 0 ? 'Nicht verwendet' : `${category.usageCount} Buchung(en)`}
        </div>
      </div>
      {canWrite && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignSelf: 'center' }}>
          <button type="button" className="btn ghost" onClick={onToggle} title={category.isActive ? 'Deaktivieren' : 'Aktivieren'} aria-label={category.isActive ? 'Kategorie deaktivieren' : 'Kategorie aktivieren'} style={iconButtonStyle}>
            {category.isActive ? <IconEye /> : <IconEyeOff />}
          </button>
          <button type="button" className="btn btn-edit" onClick={onEdit} title="Bearbeiten" aria-label="Kategorie bearbeiten">✎</button>
          <button type="button" className="btn ghost" onClick={onDelete} title="Löschen" aria-label="Kategorie löschen" style={iconButtonStyle}><IconTrash /></button>
        </div>
      )}
    </div>
  )
}

/* Term Card Component */
function TermCard({
  term,
  canWrite,
  onEdit,
  onDelete,
  onToggle
}: {
  term: Term
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const bgColor = term.color ? `${term.color}15` : 'var(--surface)'
  const borderColor = term.color || 'var(--border)'
  return (
    <div
      className="card"
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: canWrite ? '36px minmax(0, 1fr) auto' : '36px minmax(0, 1fr)',
        alignItems: 'start',
        columnGap: 12,
        background: bgColor,
        borderLeft: `4px solid ${borderColor}`,
        opacity: term.isActive ? 1 : 0.6
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: term.color || 'var(--muted)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}
      >
        {term.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, wordBreak: 'break-word' }}>{term.name}</span>
          {!term.isActive && (
            <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--muted)', borderRadius: 4 }}>Deaktiviert</span>
          )}
        </div>
        {term.description && (
          <div className="helper" style={{ fontSize: 11, marginTop: 2 }}>{term.description}</div>
        )}
        <div className="helper" style={{ fontSize: 11, marginTop: 4 }}>
          {(term.usageCount ?? 0) === 0 ? 'Nicht verwendet' : `${term.usageCount} Buchung(en)`}
        </div>
      </div>
      {canWrite && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignSelf: 'center' }}>
          <button type="button" className="btn ghost" onClick={onToggle} title={term.isActive ? 'Deaktivieren' : 'Aktivieren'} aria-label={term.isActive ? 'Begriff deaktivieren' : 'Begriff aktivieren'} style={iconButtonStyle}>
            {term.isActive ? <IconEye /> : <IconEyeOff />}
          </button>
          <button type="button" className="btn btn-edit" onClick={onEdit} title="Bearbeiten" aria-label="Begriff bearbeiten">✎</button>
          <button type="button" className="btn ghost" onClick={onDelete} title="Löschen" aria-label="Begriff löschen" style={iconButtonStyle}><IconTrash /></button>
        </div>
      )}
    </div>
  )
}
