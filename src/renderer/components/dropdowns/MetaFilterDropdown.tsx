import React, { useEffect, useState } from 'react'
import FilterDropdown from './FilterDropdown'

interface MetaFilterDropdownProps {
  budgets: Array<{ id: number; name?: string | null; categoryName?: string | null; projectName?: string | null; year: number }>
  earmarks: Array<{ id: number; code: string; name?: string | null }>
  categories: Array<{ id: number; name: string; color?: string | null }>
  tagDefs: Array<{ id: number; name: string; color?: string | null; usage?: number }>
  // Filter values
  filterType: 'IN' | 'OUT' | 'TRANSFER' | null
  filterPM: 'BAR' | 'BANK' | null
  filterTag: string | null
  categoryId: number | null
  earmarkId: number | null
  budgetId: number | null
  onApply: (v: {
    filterType: 'IN' | 'OUT' | 'TRANSFER' | null
    filterPM: 'BAR' | 'BANK' | null
    filterTag: string | null
    categoryId: number | null
    earmarkId: number | null
    budgetId: number | null
  }) => void
}

export default function MetaFilterDropdown({
  budgets,
  earmarks,
  categories,
  tagDefs,
  filterType,
  filterPM,
  filterTag,
  categoryId,
  earmarkId,
  budgetId,
  onApply
}: MetaFilterDropdownProps) {
  const [type, setType] = useState<'IN' | 'OUT' | 'TRANSFER' | null>(filterType)
  const [pm, setPm] = useState<'BAR' | 'BANK' | null>(filterPM)
  const [tag, setTag] = useState<string | null>(filterTag)
  const [c, setC] = useState<number | null>(categoryId)
  const [e, setE] = useState<number | null>(earmarkId)
  const [b, setB] = useState<number | null>(budgetId)

  // Sync local state when props change
  useEffect(() => {
    setType(filterType)
    setPm(filterPM)
    setTag(filterTag)
    setC(categoryId)
    setE(earmarkId)
    setB(budgetId)
  }, [filterType, filterPM, filterTag, categoryId, earmarkId, budgetId])

  const hasFilters = filterType != null || filterPM != null || filterTag != null || categoryId != null || earmarkId != null || budgetId != null

  const labelForBudget = (bud: { id: number; name?: string | null; categoryName?: string | null; projectName?: string | null; year: number }) =>
    (bud.name && bud.name.trim()) || bud.categoryName || bud.projectName || String(bud.year)

  const handleApply = () => {
    onApply({
      filterType: type,
      filterPM: pm,
      filterTag: tag,
      categoryId: c,
      earmarkId: e,
      budgetId: b
    })
  }

  const handleReset = () => {
    setType(null)
    setPm(null)
    setTag(null)
    setC(null)
    setE(null)
    setB(null)
    onApply({
      filterType: null,
      filterPM: null,
      filterTag: null,
      categoryId: null,
      earmarkId: null,
      budgetId: null
    })
  }

  return (
    <FilterDropdown
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 4h18v2L14 13v6l-4 2v-8L3 6V4z" />
        </svg>
      }
      title="Filter"
      hasActiveFilters={hasFilters}
      alignRight
      width={380}
      ariaLabel="Filter"
      buttonTitle="Filter"
      colorVariant="filter"
    >
      <div className="filter-dropdown__grid">
        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Art</label>
          <select
            className="input"
            value={type ?? ''}
            onChange={(ev) => setType((ev.target.value as any) || null)}
          >
            <option value="">Alle</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
        </div>

        <div className="filter-dropdown__field">
          <label className="filter-dropdown__label">Zahlweg</label>
          <select
            className="input"
            value={pm ?? ''}
            onChange={(ev) => setPm((ev.target.value as any) || null)}
          >
            <option value="">Alle</option>
            <option value="BAR">Bar</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Tag</label>
        <select
          className="input"
          value={tag ?? ''}
          onChange={(ev) => setTag(ev.target.value || null)}
        >
          <option value="">Alle</option>
          {tagDefs.map(t => (
            <option key={t.id} value={t.name}>
              {t.name} {t.usage !== undefined ? `(${t.usage})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__divider" />

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Kategorie</label>
        <select
          className="input"
          value={c ?? ''}
          onChange={(ev) => setC(ev.target.value ? Number(ev.target.value) : null)}
        >
          <option value="">Alle</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Zweckbindung</label>
        <select
          className="input"
          value={e ?? ''}
          onChange={(ev) => setE(ev.target.value ? Number(ev.target.value) : null)}
        >
          <option value="">Alle</option>
          {earmarks.map(em => (
            <option key={em.id} value={em.id}>{em.code} – {em.name || ''}</option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__field">
        <label className="filter-dropdown__label">Budget</label>
        <select
          className="input"
          value={b ?? ''}
          onChange={(ev) => setB(ev.target.value ? Number(ev.target.value) : null)}
        >
          <option value="">Alle</option>
          {budgets.map(bu => (
            <option key={bu.id} value={bu.id}>{labelForBudget(bu)}</option>
          ))}
        </select>
      </div>

      <div className="filter-dropdown__actions">
        <button className="btn" onClick={handleReset}>
          Zurücksetzen
        </button>
        <button className="btn primary" onClick={handleApply}>
          Übernehmen
        </button>
      </div>
    </FilterDropdown>
  )
}
