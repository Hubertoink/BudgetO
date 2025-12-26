import React from 'react'
import { LocationInfo } from '../types'

interface LocationInfoDisplayProps {
  info: LocationInfo | null
}

/**
 * Extracts last 2 path segments for compact display
 */
function shortPath(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/')
  return parts.slice(-2).join('/')
}

/**
 * LocationInfoDisplay - Compact database location info
 * 
 * Shows location in a compact grid with tooltips for full paths
 */
export function LocationInfoDisplay({ info }: LocationInfoDisplayProps) {
  if (!info) {
    return (
      <div className="storage-location-grid">
        <span className="helper">Lade …</span>
      </div>
    )
  }

  const isCustom = !!info.configuredRoot

  return (
    <div className="storage-location-grid">
      <div className="storage-location-row">
        <span className="storage-location-label">Datenbank</span>
        <code className="storage-location-value" title={info.dbPath}>
          {shortPath(info.dbPath)}
        </code>
      </div>
      <div className="storage-location-row">
        <span className="storage-location-label">Anhänge</span>
        <code className="storage-location-value" title={info.filesDir}>
          {shortPath(info.filesDir)}
        </code>
      </div>
      <div className="storage-location-row">
        <span className="storage-location-label">Modus</span>
        <span className={`storage-location-badge ${isCustom ? 'storage-location-badge-custom' : ''}`}>
          {isCustom ? 'Benutzerdefiniert' : 'Standard'}
        </span>
      </div>
    </div>
  )
}
