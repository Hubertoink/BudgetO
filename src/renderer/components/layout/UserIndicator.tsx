import React from 'react'
import { useAuth, UserRole } from '../../context/AuthContext'

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
  
  if (isLoading) {
    return null
  }
  
  if (!user) {
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
    >
      {/* User Avatar/Badge */}
      <div
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
          cursor: 'default'
        }}
        title={`${user.name} (${ROLE_LABELS[user.role]})`}
      >
        {initials}
      </div>
      
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
    </div>
  )
}
