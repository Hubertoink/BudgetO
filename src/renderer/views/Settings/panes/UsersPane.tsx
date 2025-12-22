import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

  // Delete confirmation modal state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const PROJECT_SCOPE_ACK_KEY = 'budgeto_project_scope_ack_v1'
  const [showProjectScope, setShowProjectScope] = useState(false)
  const [pendingAddAfterScope, setPendingAddAfterScope] = useState(false)
  
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

  // Password modal state (separate from edit form)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [serverStatus, setServerStatus] = useState<any>(null)
  const [showRemovePasswordConfirm, setShowRemovePasswordConfirm] = useState(false)

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

  const startAddFlow = () => {
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

  const handleAdd = () => {
    // Explain multi-user/auth implications once before creating users.
    try {
      const ack = localStorage.getItem(PROJECT_SCOPE_ACK_KEY)
      if (!ack) {
        setPendingAddAfterScope(true)
        setShowProjectScope(true)
        return
      }
    } catch {
      // ignore storage issues
    }
    startAddFlow()
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

  const openPasswordModal = async (user: User) => {
    setPasswordUser(user)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
    setShowRemovePasswordConfirm(false)
    try {
      const st = await (window as any).api?.server?.getStatus?.()
      setServerStatus(st)
    } catch {
      setServerStatus(null)
    }
    setShowPasswordModal(true)
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setShowRemovePasswordConfirm(false)
    setPasswordUser(null)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
    setPasswordSaving(false)
  }

  const handlePasswordSave = async () => {
    if (!passwordUser) return

    const isSelf = passwordUser.id === currentUser?.id
    const isAdminReset = !isSelf

    if (!passwordForm.newPassword) {
      notify('error', 'Neues Passwort ist erforderlich')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      notify('error', 'Passwort muss mindestens 6 Zeichen haben')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      notify('error', 'Passwörter stimmen nicht überein')
      return
    }
    if (isSelf && authRequired && !passwordForm.currentPassword) {
      notify('error', 'Aktuelles Passwort ist erforderlich')
      return
    }

    setPasswordSaving(true)
    try {
      if (isAdminReset) {
        await (window as any).api?.auth?.setInitialPassword?.({
          userId: passwordUser.id,
          password: passwordForm.newPassword
        })
      } else {
        const res = await (window as any).api?.auth?.changePassword?.({
          userId: passwordUser.id,
          currentPassword: passwordForm.currentPassword || '',
          newPassword: passwordForm.newPassword
        })
        if (res?.success === false) {
          throw new Error(res?.error || 'Fehler beim Ändern des Passworts')
        }
      }

      notify('success', 'Passwort geändert')
      await loadUsers()
      if (isSelf) await refreshUser()
      closePasswordModal()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Speichern')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handlePasswordRemove = async () => {
    if (!passwordUser) return
    const isSelf = passwordUser.id === currentUser?.id
    if (!isSelf) return

    const mode = (serverStatus as any)?.mode
    if (mode !== 'local') {
      notify('error', 'Passwort kann nur im Lokal-Modus entfernt werden')
      return
    }

    if (authRequired && !passwordForm.currentPassword) {
      notify('error', 'Aktuelles Passwort ist erforderlich')
      return
    }

    setShowRemovePasswordConfirm(true)
  }

  const performPasswordRemove = async () => {
    if (!passwordUser) return
    const isSelf = passwordUser.id === currentUser?.id
    if (!isSelf) return

    setPasswordSaving(true)
    try {
      const res = await (window as any).api?.auth?.clearPassword?.({
        userId: passwordUser.id,
        currentPassword: passwordForm.currentPassword || ''
      })
      if (res?.success === false) {
        throw new Error(res?.error || 'Fehler beim Entfernen des Passworts')
      }
      notify('success', 'Passwort entfernt')
      await loadUsers()
      await refreshUser()
      setShowRemovePasswordConfirm(false)
      closePasswordModal()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Entfernen')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      notify('error', 'Name ist erforderlich')
      return
    }
    if (isAddMode) {
      if (!formData.username.trim()) {
        notify('error', 'Benutzername ist erforderlich')
        return
      }
      if (!formData.password) {
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
    if (user.role === 'ADMIN') {
      notify('error', 'Administrator kann nicht deaktiviert werden')
      return
    }
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
    if (user.role === 'ADMIN') {
      notify('error', 'Administrator kann nicht gelöscht werden')
      return
    }
    if (user.id === currentUser?.id) {
      notify('error', 'Sie können sich nicht selbst löschen')
      return
    }

    setDeleteConfirmUser(user)
  }

  const performDelete = async () => {
    if (!deleteConfirmUser) return

    setDeleteSaving(true)
    try {
      await (window as any).api?.users?.delete?.({ id: deleteConfirmUser.id })
      notify('success', 'Benutzer gelöscht')
      setDeleteConfirmUser(null)
      await loadUsers()
    } catch (e: any) {
      notify('error', e?.message || 'Fehler beim Löschen')
    } finally {
      setDeleteSaving(false)
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

  const passwordModalPortal =
    showPasswordModal && passwordUser
      ? createPortal(
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Passwort ändern" onClick={closePasswordModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ margin: 0 }}>Passwort ändern</h2>
                <button className="btn ghost" onClick={closePasswordModal} aria-label="Schließen">✕</button>
              </div>

              <div className="modal-grid" style={{ gap: 10 }}>
                <div className="helper" style={{ marginTop: -6 }}>
                  {passwordUser.id === currentUser?.id
                    ? 'Geben Sie zuerst Ihr aktuelles Passwort ein, dann das neue.'
                    : 'Admin-Reset: Setzt ein neues Passwort ohne aktuelles Passwort.'}
                </div>

                {passwordUser.id === currentUser?.id && (
                  <div className="field">
                    <label>Aktuelles Passwort {authRequired ? '*' : ''}</label>
                    <input
                      type="password"
                      className="input"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Aktuelles Passwort"
                      autoComplete="current-password"
                    />
                  </div>
                )}

                <div className="settings-row-2col" style={{ alignItems: 'end' }}>
                  <div className="field">
                    <label>Neues Passwort *</label>
                    <input
                      type="password"
                      className="input"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Neues Passwort"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="field">
                    <label>Passwort bestätigen *</label>
                    <input
                      type="password"
                      className="input"
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                      placeholder="Passwort wiederholen"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {passwordUser.id === currentUser?.id && (
                  <div className="helper" style={{ marginTop: -2 }}>
                    Passwort entfernen ist nur im <strong>Lokal</strong>-Modus verfügbar.
                  </div>
                )}

                <div className="modal-actions-end" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    {passwordUser.id === currentUser?.id && (
                      <button
                        className="btn"
                        onClick={handlePasswordRemove}
                        disabled={passwordSaving || (serverStatus as any)?.mode !== 'local'}
                        style={{ color: 'var(--error)' }}
                        title={(serverStatus as any)?.mode !== 'local' ? 'Nur im Lokal-Modus' : 'Passwort entfernen'}
                      >
                        Passwort entfernen
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={closePasswordModal} disabled={passwordSaving}>Abbrechen</button>
                    <button className="btn primary" onClick={handlePasswordSave} disabled={passwordSaving}>
                      {passwordSaving ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  const removePasswordConfirmPortal =
    showRemovePasswordConfirm && passwordUser
      ? createPortal(
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Passwort entfernen bestätigen"
            style={{ zIndex: 6000 }}
            onClick={() => setShowRemovePasswordConfirm(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ margin: 0 }}>Passwort entfernen</h2>
                <button className="btn ghost" onClick={() => setShowRemovePasswordConfirm(false)} aria-label="Schließen">✕</button>
              </div>
              <div className="modal-grid" style={{ gap: 10 }}>
                <div>
                  Passwort wirklich entfernen? Danach ist keine Anmeldung mehr nötig (nur Lokal-Modus).
                </div>
                <div className="modal-actions-end" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setShowRemovePasswordConfirm(false)} disabled={passwordSaving}>
                    Abbrechen
                  </button>
                  <button
                    className="btn"
                    onClick={performPasswordRemove}
                    disabled={passwordSaving}
                    style={{ color: 'var(--error)' }}
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  const deleteUserConfirmPortal =
    deleteConfirmUser
      ? createPortal(
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Benutzer löschen bestätigen"
            style={{ zIndex: 6500 }}
            onClick={() => (deleteSaving ? null : setDeleteConfirmUser(null))}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <h2 style={{ margin: 0 }}>Benutzer löschen</h2>
                <button
                  className="btn ghost"
                  onClick={() => setDeleteConfirmUser(null)}
                  aria-label="Schließen"
                  disabled={deleteSaving}
                >
                  ✕
                </button>
              </div>
              <div className="modal-grid" style={{ gap: 10 }}>
                <div>
                  Benutzer <strong>„{deleteConfirmUser.name}“</strong> wirklich löschen?
                  <div className="helper" style={{ margin: '6px 0 0 0' }}>
                    {deleteConfirmUser.username ? `Benutzername: ${deleteConfirmUser.username}` : null}
                    {deleteConfirmUser.username && deleteConfirmUser.email ? ' · ' : null}
                    {deleteConfirmUser.email ? `E-Mail: ${deleteConfirmUser.email}` : null}
                  </div>
                </div>
                <div className="modal-actions-end" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setDeleteConfirmUser(null)} disabled={deleteSaving}>
                    Abbrechen
                  </button>
                  <button className="btn danger" onClick={performDelete} disabled={deleteSaving}>
                    {deleteSaving ? 'Löschen…' : 'Ja, löschen'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  // Show edit/add form
  if (editUser || isAddMode) {
    const isEditingSelf = !!editUser && editUser.id === currentUser?.id
    return (
      <>
        {passwordModalPortal}
        {removePasswordConfirmPortal}
        {deleteUserConfirmPortal}
        {deleteUserConfirmPortal}

        <div className="stack gap-20">
          <div>
            <h2 style={{ margin: 0, marginBottom: 4 }}>{isAddMode ? 'Neuer Benutzer' : 'Benutzer bearbeiten'}</h2>
            <p className="helper" style={{ margin: 0 }}>
              {isAddMode ? 'Neuen Benutzer anlegen' : 'Benutzerdaten aktualisieren'}
            </p>
          </div>
          
          <div className="card" style={{ padding: 20 }}>
          <div className="settings-row-2col" style={{ alignItems: 'end' }}>
            <div className="field">
              <label>Name *</label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Vollständiger Name"
              />
            </div>

            <div className="field">
              <label>Benutzername {isAddMode && '*'}</label>
              <input
                type="text"
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Für Login"
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label>E-Mail</label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="field">
              <label>Rolle *</label>
              <select
                className="input"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                disabled={editUser?.id === currentUser?.id}
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <div className="helper" style={{ marginTop: 4 }}>
                {ROLE_DESCRIPTIONS[formData.role]}
              </div>
              {editUser?.id === currentUser?.id && (
                <div className="helper" style={{ color: 'var(--warning)', marginTop: 4 }}>
                  Sie können Ihre eigene Rolle nicht ändern.
                </div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />

          {isAddMode ? (
            <div className="settings-row-2col" style={{ alignItems: 'end' }}>
              <div className="field">
                <label>Passwort *</label>
                <input
                  type="password"
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Passwort"
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <label>Passwort bestätigen *</label>
                <input
                  type="password"
                  className="input"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Passwort wiederholen"
                  autoComplete="new-password"
                />
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 600 }}>Passwort</div>
                  <div className="helper" style={{ margin: 0 }}>
                    Passwortänderungen werden separat bestätigt.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => openPasswordModal(editUser!)}>
                    Passwort ändern
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end', position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
            <button
              className="btn"
              onClick={handleCancel}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="stack gap-20">
      {passwordModalPortal}
      {removePasswordConfirmPortal}

      {showProjectScope &&
        createPortal(
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Multi-User & Server – Hinweis"
            onClick={() => {
              setShowProjectScope(false)
              setPendingAddAfterScope(false)
            }}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ margin: 0 }}>Multi-User & Server</h2>
                <button className="btn ghost" onClick={() => { setShowProjectScope(false); setPendingAddAfterScope(false) }} aria-label="Schließen">✕</button>
              </div>
              <div className="modal-grid" style={{ gap: 10 }}>
                <div className="helper" style={{ marginTop: -6 }}>
                  Kurz erklärt, was das Anlegen von Benutzern bedeutet.
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div>
                      <strong>Lokal:</strong> Ohne Admin-Passwort ist keine Anmeldung nötig.
                    </div>
                    <div>
                      <strong>Mit Benutzern + Passwort:</strong> BudgetO aktiviert Anmeldung (Login) und Rechte (Admin/Kassier/Nur Lesen).
                    </div>
                    <div>
                      <strong>Multi-User:</strong> Dafür brauchst du einen PC im <strong>Server</strong>-Modus. Andere PCs verbinden sich im <strong>Client</strong>-Modus.
                    </div>
                    <div className="helper" style={{ margin: 0 }}>
                      Einstellungen findest du unter „Einstellungen → Netzwerk“.
                    </div>
                  </div>
                </div>
                <div className="modal-actions-end">
                  <button
                    className="btn"
                    onClick={() => {
                      setShowProjectScope(false)
                      setPendingAddAfterScope(false)
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      try { localStorage.setItem(PROJECT_SCOPE_ACK_KEY, '1') } catch {}
                      setShowProjectScope(false)
                      const shouldAdd = pendingAddAfterScope
                      setPendingAddAfterScope(false)
                      if (shouldAdd) startAddFlow()
                    }}
                  >
                    Verstanden
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280, flex: '1 1 320px' }}>
          <h2 style={{ margin: 0, marginBottom: 4 }}>Benutzer</h2>
          <p className="helper" style={{ margin: 0 }}>
            Verwalten Sie Benutzer und deren Zugriffsrechte.
            {!authRequired && (
              <span style={{ color: 'var(--warning)' }}>
                {' '}Authentifizierung ist aktuell deaktiviert.
              </span>
            )}
          </p>
        </div>

        <button className="btn primary" onClick={handleAdd}>
          Neuer Benutzer
        </button>
      </div>

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
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                className="btn btn-sm btn-edit"
                onClick={() => handleEdit(user)}
                title="Bearbeiten"
                aria-label="Bearbeiten"
              >
                ✎
              </button>
              {user.role !== 'ADMIN' && (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleToggleActive(user)}
                    title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    disabled={user.id === currentUser?.id}
                    style={{ padding: '4px 10px' }}
                  >
                    {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleDelete(user)}
                    title="Löschen"
                    disabled={user.id === currentUser?.id}
                    style={{ padding: '4px 10px', color: 'var(--error)' }}
                  >
                    Löschen
                  </button>
                </>
              )}
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
