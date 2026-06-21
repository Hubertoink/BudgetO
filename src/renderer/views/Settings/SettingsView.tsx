import React, { useMemo, useState, useEffect } from 'react'
import { SettingsProps, TileKey } from './types'
import { SettingsNav } from './SettingsNav'
import { GeneralPane } from './panes/GeneralPane'
import { TablePane } from './panes/TablePane'
import { StoragePane } from './panes/StoragePane'
import { ImportPane } from './panes/ImportPane'
import { OrgPane } from './panes/OrgPane'
import { TagsPane } from './panes/TagsPane'
import { CategoriesPane } from './panes/CategoriesPane'
import { ModulesPane } from './panes/ModulesPane'
import { CashCheckPane } from './panes/CashCheckPane'
import { UsersPane } from './panes/UsersPane'
import { ServerPane } from './panes/ServerPane'
import { YearEndPane } from './panes/YearEndPane'
import { UpdatePane } from './panes/UpdatePane'
import { useAuth } from '../../context/authHooks'
import { useModules } from '../../context/moduleHooks'

/**
 * SettingsView - Main Settings Container
 * 
 * Refactored from App.tsx to improve maintainability
 * Uses tile-based navigation to switch between settings categories
 * Persists last visited pane in sessionStorage
 */
export function SettingsView(props: SettingsProps) {
  const { isReadonly } = useAuth()
  const { isModuleEnabled, loading: modulesLoading } = useModules()
  const importEnabled = isModuleEnabled('excel-import')
  const cashCheckEnabled = isModuleEnabled('cash-check')
  const [activeTile, setActiveTile] = useState<TileKey>(() => {
    try {
      const saved = sessionStorage.getItem('settingsActiveTile')
      return (saved as TileKey) || 'general'
    } catch {
      return 'general'
    }
  })

  const [appVersion, setAppVersion] = useState<string>('')

  const visibleTiles = useMemo(() => {
    const all: Array<{ key: TileKey; icon: string; label: string }> = [
      { key: 'general', icon: '🖼️', label: 'Darstellung' },
      { key: 'table', icon: '📋', label: 'Tabelle' },
      { key: 'modules', icon: '🧩', label: 'Module' },
      { key: 'cashCheck', icon: '🔎', label: 'Kassenprüfung' },
      { key: 'users', icon: '👥', label: 'Benutzer' },
      { key: 'server', icon: '🌐', label: 'Netzwerk' },
      { key: 'storage', icon: '💾', label: 'Speicher & Backup' },
      { key: 'updates', icon: '⬆️', label: 'Updates' },
      { key: 'import', icon: '📥', label: 'Import' },
      { key: 'org', icon: '🏢', label: 'Sachgebiet' },
      { key: 'tags', icon: '🏷️', label: 'Tags' },
      { key: 'categories', icon: '📁', label: 'Kategorien' },
      { key: 'yearEnd', icon: '📊', label: 'Jahresabschluss' },
    ]
    const withModuleGates = modulesLoading
      ? all
      : all
          .filter((t) => t.key !== 'import' || importEnabled)
          .filter((t) => t.key !== 'cashCheck' || cashCheckEnabled)
    if (!isReadonly) return withModuleGates
    const hidden = new Set<TileKey>(['users', 'server', 'storage', 'import', 'yearEnd', 'cashCheck'])
    return withModuleGates.filter(t => !hidden.has(t.key))
  }, [cashCheckEnabled, importEnabled, isReadonly, modulesLoading])

  useEffect(() => {
    if (modulesLoading) return
    const allowed = new Set(visibleTiles.map(t => t.key))
    if (!allowed.has(activeTile)) {
      setActiveTile(visibleTiles[0]?.key ?? 'general')
    }
  }, [activeTile, modulesLoading, visibleTiles])

  useEffect(() => {
    try {
      sessionStorage.setItem('settingsActiveTile', activeTile)
    } catch {
      // ignore
    }
  }, [activeTile])

  useEffect(() => {
    function onSelectTile(ev: Event) {
      try {
        const detail = (ev as CustomEvent<any>)?.detail || {}
        const tile = detail?.tile as TileKey | undefined
        if (tile) setActiveTile(tile)
        const year = Number(detail?.year)
        if (Number.isFinite(year) && year > 1900) {
          try { sessionStorage.setItem('yearEnd.prefillYear', String(year)) } catch { /* ignore */ }
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('settings:selectTile' as any, onSelectTile as any)
    return () => window.removeEventListener('settings:selectTile' as any, onSelectTile as any)
  }, [])

  useEffect(() => {
    ;(window.api as any).app.version()
      .then((res: any) => setAppVersion(res?.version || ''))
      .catch(() => setAppVersion(''))
  }, [])

  return (
    <div className="settings-container">
      <h1>Einstellungen</h1>
      
      <SettingsNav active={activeTile} onSelect={setActiveTile} tiles={visibleTiles} />
      
      <div className="settings-content">
        {activeTile === 'general' && (
          <GeneralPane
            navLayout={props.navLayout}
            setNavLayout={props.setNavLayout}
            sidebarCollapsed={props.sidebarCollapsed}
            setSidebarCollapsed={props.setSidebarCollapsed}
            navIconColorMode={props.navIconColorMode}
            setNavIconColorMode={props.setNavIconColorMode}
            colorTheme={props.colorTheme}
            setColorTheme={props.setColorTheme}
            backgroundImage={props.backgroundImage}
            setBackgroundImage={props.setBackgroundImage}
            customBackgroundImage={props.customBackgroundImage}
            setCustomBackgroundImage={props.setCustomBackgroundImage}
            journalRowStyle={props.journalRowStyle}
            setJournalRowStyle={props.setJournalRowStyle}
            journalRowDensity={props.journalRowDensity}
            setJournalRowDensity={props.setJournalRowDensity}
            glassModals={props.glassModals}
            setGlassModals={props.setGlassModals}
            backgroundContrast={props.backgroundContrast}
            setBackgroundContrast={props.setBackgroundContrast}
            modalBackdropBlur={props.modalBackdropBlur}
            setModalBackdropBlur={props.setModalBackdropBlur}
            showBookingDraftTabs={props.showBookingDraftTabs}
            setShowBookingDraftTabs={props.setShowBookingDraftTabs}
            showBookingEditTabs={props.showBookingEditTabs}
            setShowBookingEditTabs={props.setShowBookingEditTabs}
            bookingsOpenDetached={props.bookingsOpenDetached}
            setBookingsOpenDetached={props.setBookingsOpenDetached}
            dateFmt={props.dateFmt}
            setDateFmt={props.setDateFmt}
            journalLimit={props.journalLimit}
            setJournalLimit={props.setJournalLimit}
            notify={props.notify}
            bumpDataVersion={props.bumpDataVersion}
            openSetupWizard={props.openSetupWizard}
          />
        )}
        
        {activeTile === 'table' && (
          <TablePane
            cols={props.cols}
            setCols={props.setCols}
            order={props.order}
            setOrder={props.setOrder}
            defaultCols={props.defaultCols}
            defaultOrder={props.defaultOrder}
            journalLimit={props.journalLimit}
            setJournalLimit={props.setJournalLimit}
            labelForCol={props.labelForCol}
          />
        )}
        
        {activeTile === 'storage' && (
          <StoragePane
            notify={props.notify}
            bumpDataVersion={props.bumpDataVersion}
          />
        )}

        {activeTile === 'updates' && <UpdatePane />}
        
  {activeTile === 'import' && importEnabled && <ImportPane notify={props.notify} />}

  {activeTile === 'org' && <OrgPane notify={props.notify} />}
        
        {activeTile === 'tags' && (
          <TagsPane
            tagDefs={props.tagDefs}
            setTagDefs={props.setTagDefs}
            notify={props.notify}
            bumpDataVersion={props.bumpDataVersion}
            openTagsManager={props.openTagsManager}
          />
        )}

        {activeTile === 'categories' && (
          <CategoriesPane notify={props.notify} />
        )}

        {activeTile === 'modules' && (
          <ModulesPane notify={props.notify} />
        )}

        {activeTile === 'cashCheck' && (
          <CashCheckPane notify={props.notify} bumpDataVersion={props.bumpDataVersion} />
        )}

        {activeTile === 'users' && (
          <UsersPane notify={props.notify} />
        )}

        {activeTile === 'server' && (
          <ServerPane notify={props.notify} />
        )}
        
        {activeTile === 'yearEnd' && (
          <YearEndPane
            notify={props.notify}
            bumpDataVersion={props.bumpDataVersion}
          />
        )}
      </div>

      {/* Developer Badge - edge anchored handle; panel retracts on mouse leave */}
      <DevBadge appVersion={appVersion} />
    </div>
  )
}

function DevBadge({ appVersion }: { appVersion: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="about-flyout" onMouseLeave={() => setOpen(false)}>
      <div
        className={open ? 'card about-flyout__panel is-open' : 'card about-flyout__panel'}
        role="dialog"
        aria-hidden={!open}
        aria-modal="false"
      >
        <div className="about-flyout__header">
          <div className="about-flyout__title">BudgetO</div>
          {appVersion ? <span className="chip">v{appVersion}</span> : null}
        </div>
        <div className="helper">
          erstellt von{' '}
          <a href="mailto:hubertoink@outlook.com" className="about-flyout__link" title="hubertoink@outlook.com">
            Hubertoink
          </a>
        </div>
        <div className="helper about-flyout__meta">© 2025</div>
      </div>

      <button
        type="button"
        className="about-flyout__handle"
        aria-label={open ? 'Info schließen' : 'Info anzeigen'}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(!open)}
      >
        i
      </button>
    </div>
  )
}
