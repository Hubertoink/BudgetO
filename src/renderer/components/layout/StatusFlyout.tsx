import React, { useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/authHooks'
import type { UserRole } from '../../context/authTypes'
import { NetworkStatus } from './NetworkStatus'

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: '#dc2626',
  KASSE: '#2563eb',
  READONLY: '#6b7280'
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  KASSE: 'Kassier',
  READONLY: 'Lesezugriff'
}

export function StatusFlyout() {
  const { user, isLoading, authEnforced, isAuthenticated, logout } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [serverRunning, setServerRunning] = React.useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)

  // Poll server status to color handle
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const cfg = await (window as any).api?.server?.getConfig?.()
        if (cancelled) return
        if (cfg?.mode === 'server') {
          const st = await (window as any).api?.server?.getStatus?.()
          if (!cancelled) setServerRunning(!!st?.running)
        } else {
          setServerRunning(false)
        }
      } catch { if (!cancelled) setServerRunning(false) }
    }
    check()
    const interval = window.setInterval(check, 5000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [])

  const initials = React.useMemo(() => {
    if (!user?.name) return ''
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [user?.name])

  // Click outside to close (touch support)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (!el) return
      const target = e.target as Node
      if (!el.contains(target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('touchstart', onDown)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('touchstart', onDown)
    }
  }, [open])

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), 120)
  }, [cancelClose])

  // Cleanup on unmount
  useEffect(() => () => cancelClose(), [cancelClose])

  const handleLabel = user?.name ? `${user.name} (${ROLE_LABELS[user.role]})` : 'Status'

  return (
    <div className="status-flyout" ref={rootRef}>
      {/* Handle button at bottom - hover/click triggers open */}
      <button
        type="button"
        className={`status-flyout__handle${open ? ' is-active' : ''}`}
        data-server-running={serverRunning ? 'true' : undefined}
        aria-label={handleLabel}
        title={handleLabel}
        onMouseEnter={() => { cancelClose(); setOpen(true) }}
        onMouseLeave={scheduleClose}
        onFocus={() => { cancelClose(); setOpen(true) }}
        onClick={() => setOpen(v => !v)}
      >
        {initials || 'i'}
      </button>

      {/* Panel - opens upward, stays open while mouse inside */}
      <div
        className={`status-flyout__panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label="Status"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {/* Compact header row */}
        <div className="status-flyout__row">
          {!isLoading && user ? (
            <>
              <span
                className="status-flyout__dot"
                style={{ background: ROLE_COLORS[user.role] }}
                aria-hidden="true"
              />
              <span className="status-flyout__name">{user.name}</span>
              <span className="status-flyout__role">{ROLE_LABELS[user.role]}</span>
            </>
          ) : (
            <span className="status-flyout__name">–</span>
          )}
        </div>

        {/* Network mode inline */}
        <div className="status-flyout__row status-flyout__row--mode">
          <NetworkStatus />
        </div>

        {/* Logout action (only if auth enforced) */}
        {authEnforced && isAuthenticated && (
          <button
            type="button"
            className="status-flyout__logout"
            onClick={() => { setOpen(false); logout() }}
          >
            Abmelden
          </button>
        )}
      </div>
    </div>
  )
}
