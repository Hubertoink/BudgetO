import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useArchiveSettings } from '../../hooks/useArchiveSettings'

interface WorkYearIndicatorProps {
  yearsAvail?: number[]
  onNavigateToSettings?: () => void
  disabled?: boolean
}

export function WorkYearIndicator({ yearsAvail = [], onNavigateToSettings, disabled }: WorkYearIndicatorProps) {
  const { workYear, showArchived, loading, reload } = useArchiveSettings()
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const selectableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const merged = Array.from(new Set<number>([currentYear, ...yearsAvail]))
      .filter((year) => Number.isFinite(year) && year > 1900)
      .sort((a, b) => b - a)
    return merged
  }, [yearsAvail])

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openMenu = () => {
    clearCloseTimer()
    setMenuOpen(true)
  }

  const closeMenuSoon = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      closeTimerRef.current = null
    }, 140)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  if (loading) return null

  const updateWorkYear = async (nextYear: number) => {
    if (disabled || saving || !Number.isFinite(nextYear) || nextYear <= 1900) return
    setSaving(true)
    try {
      await window.api?.settings?.set?.({ key: 'ui.workYear', value: nextYear })
      window.dispatchEvent(new Event('ui-archive-settings-changed'))
      window.dispatchEvent(new Event('data-changed'))
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const toggleArchived = async () => {
    if (disabled || saving) return
    const next = !showArchived
    setSaving(true)
    try {
      await window.api?.settings?.set?.({ key: 'ui.showArchived', value: next })
      window.dispatchEvent(new Event('ui-archive-settings-changed'))
      window.dispatchEvent(new Event('data-changed'))
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const archiveLabel = showArchived ? 'Archiv: ein' : 'Archiv: aus'
  const titleText = disabled
    ? `Arbeitsjahr ${workYear} – im Client-Modus nicht änderbar`
    : `Arbeitsjahr ${workYear} – ${archiveLabel}`

  return (
    <div
      className={`work-year-indicator ${menuOpen ? 'is-open' : ''}`}
      data-archive-mode={showArchived ? 'all' : 'workyear'}
      title={titleText}
      aria-label={`Arbeitsjahr ${workYear}, ${archiveLabel}`}
      onMouseEnter={openMenu}
      onMouseLeave={closeMenuSoon}
      onFocusCapture={openMenu}
      onBlurCapture={(event) => {
        const nextFocused = event.relatedTarget as Node | null
        if (nextFocused && event.currentTarget.contains(nextFocused)) return
        closeMenuSoon()
      }}
    >
      <span className="work-year-badge">{workYear}</span>
      <span className="work-year-label">Arbeitsjahr</span>

      <div className="work-year-menu" role="tooltip" aria-label="Arbeitsjahr und Archiv">
        <div className="work-year-menu__section">
          <label className="work-year-menu__label">Arbeitsjahr</label>
          <select
            className="input work-year-menu__select"
            value={workYear}
            disabled={disabled || saving || selectableYears.length <= 1}
            onChange={(event) => void updateWorkYear(Number(event.target.value))}
            title="Arbeitsjahr wechseln"
          >
            {selectableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="work-year-menu__section">
          <button
            className={`toggle-switch ${showArchived ? 'active' : ''}`}
            role="switch"
            aria-checked={showArchived}
            onClick={() => void toggleArchived()}
            disabled={disabled || saving}
            title="Archiv anzeigen oder ausblenden"
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span>Archiv anzeigen</span>
          </button>
        </div>

        {!disabled && onNavigateToSettings && (
          <button className="btn ghost work-year-menu__settings" onClick={onNavigateToSettings}>
            Jahresabschluss öffnen
          </button>
        )}
      </div>
    </div>
  )
}
