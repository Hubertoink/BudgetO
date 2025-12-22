import { useState, useEffect } from 'react'
import { getAppMode, setAppMode, clearCloudConfig, invalidateDataAdapter, type AppMode } from '../utils/app-mode'
import { CloudLoginModal } from './CloudLoginModal'

export function AppModeSwitcher() {
  const [currentMode, setCurrentMode] = useState<AppMode>(getAppMode())
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: AppMode }>) => {
      setCurrentMode(e.detail.mode)
    }
    
    window.addEventListener('app-mode-changed', handleModeChange as EventListener)
    return () => window.removeEventListener('app-mode-changed', handleModeChange as EventListener)
  }, [])

  const handleSwitchToLocal = () => {
    if (confirm('Möchten Sie wirklich zum lokalen Modus wechseln? Die Cloud-Verbindung wird getrennt.')) {
      clearCloudConfig()
      setAppMode('local')
      invalidateDataAdapter()
      setCurrentMode('local')
      
      // Trigger page reload to reset app state
      window.dispatchEvent(new Event('data-changed'))
    }
  }

  const handleSwitchToCloud = () => {
    setShowLogin(true)
  }

  const handleLoginSuccess = () => {
    setShowLogin(false)
    setCurrentMode('cloud')
    
    // Trigger page reload to reset app state
    window.dispatchEvent(new Event('data-changed'))
    window.location.reload()
  }

  return (
    <>
      <div className="mode-switcher">
        <div className="mode-switcher-label">
          <strong>Aktueller Modus:</strong>
          <span className={`mode-badge ${currentMode === 'local' ? 'mode-badge-local' : 'mode-badge-cloud'}`}>
            {currentMode === 'local' ? '💻 Lokal' : '☁️ Cloud'}
          </span>
        </div>

        <div className="mode-switcher-actions">
          {currentMode === 'cloud' ? (
            <button 
              className="btn secondary" 
              onClick={handleSwitchToLocal}
            >
              Zu Lokal wechseln
            </button>
          ) : (
            <button 
              className="btn primary" 
              onClick={handleSwitchToCloud}
            >
              Zu Cloud wechseln
            </button>
          )}
        </div>
      </div>

      <div className="form-group mode-switcher-description">
        <p className="mode-switcher-text">
          {currentMode === 'local' ? (
            <>
              <strong>Lokaler Modus:</strong> Alle Daten werden lokal in einer SQLite-Datenbank auf diesem Computer gespeichert. 
              Ideal für Einzelnutzer oder wenn keine Internet-Verbindung verfügbar ist.
            </>
          ) : (
            <>
              <strong>Cloud-Modus:</strong> Verbindung zu einem BudgetO Cloud-Backend. 
              Ermöglicht Mehrbenutzerzugriff und zentrale Datenhaltung auf einem Server.
            </>
          )}
        </p>
      </div>

      {showLogin && (
        <CloudLoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </>
  )
}
