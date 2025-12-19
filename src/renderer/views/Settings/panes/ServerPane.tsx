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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load current config and status
  const loadConfig = useCallback(async () => {
    try {
      const result = await (window as any).api?.server?.getConfig?.()
      if (result) {
        setConfig({
          mode: result.mode || 'local',
          port: result.port || DEFAULT_PORT,
          serverAddress: result.serverAddress || '',
          autoStart: result.autoStart ?? false,
          localIPs: result.localIPs
        })
      }
      
      const statusResult = await (window as any).api?.server?.getStatus?.()
      if (statusResult) {
        setStatus(statusResult)
      }
    } catch (e) {
      console.error('Failed to load server config:', e)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadConfig().finally(() => setLoading(false))
  }, [loadConfig])

  const handleSave = async () => {
    try {
      setSaving(true)
      await (window as any).api?.server?.setConfig?.(config)
      notify('success', 'Einstellungen gespeichert')
      // Reload to confirm saved values
      await loadConfig()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleStartServer = async () => {
    try {
      setStarting(true)
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

  return (
    <div className="stack gap-20">
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, marginBottom: 4 }}>Netzwerk</h2>
        <p className="helper" style={{ margin: 0 }}>
          Konfiguriere wie BudgetO mit anderen PCs zusammenarbeitet
        </p>
      </div>

      {/* Mode Selection */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500 }}>Betriebsmodus</div>
        
        <div className="stack gap-8">
          {/* Local Mode */}
          <label 
            className={`card ${config.mode === 'local' ? 'card-selected' : ''}`}
            style={{ 
              padding: '10px 12px', 
              cursor: 'pointer', 
              display: 'flex', 
              gap: 10, 
              alignItems: 'center',
              border: config.mode === 'local' ? '1px solid var(--primary)' : '1px solid var(--border)'
            }}
          >
            <input
              type="radio"
              name="serverMode"
              checked={config.mode === 'local'}
              onChange={() => setConfig({ ...config, mode: 'local' })}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Lokal</div>
              <div className="helper">Nur dieser PC (Standard)</div>
            </div>
          </label>

          {/* Server Mode */}
          <label 
            className={`card ${config.mode === 'server' ? 'card-selected' : ''}`}
            style={{ 
              padding: '10px 12px', 
              cursor: 'pointer', 
              display: 'flex', 
              gap: 10, 
              alignItems: 'center',
              border: config.mode === 'server' ? '1px solid var(--primary)' : '1px solid var(--border)'
            }}
          >
            <input
              type="radio"
              name="serverMode"
              checked={config.mode === 'server'}
              onChange={() => setConfig({ ...config, mode: 'server' })}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Server</div>
              <div className="helper">Andere PCs können sich verbinden</div>
            </div>
          </label>

          {/* Client Mode */}
          <label 
            className={`card ${config.mode === 'client' ? 'card-selected' : ''}`}
            style={{ 
              padding: '10px 12px', 
              cursor: 'pointer', 
              display: 'flex', 
              gap: 10, 
              alignItems: 'center',
              border: config.mode === 'client' ? '1px solid var(--primary)' : '1px solid var(--border)'
            }}
          >
            <input
              type="radio"
              name="serverMode"
              checked={config.mode === 'client'}
              onChange={() => setConfig({ ...config, mode: 'client' })}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Client</div>
              <div className="helper">Mit anderem Server verbinden</div>
            </div>
          </label>
        </div>
      </div>

      {/* Server Mode Settings */}
      {config.mode === 'server' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>Server-Konfiguration</div>
          
          <div className="row" style={{ marginBottom: 16 }}>
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
            
            <div className="field" style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.autoStart}
                  onChange={(e) => setConfig({ ...config, autoStart: e.target.checked })}
                />
                Beim App-Start automatisch starten
              </label>
            </div>
          </div>

          {/* Server Status Card */}
          <div 
            style={{ 
              padding: 12, 
              borderRadius: 6,
              background: status.running ? 'var(--success-bg, rgba(0,200,100,0.1))' : 'var(--bg-secondary)',
              border: status.running ? '1px solid var(--success, #00c853)' : '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span 
                style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  background: status.running ? 'var(--success, #00c853)' : 'var(--text-secondary)',
                  flexShrink: 0
                }} 
              />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {status.running ? 'Server läuft' : 'Server gestoppt'}
                </div>
                {status.running && status.localIPs && status.localIPs.length > 0 && (
                  <div className="helper" style={{ marginTop: 2 }}>
                    Erreichbar unter: <code style={{ userSelect: 'all' }}>{status.localIPs[0]}:{config.port}</code>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              className={`btn ${status.running ? '' : 'primary'}`}
              onClick={status.running ? handleStopServer : handleStartServer}
              disabled={starting}
              style={{ minWidth: 80 }}
            >
              {starting ? '...' : (status.running ? 'Stoppen' : 'Starten')}
            </button>
          </div>
        </div>
      )}

      {/* Client Mode Settings */}
      {config.mode === 'client' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>Verbindung</div>
          
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              className="input"
              value={config.serverAddress}
              onChange={(e) => setConfig({ ...config, serverAddress: e.target.value })}
              placeholder="192.168.1.100:3847"
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleTestConnection}>
              Testen
            </button>
          </div>

          {testResult && (
            <div 
              style={{ 
                padding: 10, 
                borderRadius: 6,
                background: testResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: testResult.success ? 'var(--success)' : 'var(--danger)',
                fontSize: 13
              }}
            >
              {testResult.message}
            </div>
          )}

          <div className="helper" style={{ marginTop: 12 }}>
            Im Client-Modus werden alle Daten vom Server geladen. Lokale Daten werden nicht verwendet.
          </div>
        </div>
      )}

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

export default ServerPane
