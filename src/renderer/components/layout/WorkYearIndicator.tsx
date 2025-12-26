import React from 'react'
import { useArchiveSettings } from '../../hooks/useArchiveSettings'

interface WorkYearIndicatorProps {
  onNavigateToSettings?: () => void
  disabled?: boolean
}

/**
 * Displays a small indicator when archive mode is active (showArchived = false).
 * Shows the current work year and navigates to settings on click.
 */
export function WorkYearIndicator({ onNavigateToSettings, disabled }: WorkYearIndicatorProps) {
  const { workYear, showArchived, loading } = useArchiveSettings()

  if (loading) return null

  // Only show indicator when archive mode is active (blank slate)
  if (showArchived) return null

  const handleClick = () => {
    if (disabled) return
    if (onNavigateToSettings) {
      onNavigateToSettings()
    }
  }

  return (
    <button
      className="work-year-indicator"
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      title={disabled ? `Arbeitsjahr ${workYear} – im Client-Modus nicht änderbar` : `Arbeitsjahr ${workYear} – Klicken für Einstellungen`}
      aria-label={`Arbeitsjahr ${workYear}, Archiv ausgeblendet`}
    >
      <span className="work-year-badge">{workYear}</span>
      <span className="work-year-label">Arbeitsjahr</span>
    </button>
  )
}
