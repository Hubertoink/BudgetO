import React, { useRef, useState } from 'react'
import FilterDropdown from './FilterDropdown'

interface ColumnOption {
  key: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

interface ColumnSelectDropdownProps {
  /** Column options to display (in order) */
  columns: ColumnOption[]
  /** Optional tip text shown at the bottom */
  tip?: string
  /** Optional: align dropdown to right edge of trigger */
  alignRight?: boolean
  /** Optional: callback when order changes via drag & drop */
  onReorder?: (newOrder: string[]) => void
}

export default function ColumnSelectDropdown({
  columns,
  tip,
  alignRight = false,
  onReorder
}: ColumnSelectDropdownProps) {
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function onDragStart(e: React.DragEvent<HTMLLabelElement>, idx: number) {
    dragIndex.current = idx
    e.dataTransfer.effectAllowed = 'move'
    // Add visual feedback
    const target = e.currentTarget
    setTimeout(() => target.style.opacity = '0.5', 0)
  }

  function onDragEnd(e: React.DragEvent<HTMLLabelElement>) {
    e.currentTarget.style.opacity = '1'
    dragIndex.current = null
    setDragOverIndex(null)
  }

  function onDragOver(e: React.DragEvent<HTMLLabelElement>, idx: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndex.current !== null && dragIndex.current !== idx) {
      setDragOverIndex(idx)
    }
  }

  function onDragLeave() {
    // Small delay to prevent flickering when moving between items
    setTimeout(() => {
      // Only clear if we're not over another valid target
    }, 50)
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>, idx: number) {
    e.preventDefault()
    const from = dragIndex.current
    dragIndex.current = null
    setDragOverIndex(null)
    if (from == null || from === idx || !onReorder) return
    const currentOrder = columns.map(c => c.key)
    const next = currentOrder.slice()
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    onReorder(next)
  }

  // Determine if drop indicator should be above or below the target
  function getDropPosition(targetIdx: number): 'above' | 'below' | null {
    if (dragIndex.current === null || dragOverIndex !== targetIdx) return null
    return dragIndex.current < targetIdx ? 'below' : 'above'
  }

  return (
    <FilterDropdown
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
        </svg>
      }
      title="Spalten auswählen"
      hasActiveFilters={false}
      alignRight={alignRight}
      width={280}
      ariaLabel="Spalten auswählen"
      buttonTitle="Spalten & Anordnung"
      colorVariant="display"
    >
      <div className="column-select-dropdown__list">
        {columns.map((col, idx) => {
          const dropPosition = getDropPosition(idx)
          const isDragging = dragIndex.current === idx
          return (
            <label
              key={col.key}
              className={`column-select-dropdown__item ${onReorder ? 'column-select-dropdown__item--draggable' : ''} ${dropPosition === 'above' ? 'column-select-dropdown__item--drop-above' : ''} ${dropPosition === 'below' ? 'column-select-dropdown__item--drop-below' : ''} ${isDragging ? 'column-select-dropdown__item--dragging' : ''}`}
              draggable={!!onReorder}
              onDragStart={(e) => onDragStart(e, idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, idx)}
            >
              {onReorder && (
                <span className="column-select-dropdown__drag-handle" aria-hidden>☰</span>
              )}
              <input
                type="checkbox"
                checked={col.checked}
                onChange={(e) => col.onChange(e.target.checked)}
              />
              <span>{col.label}</span>
            </label>
          )
        })}
      </div>
      {tip && (
        <div className="column-select-dropdown__tip helper">
          {tip}
        </div>
      )}
    </FilterDropdown>
  )
}
