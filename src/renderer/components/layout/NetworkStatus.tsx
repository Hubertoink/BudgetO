import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'

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
  const [clientOk, setClientOk] = useState<boolean | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [hasRemoteChanges, setHasRemoteChanges] = useState(false)
  const lastSeenSeqRef = useRef<number>(0)
  const lastSeqRef = useRef<number>(0)

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
        setClientOk(null)
        setHasRemoteChanges(false)
      } else {
        setStatus(null)
        if (cfg.mode === 'client') {
          const addr = (cfg.serverAddress || '').trim()
          if (!addr) {
            setClientOk(false)
            setHasRemoteChanges(false)
          } else {
            try {
              const res = await (window as any).api?.server?.testConnection?.({ address: addr })
              const ok = !!res?.success
              setClientOk(ok)
              if (!ok) {
                try { window.dispatchEvent(new CustomEvent('server-disconnected', { detail: { address: addr, message: res?.message } })) } catch {}
                setHasRemoteChanges(false)
              } else {
                // Lightweight remote change detection (no heavy polling): read a sequence number.
                try {
                  const r = await (window as any).api?.meta?.getChangeSeq?.()
                  const seq = typeof r?.seq === 'number' ? r.seq : 0
                  lastSeqRef.current = seq
                  if (lastSeenSeqRef.current === 0) {
                    lastSeenSeqRef.current = seq
                  }
                  setHasRemoteChanges(seq > lastSeenSeqRef.current)
                } catch {
                  // ignore (e.g. not logged in yet)
                }
              }
            } catch {
              setClientOk(false)
              try { window.dispatchEvent(new CustomEvent('server-disconnected', { detail: { address: addr, message: 'Server nicht erreichbar' } })) } catch {}
              setHasRemoteChanges(false)
            }
          }
        } else {
          setClientOk(null)
          setHasRemoteChanges(false)
        }
      }
    } catch {
      // Ignore errors
    }
  }

  const display = useMemo(() => {
    if (!config) return null
    if (config.mode === 'local') {
      return {
        label: 'Lokal',
        detail: 'Nur dieser PC',
        color: 'var(--text-muted)',
        active: true,
        clickable: false,
        titleExtra: ''
      }
    }
    if (config.mode === 'server') {
      const running = !!status?.running
      const detail = running
        ? `Port ${status?.port}${typeof status?.connectedClients === 'number' ? ` · Clients: ${status.connectedClients}` : ''}`
        : 'Gestoppt'
      return {
        label: 'Server',
        detail,
        color: running ? 'var(--success)' : 'var(--text-muted)',
        active: running,
        clickable: true,
        titleExtra: running ? 'Klicken: Server stoppen' : 'Klicken: Server starten'
      }
    }
    if (config.mode === 'client') {
      const addr = (config.serverAddress || '').trim()
      const okLabel = clientOk === false ? 'Offline' : 'Verbunden'
      const suffix = hasRemoteChanges ? ' · Änderungen' : ''
      return {
        label: 'Client',
        detail: addr ? `${addr} · ${okLabel}${suffix}` : 'Kein Server',
        color: clientOk === false ? 'var(--danger)' : clientOk === true ? 'var(--success)' : 'var(--text-muted)',
        active: clientOk === true,
        clickable: hasRemoteChanges,
        titleExtra: hasRemoteChanges ? 'Klicken: Ansicht aktualisieren' : ''
      }
    }
    return null
  }, [config, status?.connectedClients, status?.port, status?.running, clientOk, hasRemoteChanges])

  const onClick = useCallback(async () => {
    if (!config) return
    if (isBusy) return

    // Client: refresh hint
    if (config.mode === 'client' && hasRemoteChanges) {
      lastSeenSeqRef.current = lastSeqRef.current
      setHasRemoteChanges(false)
      try { window.dispatchEvent(new Event('data-changed')) } catch {}
      return
    }

    // Server: quick start/stop
    if (config.mode === 'server') {
      setIsBusy(true)
      try {
        if (status?.running) {
          await (window as any).api?.server?.stop?.()
        } else {
          await (window as any).api?.server?.start?.()
        }
      } finally {
        setIsBusy(false)
        await loadStatus()
      }
    }
  }, [config, hasRemoteChanges, isBusy, status?.running])

  if (!config || !display) return null

  const title = `Netzwerkmodus: ${display.label} – ${display.detail}${display.titleExtra ? ` (${display.titleExtra})` : ''}`

  return (
    <div
      className="network-status"
      style={
        {
          ['--ns-color' as any]: display.color,
          ['--ns-glow' as any]: display.active ? `0 0 6px ${display.color}` : 'none'
        } as any
      }
      title={title}
      role={display.clickable || config.mode === 'server' ? 'button' : undefined}
      tabIndex={display.clickable || config.mode === 'server' ? 0 : undefined}
      data-clickable={display.clickable || config.mode === 'server' ? 'true' : 'false'}
      aria-label={title}
      onClick={display.clickable || config.mode === 'server' ? onClick : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (display.clickable || config.mode === 'server')) {
          e.preventDefault()
          void onClick()
        }
      }}
    >
      <span className="network-status__dot" aria-hidden="true" />
      <span className="network-status__label">{display.label}</span>
      <span className="network-status__sep" aria-hidden="true">·</span>
      <span className="network-status__detail">{display.detail}</span>
    </div>
  )
}
