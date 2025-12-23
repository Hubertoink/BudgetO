import React, { useMemo } from 'react'
import { navItems } from '../../utils/navItems'
import { getNavIcon } from '../../utils/navIcons'
import type { NavKey } from '../../utils/navItems'
import { useModules } from '../../context/moduleHooks'
import { useAuth } from '../../context/authHooks'

interface TopNavProps {
  activePage: NavKey
  onNavigate: (page: NavKey) => void
  navIconColorMode: 'color' | 'mono'
  openInvoicesCount?: number
}

export function TopNav({ activePage, onNavigate, navIconColorMode, openInvoicesCount = 0 }: TopNavProps) {
  const { isModuleEnabled } = useModules()
  const { canAccessSettings } = useAuth()
  
  // Filter nav items based on module enabled status
  const visibleItems = useMemo(() => {
    return navItems.filter(item => {
      if (item.key === 'Einstellungen' && !canAccessSettings) return false
      // If no moduleKey, always show
      if (!item.moduleKey) return true
      // Otherwise, check if module is enabled
      return isModuleEnabled(item.moduleKey)
    })
  }, [isModuleEnabled, canAccessSettings])

  return (
    <nav aria-label="Hauptmenü (oben)" className="top-nav">
      {visibleItems.map((item, idx) => {
        const isActive = activePage === item.key
        const colorClass = navIconColorMode === 'color' ? `icon-color-${item.key}` : ''
        const showDividerBefore = idx > 0 && item.group !== visibleItems[idx - 1]?.group
        const showBadge = item.key === 'Verbindlichkeiten' && openInvoicesCount > 0
        const badgeText = openInvoicesCount > 99 ? '99+' : String(openInvoicesCount)
        
        return (
          <React.Fragment key={item.key}>
            {showDividerBefore && (
              <span className="divider-v" aria-hidden="true" />
            )}
            <button
              className={`btn ghost nav-btn has-tooltip ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              data-tooltip={item.label}
            >
              <span className={colorClass}>
                {getNavIcon(item.key)}
              </span>
              {showBadge && (
                <span className="nav-badge" aria-label={`${openInvoicesCount} offen`}>{badgeText}</span>
              )}
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
