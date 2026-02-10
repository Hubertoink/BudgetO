import { useMemo, useRef } from 'react'
import { useModules } from '../../../context/moduleHooks'
import type { ModuleInfo, ModuleKey } from '../../../context/moduleTypes'
import { useAuth } from '../../../context/authHooks'
import { navItems } from '../../../utils/navItems'

/**
 * ModulesPane - Settings pane for enabling/disabling BudgetO modules
 */
export function ModulesPane({ notify }: { notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void }) {
  const { canWrite } = useAuth()
  const { modules, loading, setModuleEnabled } = useModules()
  const paneRef = useRef<HTMLDivElement | null>(null)

  const captureAndRestoreScroll = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const scrollEl = (paneRef.current?.closest('.app-main') as HTMLElement | null) || (document.querySelector('.app-main') as HTMLElement | null)
    const before = scrollEl?.scrollTop ?? 0
    try {
      return await fn()
    } finally {
      if (!scrollEl) return
      // Restore after React has a chance to commit layout changes.
      requestAnimationFrame(() => {
        scrollEl.scrollTop = before
        requestAnimationFrame(() => {
          scrollEl.scrollTop = before
        })
      })
    }
  }

  const moduleOrder = useMemo(() => {
    const order = new Map<ModuleKey, number>()
    let idx = 0
    for (const item of navItems) {
      if (!item.moduleKey) continue
      if (!order.has(item.moduleKey)) order.set(item.moduleKey, idx++)
    }
    return order
  }, [])

  // BudgetO arbeitet ausschließlich mit eigenen Kategorien.
  // Daher wird dieses Modul nicht als optionales Toggle angeboten.
  const visibleModules = useMemo(() => {
    const filtered = modules.filter((m) => m.key !== 'custom-categories')
    return filtered
      .slice()
      .sort((a, b) => {
        const ai = moduleOrder.get(a.key as ModuleKey) ?? Number.POSITIVE_INFINITY
        const bi = moduleOrder.get(b.key as ModuleKey) ?? Number.POSITIVE_INFINITY
        if (ai !== bi) return ai - bi

        // Fallbacks for modules that don't exist in navigation
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
        return a.name.localeCompare(b.name)
      })
  }, [modules, moduleOrder])

  const handleToggle = async (mod: ModuleInfo) => {
    if (!canWrite) return
    try {
      await captureAndRestoreScroll(() => setModuleEnabled(mod.key, !mod.enabled))
      notify('success', `${mod.name} ${!mod.enabled ? 'aktiviert' : 'deaktiviert'}`, 2000)
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Ändern des Moduls')
    }
  }

  if (loading) {
    return (
      <div className="pane-section">
        <h2>Module</h2>
        <p className="helper">Module werden geladen...</p>
      </div>
    )
  }

  return (
    <div className="pane-section" ref={paneRef}>
      <h2>Module</h2>
      <p className="helper" style={{ marginBottom: 16 }}>
        Aktiviere oder deaktiviere Funktionsmodule nach Bedarf. 
        Deaktivierte Module werden aus der Navigation ausgeblendet.
      </p>

      {!canWrite && (
        <div className="card" style={{ padding: 12, background: 'var(--surface-alt)' }}>
          <div className="helper">Nur Anzeige: Mit Leserechten können Module nicht geändert werden.</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {visibleModules.map((mod) => (
          <div
            key={mod.key}
            className={`card module-toggle-card${canWrite ? '' : ' module-toggle-card--readonly'}`}
            role={canWrite ? 'button' : undefined}
            tabIndex={canWrite ? 0 : -1}
            aria-label={canWrite ? `${mod.name} ${mod.enabled ? 'deaktivieren' : 'aktivieren'}` : undefined}
            onClick={canWrite ? () => handleToggle(mod) : undefined}
            onKeyDown={
              canWrite
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToggle(mod)
                    }
                  }
                : undefined
            }
            style={{
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: mod.enabled ? 1 : 0.7,
              transition: 'opacity 0.2s ease'
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: mod.enabled 
                  ? 'color-mix(in oklab, var(--accent) 15%, transparent)' 
                  : 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0
              }}
            >
              {getModuleEmoji(mod.key)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{mod.name}</div>
              <div className="helper" style={{ fontSize: 12 }}>{mod.description}</div>
            </div>

            {/* Toggle */}
            <label className="switch" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={mod.enabled}
                disabled={!canWrite}
                onClick={(e) => e.stopPropagation()}
                onChange={() => handleToggle(mod)}
              />
              <span className="slider" />
            </label>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24, padding: 16, background: 'var(--surface-alt)' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>💡 Hinweis</h3>
        <p className="helper" style={{ margin: 0 }}>
          Neue Module wie <strong>Übungsleiter</strong> und <strong>Barvorschüsse</strong> 
          werden in zukünftigen Updates verfügbar sein. Aktiviere sie hier, sobald sie bereit sind.
        </p>
      </div>
    </div>
  )
}

function getModuleEmoji(key: string): string {
  const emojis: Record<string, string> = {
    'budgets': '📊',
    'instructors': '👨‍🏫',
    'cash-advance': '💵',
    'cash-check': '🔎',
    'excel-import': '📥',
    'members': '👥',
    'earmarks': '🏷️',
    'invoices': '📄',
    'custom-categories': '📂'
  }
  return emojis[key] || '📦'
}
