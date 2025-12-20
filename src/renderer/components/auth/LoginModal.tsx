import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './LoginModal.css'

// Resolve app icon and background image for the login screen
const appLogo: string = new URL('../../../../build/Icon.ico', import.meta.url).href
const loginBg: string = new URL('../../assets/a_snow_covered_houses_and_a_street_light.png', import.meta.url).href

interface LoginModalProps {
  isOpen: boolean
  onClose?: () => void
  allowClose?: boolean
}

export function LoginModal({ isOpen, onClose, allowClose = false }: LoginModalProps) {
  const { login, isLoading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  // Focus username field when modal opens
  useEffect(() => {
    if (isOpen && usernameRef.current) {
      usernameRef.current.focus()
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setPassword('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim()) {
      setError('Bitte Benutzername eingeben')
      return
    }
    if (!password) {
      setError('Bitte Passwort eingeben')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const result = await login(username.trim(), password)
      
      if (result.success) {
        if (onClose) onClose()
      } else {
        setError(result.error || 'Anmeldung fehlgeschlagen')
        setPassword('')
      }
    } catch (err: any) {
      setError(err?.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && allowClose && onClose) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="login-modal-overlay" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="login-title"
      onKeyDown={handleKeyDown}
      style={{ ['--login-bg-image' as any]: `url(${loginBg})` }}
    >
      <div className="login-modal">
        <div className="login-modal-header">
          <div className="login-logo">
            <img className="login-logo-img" src={appLogo} alt="BudgetO" />
            <h1 id="login-title">BudgetO</h1>
          </div>
          <p className="login-subtitle">Bitte anmelden</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Benutzername</label>
            <input
              ref={usernameRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Benutzername eingeben"
              disabled={isSubmitting || authLoading}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              disabled={isSubmitting || authLoading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={isSubmitting || authLoading}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Anmelden...
              </>
            ) : (
              'Anmelden'
            )}
          </button>

          {allowClose && onClose && (
            <button 
              type="button" 
              className="login-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Abbrechen
            </button>
          )}
        </form>

        <div className="login-footer">
          <p>Budget- und Finanzmanagement für die Jugendförderung</p>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
