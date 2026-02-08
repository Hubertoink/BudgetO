import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/authHooks'
import type { UserRole } from '../../context/authTypes'

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

/**
 * UserIndicator - Shows current logged-in user in header
 */
export function UserIndicator() {
  const { user, isLoading, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [hasRemoteChanges, setHasRemoteChanges] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Ensure stable hook order; also close menu when session changes.
    if (!user) setOpen(false)
  }, [user])
  
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    const onRemote = (e: Event) => {
      const ce = e as CustomEvent
      const next = !!(ce as any)?.detail?.hasRemoteChanges
      setHasRemoteChanges(next)
    }
    const onChanged = () => {
      // Optimistic: if we refreshed, clear the glow.
      setHasRemoteChanges(false)
    }
    try { window.addEventListener('remote-changes', onRemote as any) } catch {}
    try { window.addEventListener('data-changed', onChanged) } catch {}
    return () => {
      try { window.removeEventListener('remote-changes', onRemote as any) } catch {}
      try { window.removeEventListener('data-changed', onChanged) } catch {}
    }
  }, [])

  if (isLoading || !user) {
    return null
  }

  // Get user initials
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: 8,
        position: 'relative'
      }}
      ref={rootRef}
    >
      {/* User Avatar/Badge */}
      <button
        type="button"
        className="user-indicator__avatar"
        data-has-changes={hasRemoteChanges ? 'true' : 'false'}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: ROLE_COLORS[user.role],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          padding: 0
        }}
        title={`${user.name} (${ROLE_LABELS[user.role]})${hasRemoteChanges ? ' · Änderungen verfügbar' : ''}`}
        aria-label="Benutzermenü"
        onClick={() => {
          if (hasRemoteChanges) {
            try { window.dispatchEvent(new Event('data-changed')) } catch {}
            setHasRemoteChanges(false)
          }
          setOpen(v => !v)
        }}
      >
        {initials}
      </button>
      
      {/* User Name - hidden on small screens */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          fontSize: 12,
          lineHeight: 1.2
        }}
      >
        <span style={{ fontWeight: 500 }}>{user.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {ROLE_LABELS[user.role]}
        </span>
      </div>

      {open && (
        <div
          role="menu"
          aria-label="Benutzeraktionen"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 180,
            background: 'color-mix(in oklab, var(--surface) 92%, transparent)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 8,
            boxShadow: 'var(--shadow-1)',
            zIndex: 9999
          }}
        >
          <button
            type="button"
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              setOpen(false)
              logout()
            }}
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
