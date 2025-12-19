import React, { useState, useEffect } from 'react'

interface ServerConfig {
  mode: 'local' | 'server' | 'client'
  port: number
  host: string
  autoStart: boolean
}

interface ServerStatus {
  running: boolean
  port?: number
  connectedClients?: number
}

/**
 * NetworkStatus - Shows current network mode in header
 * 
 * Displays: Lokal, Server (running/stopped), or Client (connected/disconnected)
 */
export function NetworkStatus() {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [status, setStatus] = useState<ServerStatus | null>(null)

  useEffect(() => {
    loadStatus()
    // Poll status every 5 seconds
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const cfg = await window.api.server.getConfig()
      setConfig(cfg)
      if (cfg.mode === 'server') {
        const st = await window.api.server.getStatus()
        setStatus(st)
      } else {
        setStatus(null)
      }
    } catch {
      // Ignore errors
    }
  }

  if (!config || config.mode === 'local') {
    return null // Don't show anything in local mode
  }

  const getModeDisplay = () => {
    if (config.mode === 'server') {
      return {
        label: 'Server',
        detail: status?.running ? `Port ${status.port}` : 'Gestoppt',
        color: status?.running ? 'var(--success)' : 'var(--text-muted)',
        active: status?.running
      }
    }
    if (config.mode === 'client') {
      return {
        label: 'Client',
        detail: `${config.host}:${config.port}`,
        color: 'var(--info)',
        active: true
      }
    }
    return null
  }

  const display = getModeDisplay()
  if (!display) return null

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }}
      title={`Netzwerkmodus: ${display.label} - ${display.detail}`}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: display.color,
          boxShadow: display.active ? `0 0 4px ${display.color}` : 'none'
        }}
      />
      <span style={{ fontWeight: 500 }}>{display.label}</span>
      <span style={{ opacity: 0.7 }}>{display.detail}</span>
    </div>
  )
}
