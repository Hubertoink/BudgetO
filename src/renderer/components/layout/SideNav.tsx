import React, { useMemo } from 'react'
import { navItems } from '../../utils/navItems'
import { getNavIcon } from '../../utils/navIcons'
import type { NavKey } from '../../utils/navItems'
import { useModules } from '../../context/ModuleContext'

interface SideNavProps {
  activePage: NavKey
  onNavigate: (page: NavKey) => void
  navIconColorMode: 'color' | 'mono'
  collapsed: boolean
  onToggleCollapse?: () => void
  openInvoicesCount?: number
}

export function SideNav({ activePage, onNavigate, navIconColorMode, collapsed, openInvoicesCount = 0 }: SideNavProps) {
  const { isModuleEnabled } = useModules()
  
  // Filter nav items based on module enabled status
  const visibleItems = useMemo(() => {
    return navItems.filter(item => {
      // If no moduleKey, always show
      if (!item.moduleKey) return true
      // Otherwise, check if module is enabled
      return isModuleEnabled(item.moduleKey)
    })
  }, [isModuleEnabled])

  return (
    <nav aria-label="Seitenleiste" className="side-nav">
      {visibleItems.map((item, idx) => {
        const isActive = activePage === item.key
        const colorClass = navIconColorMode === 'color' ? `icon-color-${item.key}` : ''
        const showBadge = item.key === 'Verbindlichkeiten' && openInvoicesCount > 0
        const badgeText = openInvoicesCount > 99 ? '99+' : String(openInvoicesCount)
        
        return (
          <React.Fragment key={item.key}>
            {idx > 0 && item.group !== visibleItems[idx - 1]?.group && (
              <div className="nav-divider" aria-hidden="true" />
            )}
            <button
              className={`btn ghost nav-btn has-tooltip tooltip-right ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              data-tooltip={item.label}
            >
              <span className={`icon-wrapper ${colorClass}`}>
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
