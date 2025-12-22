import React, { useState, useEffect, useCallback } from 'react'

type ServerMode = 'local' | 'server' | 'client'

interface ServerConfig {
  mode: ServerMode
  port: number
  serverAddress: string
  autoStart: boolean
  localIPs?: string[]
}

interface ServerStatus {
  running: boolean
  connectedClients: number
  mode: ServerMode
  localIPs?: string[]
}

interface ServerPaneProps {
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}

const DEFAULT_PORT = 3847

/**
 * ServerPane - Settings for multi-user / network mode
 */
export function ServerPane({ notify }: ServerPaneProps) {
  const [config, setConfig] = useState<ServerConfig>({
    mode: 'local',
    port: DEFAULT_PORT,
    serverAddress: '',
    autoStart: false
  })
  const [status, setStatus] = useState<ServerStatus>({
    running: false,
    connectedClients: 0,
    mode: 'local'
  })
  const [loadedConfig, setLoadedConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [authRequired, setAuthRequired] = useState<boolean>(false)

  // Local-mode auth behavior: when passwords exist, user can opt out of login prompts in local mode.
  const [requireAuthInLocalMode, setRequireAuthInLocalMode] = useState<boolean>(false)
  const [showLocalAuthPrompt, setShowLocalAuthPrompt] = useState<boolean>(false)

  // Load current config and status
  const loadConfig = useCallback(async () => {
    try {
      const result = await (window as any).api?.server?.getConfig?.()
      if (result) {
        const next: ServerConfig = {
          mode: result.mode || 'local',
          port: result.port || DEFAULT_PORT,
          serverAddress: result.serverAddress || '',
          autoStart: result.autoStart ?? false,
          localIPs: result.localIPs
        }
        setConfig(next)
        setLoadedConfig(next)
      }
      
      const statusResult = await (window as any).api?.server?.getStatus?.()
      if (statusResult) {
        setStatus(statusResult)
      }

      const authResult = await (window as any).api?.auth?.isRequired?.()
      setAuthRequired(!!authResult?.required)

      try {
        const s = await (window as any).api?.settings?.get?.({ key: 'auth.requireInLocalMode' })
        setRequireAuthInLocalMode(!!s?.value)
      } catch {
        setRequireAuthInLocalMode(false)
      }
    } catch (e) {
      console.error('Failed to load server config:', e)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadConfig().finally(() => setLoading(false))
  }, [loadConfig])

  function modeLabel(mode: ServerMode): string {
    if (mode === 'local') return 'Lokal'
    if (mode === 'server') return 'Server'
    return 'Client'
  }

  const isDirty = (() => {
    if (!loadedConfig) return false
    return (
      loadedConfig.mode !== config.mode ||
      loadedConfig.port !== config.port ||
      (loadedConfig.serverAddress || '') !== (config.serverAddress || '') ||
      loadedConfig.autoStart !== config.autoStart
    )
  })()

  const modeChanged = !!loadedConfig && loadedConfig.mode !== config.mode

  const applyButtonLabel = saving
    ? '…'
    : !isDirty
      ? 'Aktuell'
      : modeChanged
        ? `Betriebsmodus festlegen: ${modeLabel(config.mode)}`
        : 'Änderungen übernehmen'

  const handleSave = async () => {
    try {
      setSaving(true)
      await (window as any).api?.server?.setConfig?.(config)
      notify('success', modeChanged ? `Betriebsmodus festgelegt: ${modeLabel(config.mode)}` : 'Änderungen übernommen')
      // Let other parts of the app (AuthContext, status pills, etc.) react immediately.
      try { window.dispatchEvent(new Event('server-config-changed')) } catch {}
      try { window.dispatchEvent(new Event('auth-changed')) } catch {}
      // Reload to confirm saved values
      await loadConfig()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const persistRequireAuthInLocalMode = async (next: boolean) => {
    setRequireAuthInLocalMode(next)
    try {
      await (window as any).api?.settings?.set?.({ key: 'auth.requireInLocalMode', value: next })
      try { window.dispatchEvent(new Event('auth-changed')) } catch {}
    } catch (e: any) {
      notify('error', e?.message || 'Konnte Einstellung nicht speichern')
    }
  }

  const handleStartServer = async () => {
    try {
      if (!canStartServer) {
        notify('error', startBlockedReason)
        return
      }
      setStarting(true)

      // Ensure the main process uses the currently selected settings (mode/port) even if the user didn't click "Speichern" yet.
      await (window as any).api?.server?.setConfig?.(config)

      const result = await (window as any).api?.server?.start?.()
      if (result?.success) {
        notify('success', 'Server gestartet')
      } else {
        notify('error', result?.error || 'Server konnte nicht gestartet werden')
      }
      // Reload status immediately
      await loadConfig()
    } catch (e: any) {
      notify('error', e?.message || 'Server konnte nicht gestartet werden')
    } finally {
      setStarting(false)
    }
  }

  const handleStopServer = async () => {
    try {
      setStarting(true)
      await (window as any).api?.server?.stop?.()
      notify('info', 'Server gestoppt')
      // Reload status immediately
      await loadConfig()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Stoppen')
    } finally {
      setStarting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!config.serverAddress) {
      notify('error', 'Server-Adresse eingeben')
      return
    }
    
    setTestResult(null)
    try {
      const result = await (window as any).api?.server?.testConnection?.({ address: config.serverAddress })
      setTestResult(result)
      if (result?.success) {
        notify('success', 'Verbindung erfolgreich!')
      } else {
        notify('error', result?.message || 'Verbindung fehlgeschlagen')
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Verbindungsfehler' })
      notify('error', e?.message || 'Verbindungsfehler')
    }
  }

  if (loading) {
    return <div className="helper">Lade Netzwerk-Einstellungen...</div>
  }

  const canStartServer = authRequired
  const startBlockedReason = canStartServer
    ? ''
    : 'Bevor der Server gestartet werden kann, muss ein Admin-Passwort gesetzt werden (Einstellungen → Benutzer).'

  return (
    <div className="settings-pane">
      {showLocalAuthPrompt && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Passwortabfrage im Lokalmodus"
          style={{ zIndex: 6500 }}
          onClick={() => setShowLocalAuthPrompt(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>Lokalmodus: Passwortabfrage</h2>
              <button className="btn ghost" onClick={() => setShowLocalAuthPrompt(false)} aria-label="Schließen">✕</button>
            </div>
            <div className="modal-grid" style={{ gap: 10 }}>
              <div>
                Es sind Benutzer mit Passwort vorhanden. Im <strong>Lokalmodus</strong> kannst du wählen, ob beim Start eine Anmeldung erforderlich ist.
              </div>
              <div className="helper" style={{ margin: 0 }}>
                Empfehlung: <strong>Ohne Passwort</strong> für Einzel-PC. Für geteilte PCs: <strong>Mit Passwort</strong>.
              </div>
              <div className="modal-actions-end" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => { void persistRequireAuthInLocalMode(false); setShowLocalAuthPrompt(false) }}>
                  Ohne Passwort
                </button>
                <button className="btn primary" onClick={() => { void persistRequireAuthInLocalMode(true); setShowLocalAuthPrompt(false) }}>
                  Mit Passwort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, marginBottom: 4 }}>Netzwerk</h2>
        <p className="helper" style={{ margin: 0 }}>
          Konfiguriere wie BudgetO mit anderen PCs zusammenarbeitet
        </p>
      </div>

      {/* Mode Selection */}
      <div className="settings-card settings-pane-card">
        <div className="settings-title">Betriebsmodus</div>
        <div className="settings-sub">
          {config.mode === 'local' && 'Nur dieser PC (Standard)'}
          {config.mode === 'server' && 'Andere PCs können sich verbinden'}
          {config.mode === 'client' && 'Mit anderem Server verbinden'}
        </div>
        <div className="helper" style={{ marginTop: 8 }}>
          Aktiv: <strong>{modeLabel(status.mode)}</strong>{status.mode === 'server' ? (status.running ? ' (läuft)' : ' (gestoppt)') : ''}
        </div>
        <div className="btn-group" role="group" aria-label="Betriebsmodus">
          <button
            type="button"
            className={`btn-option ${config.mode === 'local' ? 'active' : ''}`}
            onClick={() => {
              // If switching to local mode and there are passwords, ask whether login prompts should stay enabled.
              if (config.mode !== 'local' && authRequired) {
                setShowLocalAuthPrompt(true)
              }
              setConfig({ ...config, mode: 'local' })
            }}
          >
            Lokal
          </button>
          <button
            type="button"
            className={`btn-option ${config.mode === 'server' ? 'active' : ''}`}
            onClick={() => setConfig({ ...config, mode: 'server' })}
          >
            Server
          </button>
          <button
            type="button"
            className={`btn-option ${config.mode === 'client' ? 'active' : ''}`}
            onClick={() => setConfig({ ...config, mode: 'client' })}
          >
            Client
          </button>
        </div>
      </div>

      {config.mode === 'local' && (
        <div className="settings-card settings-pane-card">
          <div className="settings-title">Sicherheit im Lokalmodus</div>
          <div className="settings-sub">Steuert, ob beim Start eine Anmeldung nötig ist.</div>
          <div className="settings-inline-toggle" style={{ marginTop: 10 }}>
            <label htmlFor="toggle-local-auth-required">Passwortabfrage aktivieren</label>
            <input
              id="toggle-local-auth-required"
              role="switch"
              aria-checked={requireAuthInLocalMode}
              className="toggle"
              type="checkbox"
              checked={requireAuthInLocalMode}
              onChange={(e) => { void persistRequireAuthInLocalMode(e.target.checked) }}
            />
          </div>
          <div className="helper" style={{ marginTop: 8 }}>
            Wenn deaktiviert, wird im Lokalmodus keine Passwortabfrage angezeigt (auch wenn Passwörter gesetzt sind).
          </div>
        </div>
      )}

      {/* Server Mode Settings */}
      {config.mode === 'server' && (
        <div className="settings-card settings-pane-card">
          <div className="settings-title">Server-Konfiguration</div>
          {!canStartServer && (
            <div className="helper helper-danger" style={{ marginTop: 6 }}>
              {startBlockedReason}
            </div>
          )}
          
          <div className="row" style={{ marginTop: 12, marginBottom: 14, alignItems: 'end' }}>
            <div className="field">
              <label>Port</label>
              <input
                type="number"
                className="input"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: Number(e.target.value) || DEFAULT_PORT })}
                min={1024}
                max={65535}
                style={{ width: 120 }}
              />
            </div>
            
            <div className="field">
              <label>Autostart</label>
              <label className="label-row" style={{ cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.autoStart}
                  onChange={(e) => {
                    const next = e.target.checked
                    if (next && !canStartServer) {
                      notify('error', startBlockedReason)
                      setConfig({ ...config, autoStart: false })
                      return
                    }
                    setConfig({ ...config, autoStart: next })
                  }}
                />
                <span>Beim App-Start automatisch starten</span>
              </label>
            </div>
          </div>

          {/* Server Status Card */}
          <div className="server-status-card" data-running={status.running ? 'true' : 'false'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span 
                style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  background: status.running ? 'var(--success)' : 'var(--text-dim)',
                  flexShrink: 0
                }} 
              />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {status.running ? 'Server läuft' : 'Server gestoppt'}
                </div>
                {status.running && (
                  <div className="helper" style={{ marginTop: 2, display: 'grid', gap: 4 }}>
                    <div>
                      Clients: <strong>{status.connectedClients ?? 0}</strong>
                    </div>
                    {status.localIPs && status.localIPs.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {status.localIPs.map((ip) => (
                          <code key={ip} style={{ userSelect: 'all' }}>
                            {ip}:{config.port}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button 
              className={`btn ${status.running ? '' : 'primary'}`}
              onClick={status.running ? handleStopServer : handleStartServer}
              disabled={starting}
              title={!status.running && !canStartServer ? startBlockedReason : undefined}
              style={{ minWidth: 80 }}
            >
              {starting ? '...' : (status.running ? 'Stoppen' : 'Starten')}
            </button>
          </div>
        </div>
      )}

      {/* Client Mode Settings */}
      {config.mode === 'client' && (
        <div className="settings-card settings-pane-card">
          <div className="settings-title">Verbindung</div>
          
          <div className="server-connection-row" style={{ marginTop: 12, marginBottom: 12 }}>
            <input
              type="text"
              className="input"
              value={config.serverAddress}
              onChange={(e) => setConfig({ ...config, serverAddress: e.target.value })}
              placeholder="192.168.1.100:3847"
            />
            <button className="btn" onClick={handleTestConnection}>
              Testen
            </button>
          </div>

          {testResult && (
            <div className="server-test-result" data-success={testResult.success ? 'true' : 'false'}>
              {testResult.message}
            </div>
          )}

          <div className="helper" style={{ marginTop: 12 }}>
            Im Client-Modus werden alle Daten vom Server geladen. Lokale Daten werden nicht verwendet.
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="settings-pane-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className={`btn ${isDirty ? 'primary' : 'ghost'}`} 
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {applyButtonLabel}
        </button>
      </div>
    </div>
  )
}

export default ServerPane
