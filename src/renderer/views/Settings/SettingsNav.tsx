import React from 'react'
import { TileKey } from './types'

interface SettingsNavProps {
  active: TileKey
  onSelect: (key: TileKey) => void
}

/**
 * SettingsNav - Tile-based Navigation for Settings
 * 
 * File tab (Aktenreiter) layout for switching between settings categories
 */
export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  const tiles: Array<{ key: TileKey; icon: string; label: string }> = [
    { key: 'general', icon: '🖼️', label: 'Darstellung' },
    { key: 'table', icon: '📋', label: 'Tabelle' },
    { key: 'modules', icon: '🧩', label: 'Module' },
    { key: 'users', icon: '👥', label: 'Benutzer' },
    { key: 'server', icon: '🌐', label: 'Netzwerk' },
    { key: 'storage', icon: '💾', label: 'Speicher & Backup' },
    { key: 'import', icon: '📥', label: 'Import' },
    { key: 'org', icon: '🏢', label: 'Sachgebiet' },
    { key: 'tags', icon: '🏷️', label: 'Tags' },
    { key: 'categories', icon: '📁', label: 'Kategorien' },
    { key: 'yearEnd', icon: '📊', label: 'Jahresabschluss' },
  ]

  return (
    <div className="settings-tabs">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          className={`settings-tab ${active === tile.key ? 'active' : ''}`}
          onClick={() => onSelect(tile.key)}
          aria-current={active === tile.key ? 'page' : undefined}
        >
          <span className="settings-tab-icon" aria-hidden="true">
            {tile.icon}
          </span>
          <span>{tile.label}</span>
        </button>
      ))}
    </div>
  )
}
