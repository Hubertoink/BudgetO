import React, { useState, useEffect } from 'react'

interface ServerConfig {
  mode: 'local' | 'server' | 'client'
  port: number
  serverAddress?: string
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

  if (!config) return null

  const getModeDisplay = () => {
    if (config.mode === 'local') {
      return {
        label: 'Lokal',
        detail: 'Nur dieser PC',
        color: 'var(--text-muted)',
        active: true
      }
    }
    if (config.mode === 'server') {
      return {
        label: 'Server',
        detail: status?.running ? `Port ${status.port}` : 'Gestoppt',
        color: status?.running ? 'var(--success)' : 'var(--text-muted)',
        active: status?.running
      }
    }
    if (config.mode === 'client') {
      const addr = (config.serverAddress || '').trim()
      return {
        label: 'Client',
        detail: addr || 'Kein Server',
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
      className="network-status"
      style={
        {
          ['--ns-color' as any]: display.color,
          ['--ns-glow' as any]: display.active ? `0 0 6px ${display.color}` : 'none'
        } as any
      }
      title={`Netzwerkmodus: ${display.label} – ${display.detail}`}
    >
      <span className="network-status__dot" aria-hidden="true" />
      <span className="network-status__label">{display.label}</span>
      <span className="network-status__sep" aria-hidden="true">·</span>
      <span className="network-status__detail">{display.detail}</span>
    </div>
  )
}
