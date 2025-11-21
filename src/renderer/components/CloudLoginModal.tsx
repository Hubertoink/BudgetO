import { useState } from 'react'
import { CloudAdapter } from '../services/adapter'
import { setCloudConfig, setAppMode, invalidateDataAdapter } from '../utils/app-mode'

interface CloudLoginModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CloudLoginModal({ onClose, onSuccess }: CloudLoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  // TODO: Nach Mittwald-Deployment diese URL anpassen
  const apiUrl = 'http://localhost:3000'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const adapter = new CloudAdapter(apiUrl)

      if (mode === 'login') {
        const result = await adapter.login(email, password)
        
        // Save cloud configuration
        setCloudConfig({
          apiUrl,
          token: result.token
        })
        
        // Switch to cloud mode
        setAppMode('cloud')
        invalidateDataAdapter()
        
        onSuccess()
      } else {
        if (!organizationName.trim()) {
          setError('Bitte Vereinsname angeben')
          setLoading(false)
          return
        }
        
        const result = await adapter.register(email, password, organizationName)
        
        // Save cloud configuration
        setCloudConfig({
          apiUrl,
          token: result.token
        })
        
        // Switch to cloud mode
        setAppMode('cloud')
        invalidateDataAdapter()
        
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal cloud-login-modal">
        <div className="modal-header">
          <h2>{mode === 'login' ? 'Cloud-Login' : 'Cloud-Registrierung'}</h2>
          <button 
            className="btn ghost icon-btn" 
            onClick={onClose} 
            aria-label="Schließen"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content">
          <div className="form-group">
            <label htmlFor="email">E-Mail</label>
            <input
              className="cloud-input"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@verein.de"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input
              className="cloud-input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              required
              minLength={6}
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="organizationName">Vereinsname</label>
              <input
                className="cloud-input"
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Mein Verein e.V."
                required
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              disabled={loading}
            >
              {mode === 'login' ? 'Neu registrieren' : 'Zum Login'}
            </button>
            
            <div className="flex gap-8">
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={loading}
              >
                {loading ? 'Verbinde...' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
