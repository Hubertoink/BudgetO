import React, { useState, useEffect } from 'react'
import FilterDropdown from './FilterDropdown'

export interface BatchAssignDropdownProps {
  earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
  tagDefs: Array<{ id: number; name: string; color?: string | null }>
  budgets: Array<{ id: number; label: string }>
  currentFilters: {
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    from?: string
    to?: string
    q?: string
    earmarkId?: number
    budgetId?: number
    tag?: string
  }
  useCategoriesModule?: boolean
  onApplied: (updated: number) => void
  notify?: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}

type Mode = 'EARMARK' | 'TAGS' | 'BUDGET' | 'CATEGORY' | 'TAXONOMY'

export default function BatchAssignDropdown({
  earmarks,
  tagDefs,
  budgets,
  currentFilters,
  useCategoriesModule,
  onApplied,
  notify
}: BatchAssignDropdownProps) {
  const [mode, setMode] = useState<Mode>('EARMARK')
  const [earmarkId, setEarmarkId] = useState<number | ''>('')
  const [onlyWithout, setOnlyWithout] = useState<boolean>(false)
  const [tagInput, setTagInput] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [budgetId, setBudgetId] = useState<number | ''>('')
  const [categoryIdToAssign, setCategoryIdToAssign] = useState<number | ''>('')
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [taxonomies, setTaxonomies] = useState<Array<{ id: number; name: string }>>([])
  const [taxonomyId, setTaxonomyId] = useState<number | null>(null)
  const [taxonomyTerms, setTaxonomyTerms] = useState<Array<{ id: number; name: string }>>([])
  const [taxonomyTermId, setTaxonomyTermId] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [affectedCount, setAffectedCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState<boolean>(false)

  const addTag = (t: string) => {
    const v = (t || '').trim()
    if (!v) return
    if (!selectedTags.some(x => x.toLowerCase() === v.toLowerCase())) {
      setSelectedTags(prev => [...prev, v])
    }
  }

  const removeTag = (name: string) => {
    setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== name.toLowerCase()))
  }

  // Load affected count
  useEffect(() => {
    (async () => {
      setLoadingCount(true)
      try {
        const res = await (window as any).api?.vouchers?.list?.({
          limit: 1,
          offset: 0,
          ...currentFilters
        })
        setAffectedCount(res?.total ?? 0)
      } catch {
        setAffectedCount(null)
      } finally {
        setLoadingCount(false)
      }
    })()
  }, [currentFilters])

  // Load categories
  useEffect(() => {
    if (!useCategoriesModule) {
      setCategories([])
      return
    }
    ;(async () => {
      try {
        const res = await (window as any).api?.customCategories?.list?.({ includeInactive: false })
        setCategories((res?.categories || []) as Array<{ id: number; name: string }>)
      } catch {
        setCategories([])
      }
    })()
  }, [useCategoriesModule])

  // Load taxonomies
  useEffect(() => {
    ;(async () => {
      try {
        const res = await (window as any).api?.taxonomies?.list?.({ includeInactive: false })
        setTaxonomies((res?.taxonomies || []) as Array<{ id: number; name: string }>)
      } catch {
        setTaxonomies([])
      }
    })()
  }, [])

  // Load taxonomy terms
  useEffect(() => {
    if (taxonomyId == null) {
      setTaxonomyTerms([])
      return
    }
    ;(async () => {
      try {
        const res = await (window as any).api?.taxonomies?.terms?.list?.({ taxonomyId, includeInactive: false })
        setTaxonomyTerms((res?.terms || []) as Array<{ id: number; name: string }>)
      } catch {
        setTaxonomyTerms([])
      }
    })()
  }, [taxonomyId])

  async function run() {
    try {
      setBusy(true)
      if (mode === 'EARMARK') {
        if (!earmarkId) { notify?.('error', 'Bitte eine Zweckbindung wählen'); return }
        const payload: any = { ...currentFilters, earmarkId: Number(earmarkId) }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignEarmark?.(payload)
        onApplied(res?.updated ?? 0)
      } else if (mode === 'TAGS') {
        const tags = selectedTags.length ? selectedTags : (tagInput || '').split(',').map(s => s.trim()).filter(Boolean)
        if (!tags.length) { notify?.('error', 'Bitte mindestens einen Tag angeben'); return }
        const res = await (window as any).api?.vouchers.batchAssignTags?.({ tags, ...currentFilters })
        onApplied(res?.updated ?? 0)
      } else if (mode === 'BUDGET') {
        if (!budgetId) { notify?.('error', 'Bitte ein Budget wählen'); return }
        const payload: any = { ...currentFilters, budgetId: Number(budgetId) }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignBudget?.(payload)
        onApplied(res?.updated ?? 0)
      } else if (mode === 'CATEGORY') {
        if (!categoryIdToAssign) { notify?.('error', 'Bitte eine Kategorie wählen'); return }
        const payload: any = { ...currentFilters, categoryIdToAssign: Number(categoryIdToAssign) }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignCategory?.(payload)
        onApplied(res?.updated ?? 0)
      } else if (mode === 'TAXONOMY') {
        if (!taxonomyId) { notify?.('error', 'Bitte eine Taxonomie wählen'); return }
        if (!taxonomyTermId) { notify?.('error', 'Bitte einen Begriff wählen'); return }
        const payload: any = { ...currentFilters, taxonomyId: Number(taxonomyId), termId: Number(taxonomyTermId) }
        if (onlyWithout) payload.onlyWithout = true
        const res = await (window as any).api?.vouchers.batchAssignTaxonomyTerm?.(payload)
        onApplied(res?.updated ?? 0)
      }
      // Reset form
      setEarmarkId('')
      setBudgetId('')
      setCategoryIdToAssign('')
      setSelectedTags([])
      setTagInput('')
      setTaxonomyTermId('')
      setOnlyWithout(false)
    } catch (e: any) {
      notify?.('error', e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const canApply = (() => {
    if (busy || loadingCount) return false
    if (mode === 'EARMARK' && !earmarkId) return false
    if (mode === 'BUDGET' && !budgetId) return false
    if (mode === 'CATEGORY' && !categoryIdToAssign) return false
    if (mode === 'TAXONOMY' && (!taxonomyId || !taxonomyTermId)) return false
    if (mode === 'TAGS') {
      const tags = selectedTags.length ? selectedTags : (tagInput || '').split(',').map(s => s.trim()).filter(Boolean)
      if (!tags.length) return false
    }
    return true
  })()

  const selectedTaxonomy = taxonomies.find(t => t.id === taxonomyId)

  return (
    <FilterDropdown
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="10" width="18" height="4" rx="1" />
          <rect x="3" y="16" width="18" height="4" rx="1" />
        </svg>
      }
      title="Batch zuweisen"
      hasActiveFilters={false}
      alignRight
      tooltipAlign="left"
      width={420}
      ariaLabel="Batch zuweisen"
      buttonTitle="Batch zuweisen"
      colorVariant="action"
    >
      {/* Mode selector */}
      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Was zuweisen?</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            className={`btn btn-sm ${mode === 'EARMARK' ? 'primary' : ''}`}
            onClick={() => { setMode('EARMARK'); setOnlyWithout(false) }}
          >
            Zweckbindung
          </button>
          <button
            className={`btn btn-sm ${mode === 'TAGS' ? 'primary' : ''}`}
            onClick={() => { setMode('TAGS'); setOnlyWithout(false) }}
          >
            Tags
          </button>
          <button
            className={`btn btn-sm ${mode === 'BUDGET' ? 'primary' : ''}`}
            onClick={() => { setMode('BUDGET'); setOnlyWithout(false) }}
          >
            Budget
          </button>
          {useCategoriesModule && (
            <button
              className={`btn btn-sm ${mode === 'CATEGORY' ? 'primary' : ''}`}
              onClick={() => { setMode('CATEGORY'); setOnlyWithout(false) }}
            >
              Kategorie
            </button>
          )}
          {taxonomies.map(tx => (
            <button
              key={tx.id}
              className={`btn btn-sm ${mode === 'TAXONOMY' && taxonomyId === tx.id ? 'primary' : ''}`}
              onClick={() => {
                setMode('TAXONOMY')
                setOnlyWithout(false)
                setTaxonomyId(tx.id)
                setTaxonomyTermId('')
              }}
            >
              {tx.name}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-dropdown__divider" />

      {/* Earmark mode */}
      {mode === 'EARMARK' && (
        <>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Zweckbindung</label>
            <select
              className="input"
              value={earmarkId as any}
              onChange={(e) => setEarmarkId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— bitte wählen —</option>
              {earmarks.map(em => (
                <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
              ))}
            </select>
          </div>
          <label className="filter-dropdown__checkbox">
            <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} />
            <span>Nur Buchungen ohne Zweckbindung</span>
          </label>
        </>
      )}

      {/* Tags mode */}
      {mode === 'TAGS' && (
        <>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Tags hinzufügen</label>
            {selectedTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {selectedTags.map(t => {
                  const def = tagDefs.find(td => td.name.toLowerCase() === t.toLowerCase())
                  return (
                    <span
                      key={t}
                      className="chip"
                      style={{ background: def?.color || undefined, color: def?.color ? '#fff' : undefined }}
                    >
                      {t}
                      <button className="chip-x" onClick={() => removeTag(t)}>×</button>
                    </span>
                  )
                })}
              </div>
            )}
            <input
              className="input"
              placeholder="Tags, kommasepariert…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  addTag(tagInput.trim())
                  setTagInput('')
                }
              }}
            />
          </div>
          {tagDefs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {tagDefs.slice(0, 8).map(t => (
                <button
                  key={t.id}
                  className="btn btn-sm"
                  onClick={() => addTag(t.name)}
                  style={{ background: t.color || undefined, color: t.color ? '#fff' : undefined }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Budget mode */}
      {mode === 'BUDGET' && (
        <>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Budget</label>
            <select
              className="input"
              value={budgetId as any}
              onChange={(e) => setBudgetId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— bitte wählen —</option>
              {budgets.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>
          <label className="filter-dropdown__checkbox">
            <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} />
            <span>Nur Buchungen ohne Budget</span>
          </label>
        </>
      )}

      {/* Category mode */}
      {mode === 'CATEGORY' && (
        <>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">Kategorie</label>
            <select
              className="input"
              value={categoryIdToAssign as any}
              onChange={(e) => setCategoryIdToAssign(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— bitte wählen —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="filter-dropdown__checkbox">
            <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} />
            <span>Nur Buchungen ohne Kategorie</span>
          </label>
        </>
      )}

      {/* Taxonomy mode */}
      {mode === 'TAXONOMY' && (
        <>
          <div className="filter-dropdown__field">
            <label className="filter-dropdown__label">{selectedTaxonomy?.name || 'Begriff'}</label>
            <select
              className="input"
              value={taxonomyTermId as any}
              onChange={(e) => setTaxonomyTermId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— bitte wählen —</option>
              {taxonomyTerms.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <label className="filter-dropdown__checkbox">
            <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} />
            <span>Nur Buchungen ohne {selectedTaxonomy?.name || 'Wert'}</span>
          </label>
        </>
      )}

      {/* Affected count info */}
      <div className="filter-dropdown__info">
        {loadingCount
          ? 'Lade …'
          : affectedCount !== null
          ? `${affectedCount} Buchung(en) betroffen`
          : '—'}
      </div>

      <div className="filter-dropdown__actions" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={run} disabled={!canApply} style={{ minWidth: 100 }}>
          {busy ? 'Läuft …' : 'Zuweisen'}
        </button>
      </div>
    </FilterDropdown>
  )
}
