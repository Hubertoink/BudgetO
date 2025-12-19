import React, { useMemo } from 'react'
import { navItems } from '../../utils/navItems'
import { getNavIcon } from '../../utils/navIcons'
import type { NavKey } from '../../utils/navItems'
import { useModules, MODULE_NAV_MAP } from '../../context/ModuleContext'

interface SideNavProps {
  activePage: NavKey
  onNavigate: (page: NavKey) => void
  navIconColorMode: 'color' | 'mono'
  collapsed: boolean
  onToggleCollapse?: () => void
}

export function SideNav({ activePage, onNavigate, navIconColorMode, collapsed }: SideNavProps) {
  const { enabledModules, loading } = useModules()

  // Filter nav items based on enabled modules
  const visibleNavItems = useMemo(() => {
    if (loading) return navItems // Show all during loading
    
    return navItems.filter(item => {
      // Dashboard, Buchungen, Belege, Reports, Einstellungen are always visible
      const alwaysVisible: NavKey[] = ['Dashboard', 'Buchungen', 'Belege', 'Reports', 'Einstellungen']
      if (alwaysVisible.includes(item.key)) return true
      
      // Check if this nav item's module is enabled
      const moduleForNav = Object.entries(MODULE_NAV_MAP).find(([_, navKey]) => navKey === item.key)
      if (!moduleForNav) return true // No module mapping = always visible
      
      const moduleKey = moduleForNav[0] as keyof typeof MODULE_NAV_MAP
      return enabledModules.includes(moduleKey)
    })
  }, [enabledModules, loading])

  return (
    <nav aria-label="Seitenleiste" className="side-nav">
      {visibleNavItems.map((item, idx) => {
        const isActive = activePage === item.key
        const colorClass = navIconColorMode === 'color' ? `icon-color-${item.key}` : ''
        
        // Check if we need a divider (group changed from previous visible item)
        const prevItem = visibleNavItems[idx - 1]
        const showDivider = idx > 0 && prevItem && item.group !== prevItem.group
        
        return (
          <React.Fragment key={item.key}>
            {showDivider && (
              <div className="nav-divider" aria-hidden="true" />
            )}
            <button
              className={`btn ghost ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              aria-label={item.label}
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, background: isActive ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }}
            >
              <span className={`icon-wrapper ${colorClass}`}>
                {getNavIcon(item.key)}
              </span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
