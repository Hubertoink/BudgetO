import React, { useState, useEffect, useCallback } from 'react'
import { useAuth, UserRole } from '../../../context/AuthContext'

interface User {
  id: number
  name: string
  username: string | null
  email: string | null
  role: UserRole
  isActive: boolean
  lastLogin: string | null
}

interface UsersPaneProps {
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number) => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  KASSE: 'Kassier',
  READONLY: 'Nur Lesen'
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Voller Zugriff auf alle Funktionen inkl. Benutzerverwaltung',
  KASSE: 'Kann Buchungen und Daten bearbeiten, keine Benutzerverwaltung',
  READONLY: 'Kann nur Daten einsehen, keine Änderungen'
}

/**
 * UsersPane - Settings pane for managing users and authentication
 */
export function UsersPane({ notify }: UsersPaneProps) {
  const { user: currentUser, canManageUsers, refreshUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  
  // Edit/Add modal state
  const [editUser, setEditUser] = useState<User | null>(null)
  const [isAddMode, setIsAddMode] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    role: 'READONLY' as UserRole,
    password: '',
    confirmPassword: ''
  })
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const result = await (window as any).api?.users?.list?.()
      setUsers(result?.users || [])
      
      const authResult = await (window as any).api?.auth?.isRequired?.()
      setAuthRequired(authResult?.required ?? false)
    } catch (e) {
      console.error('Failed to load users:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleAdd = () => {
    setIsAddMode(true)
    setEditUser(null)
    setFormData({
      name: '',
      username: '',
      email: '',
      role: 'READONLY',
      password: '',
      confirmPassword: ''
    })
  }

  const handleEdit = (user: User) => {
    setIsAddMode(false)
    setEditUser(user)
    setFormData({
      name: user.name,
      username: user.username || '',
      email: user.email || '',
      role: user.role,
      password: '',
      confirmPassword: ''
    })
  }

  const handleCancel = () => {
    setEditUser(null)
    setIsAddMode(false)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    if (isAddMode || formData.password) {
      if (!formData.username.trim()) {
        notify('error', 'Benutzername ist erforderlich')
        return
      }
      if (isAddMode && !formData.password) {
        notify('error', 'Passwort ist erforderlich')
        return
      }
      if (formData.password && formData.password.length < 6) {
        notify('error', 'Passwort muss mindestens 6 Zeichen haben')
        return
      }
      if (formData.password !== formData.confirmPassword) {
        notify('error', 'Passwörter stimmen nicht überein')
        return
      }
    }

    setSaving(true)
    try {
      if (isAddMode) {
        await (window as any).api?.users?.create?.({
          name: formData.name.trim(),
          username: formData.username.trim(),
          email: formData.email.trim() || null,
          role: formData.role,
          password: formData.password
        })
        notify('success', 'Benutzer erstellt')
      } else if (editUser) {
        const updateData: any = {
          id: editUser.id,
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          role: formData.role
        }
        if (formData.username.trim()) {
          updateData.username = formData.username.trim()
        }
        await (window as any).api?.users?.update?.(updateData)
        
        // If password changed, update it separately
        if (formData.password) {
          await (window as any).api?.auth?.changePassword?.({
            userId: editUser.id,
            newPassword: formData.password
          })
        }
        
        notify('success', 'Benutzer aktualisiert')
        
        // Refresh current user if we edited ourselves
        if (editUser.id === currentUser?.id) {
          await refreshUser()
        }
      }
      
      await loadUsers()
      handleCancel()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      notify('error', 'Sie können sich nicht selbst deaktivieren')
      return
    }
    
    try {
      await (window as any).api?.users?.update?.({
        id: user.id,
        isActive: !user.isActive
      })
      notify('success', user.isActive ? 'Benutzer deaktiviert' : 'Benutzer aktiviert')
      await loadUsers()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Ändern')
    }
  }

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      notify('error', 'Sie können sich nicht selbst löschen')
      return
    }
    
    if (!confirm(`Benutzer "${user.name}" wirklich löschen?`)) {
      return
    }
    
    try {
      await (window as any).api?.users?.delete?.({ id: user.id })
      notify('success', 'Benutzer gelöscht')
      await loadUsers()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Löschen')
    }
  }

  if (!canManageUsers) {
    return (
      <div className="pane-section">
        <h2>Benutzer</h2>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <p>Sie haben keine Berechtigung zur Benutzerverwaltung.</p>
          <p className="helper">Nur Administratoren können Benutzer verwalten.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="pane-section">
        <h2>Benutzer</h2>
        <p className="helper">Benutzer werden geladen...</p>
      </div>
    )
  }

  // Show edit/add form
  if (editUser || isAddMode) {
    return (
      <div className="pane-section">
        <h2>{isAddMode ? 'Neuer Benutzer' : 'Benutzer bearbeiten'}</h2>
        
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Vollständiger Name"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                Benutzername {isAddMode && '*'}
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Benutzername für Login"
                style={{ width: '100%' }}
                autoComplete="off"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                E-Mail
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="E-Mail-Adresse (optional)"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                Rolle *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                style={{ width: '100%' }}
                disabled={editUser?.id === currentUser?.id}
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <p className="helper" style={{ marginTop: 4 }}>
                {ROLE_DESCRIPTIONS[formData.role]}
              </p>
              {editUser?.id === currentUser?.id && (
                <p className="helper" style={{ color: 'var(--warning)', marginTop: 4 }}>
                  Sie können Ihre eigene Rolle nicht ändern.
                </p>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                {isAddMode ? 'Passwort *' : 'Neues Passwort (leer lassen für unverändert)'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isAddMode ? 'Passwort' : 'Neues Passwort (optional)'}
                style={{ width: '100%' }}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                Passwort bestätigen
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Passwort wiederholen"
                style={{ width: '100%' }}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              className="btn"
              onClick={handleCancel}
              disabled={saving}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pane-section">
      <h2>Benutzer</h2>
      
      <p className="helper" style={{ marginBottom: 16 }}>
        Verwalten Sie Benutzer und deren Zugriffsrechte.
        {!authRequired && (
          <span style={{ color: 'var(--warning)' }}>
            {' '}Authentifizierung ist aktuell deaktiviert.
          </span>
        )}
      </p>

      <button
        className="btn btn-primary"
        onClick={handleAdd}
        style={{ marginBottom: 16 }}
      >
        + Neuer Benutzer
      </button>

      <div style={{ display: 'grid', gap: 12 }}>
        {users.map((user) => (
          <div
            key={user.id}
            className="card"
            style={{
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: user.isActive ? 1 : 0.6
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: user.isActive 
                  ? getRoleColor(user.role) 
                  : 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 16,
                flexShrink: 0
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{user.name}</span>
                {user.id === currentUser?.id && (
                  <span 
                    style={{ 
                      fontSize: 11, 
                      padding: '2px 6px', 
                      background: 'var(--accent)', 
                      color: 'white',
                      borderRadius: 4 
                    }}
                  >
                    Sie
                  </span>
                )}
                {!user.isActive && (
                  <span 
                    style={{ 
                      fontSize: 11, 
                      padding: '2px 6px', 
                      background: 'var(--error)', 
                      color: 'white',
                      borderRadius: 4 
                    }}
                  >
                    Inaktiv
                  </span>
                )}
              </div>
              <div className="helper" style={{ fontSize: 12 }}>
                {user.username && `@${user.username} · `}
                {ROLE_LABELS[user.role]}
                {user.lastLogin && ` · Letzter Login: ${formatDate(user.lastLogin)}`}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="btn btn-sm"
                onClick={() => handleEdit(user)}
                title="Bearbeiten"
              >
                ✏️
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleToggleActive(user)}
                title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                disabled={user.id === currentUser?.id}
              >
                {user.isActive ? '🚫' : '✅'}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleDelete(user)}
                title="Löschen"
                disabled={user.id === currentUser?.id}
                style={{ color: 'var(--error)' }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p className="helper">Keine Benutzer vorhanden.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return '#dc2626'
    case 'KASSE': return '#2563eb'
    case 'READONLY': return '#6b7280'
    default: return '#6b7280'
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoString
  }
}

export default UsersPane
