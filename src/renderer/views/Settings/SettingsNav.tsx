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

  const scrollAnimRef = React.useRef<{ rafId: number | null; targetLeft: number; lastTs: number }>({
    rafId: null,
    targetLeft: 0,
    lastTs: 0,
  })

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

    scrollAnimRef.current.targetLeft = el.scrollLeft

    const update = () => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft
      const rightRemaining = maxScrollLeft - left
      setCanScrollLeft(left > 1)
      setCanScrollRight(rightRemaining > 1)
    }

    const clampLeft = (v: number) => {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      return Math.min(maxScrollLeft, Math.max(0, v))
    }

    const ensureAnimating = () => {
      const state = scrollAnimRef.current
      if (state.rafId != null) return
      state.lastTs = 0
      state.rafId = window.requestAnimationFrame(function step(ts) {
        const s = scrollAnimRef.current
        s.rafId = null

        // If element disappeared, stop.
        if (!tabsRef.current) return

        // Frame-rate independent smoothing.
        const dt = s.lastTs ? Math.min(32, ts - s.lastTs) : 16
        s.lastTs = ts

        const current = el.scrollLeft
        const target = clampLeft(s.targetLeft)

        const diff = target - current
        if (Math.abs(diff) < 0.5) {
          el.scrollLeft = target
          update()
          return
        }

        // Lerp factor: ~0.22 at 60fps, scaled by dt.
        const k = 1 - Math.pow(1 - 0.22, dt / 16)
        el.scrollLeft = current + diff * k
        update()
        ensureAnimating()
      })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })

    // IMPORTANT: We need a non-passive wheel listener so we can preventDefault()
    // and stop the main content from scrolling vertically when the mouse is over the tabs.
    const onWheel = (ev: WheelEvent) => {
      // Only intercept when the tab strip actually overflows horizontally.
      const hasOverflowX = el.scrollWidth > el.clientWidth + 1
      if (!hasOverflowX) return

      // If the device provides horizontal wheel (trackpads), don't interfere.
      const absX = Math.abs(ev.deltaX)
      const absY = Math.abs(ev.deltaY)
      if (absX > absY) return

      // Convert vertical mouse wheel into horizontal scroll.
      if (absY > 0) {
        const state = scrollAnimRef.current
        // Translate wheel delta into target scroll position. Clamp happens in animation step.
        state.targetLeft = clampLeft((state.targetLeft ?? el.scrollLeft) + ev.deltaY)
        ensureAnimating()
        ev.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update())
      ro.observe(el)
    } else {
      window.addEventListener('resize', update)
    }

    return () => {
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', onWheel as any)
      const s = scrollAnimRef.current
      if (s.rafId != null) {
        window.cancelAnimationFrame(s.rafId)
        s.rafId = null
      }
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
