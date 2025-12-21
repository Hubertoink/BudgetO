import { useModules, ModuleInfo } from '../../../context/ModuleContext'
import { useAuth } from '../../../context/AuthContext'

/**
 * ModulesPane - Settings pane for enabling/disabling BudgetO modules
 */
export function ModulesPane({ notify }: { notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void }) {
  const { canWrite } = useAuth()
  const { modules, loading, setModuleEnabled } = useModules()

  // BudgetO arbeitet ausschließlich mit eigenen Kategorien.
  // Daher wird dieses Modul nicht als optionales Toggle angeboten.
  const visibleModules = modules.filter((m) => m.key !== 'custom-categories')

  const handleToggle = async (mod: ModuleInfo) => {
    if (!canWrite) return
    try {
      await setModuleEnabled(mod.key, !mod.enabled)
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
    <div className="pane-section">
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
            className="card"
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
    'excel-import': '📥',
    'members': '👥',
    'earmarks': '🏷️',
    'invoices': '📄',
    'custom-categories': '📂'
  }
  return emojis[key] || '📦'
}
