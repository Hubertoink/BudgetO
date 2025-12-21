import React from 'react'
import { TileKey } from './types'

interface SettingsNavProps {
  active: TileKey
  onSelect: (key: TileKey) => void
  tiles?: Array<{ key: TileKey; icon: string; label: string }>
}

/**
 * SettingsNav - Tile-based Navigation for Settings
 * 
 * File tab (Aktenreiter) layout for switching between settings categories
 */
export function SettingsNav({ active, onSelect, tiles }: SettingsNavProps) {
  const tabsRef = React.useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const defaultTiles: Array<{ key: TileKey; icon: string; label: string }> = [
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

  const visibleTiles = (tiles ?? defaultTiles)

  React.useEffect(() => {
    const el = tabsRef.current
    if (!el) return

    const update = () => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft
      const rightRemaining = maxScrollLeft - left
      setCanScrollLeft(left > 1)
      setCanScrollRight(rightRemaining > 1)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update())
      ro.observe(el)
    } else {
      window.addEventListener('resize', update)
    }

    return () => {
      el.removeEventListener('scroll', update)
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', update)
    }
  }, [visibleTiles.length])

  return (
    <div
      className={
        `settings-tabs-wrap` +
        (canScrollLeft ? ' can-scroll-left' : '') +
        (canScrollRight ? ' can-scroll-right' : '')
      }
    >
      <div className="settings-tabs" ref={tabsRef}>
        {visibleTiles.map((tile) => (
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
      <div className="settings-tabs-fade settings-tabs-fade-left" aria-hidden="true" />
      <div className="settings-tabs-fade settings-tabs-fade-right" aria-hidden="true" />
    </div>
  )
}
