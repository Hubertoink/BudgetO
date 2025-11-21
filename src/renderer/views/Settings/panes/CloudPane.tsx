import { AppModeSwitcher } from '../../../components/AppModeSwitcher'

/**
 * CloudPane - Cloud-Modus Einstellungen
 * Ermöglicht Wechsel zwischen lokalem SQLite und Cloud-Backend
 */
export function CloudPane() {
  return (
    <div className="settings-pane">
      <div className="settings-pane-card">
        <h2>Cloud-Modus</h2>
        <p className="mode-switcher-text">
          VereinO kann entweder lokal auf diesem Computer (SQLite) oder mit einem Cloud-Backend betrieben werden.
          Der Cloud-Modus ermöglicht Mehrbenutzerzugriff und zentrale Datenhaltung.
        </p>
      </div>

      <div className="settings-pane-card">
        <h3>Aktueller Modus</h3>
        <AppModeSwitcher />
      </div>

      <div className="settings-pane-card">
        <h3>Informationen</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>💻 Lokaler Modus:</strong>
            <ul>
              <li>Alle Daten werden auf diesem Computer gespeichert</li>
              <li>Keine Internet-Verbindung erforderlich</li>
              <li>Ideal für Einzelnutzer oder kleine Vereine</li>
              <li>Schneller Zugriff ohne Netzwerk-Latenz</li>
              <li>Backup über Datei-Export</li>
            </ul>
          </div>

          <div className="info-item">
            <strong>☁️ Cloud-Modus:</strong>
            <ul>
              <li>Daten werden zentral auf einem Server gespeichert</li>
              <li>Mehrbenutzerzugriff möglich</li>
              <li>Zugriff von mehreren Geräten</li>
              <li>Automatisches Backup auf dem Server</li>
              <li>Erfordert VereinO Cloud-Backend (Docker)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="settings-pane-card">
        <h3>Backend Setup</h3>
        <p className="mode-switcher-text">
          Für den Cloud-Modus wird ein VereinO Backend-Server benötigt. 
          Die Backend-URL wird nach dem Deployment auf Mittwald automatisch konfiguriert.
          Während der Entwicklung läuft das Backend auf <code>localhost:3000</code>.
        </p>
        <details className="cloud-setup-details">
          <summary>Setup-Anleitung anzeigen</summary>
          <div className="cloud-setup-content">
            <h4>Lokale Entwicklung (Docker Compose):</h4>
            <pre className="code-block">
{`# Repository klonen
git clone https://github.com/Hubertoink/VereinO.git
cd VereinO

# Umgebungsvariablen setzen
cp .env.docker.example .env
# .env bearbeiten: DB_PASSWORD und JWT_SECRET setzen

# Container starten
docker-compose up -d

# Logs prüfen
docker-compose logs -f backend`}
            </pre>
            
            <h4>Production Deployment (Mittwald):</h4>
            <p className="mode-switcher-text">
              Nach dem Deployment auf Mittwald wird die Backend-URL automatisch konfiguriert.
              SSL/TLS-Verschlüsselung wird über Reverse Proxy (Traefik/Nginx) eingerichtet.
            </p>
            <pre className="code-block">
{`# Auf Mittwald-Server
git clone https://github.com/Hubertoink/VereinO.git
cd VereinO

# Sichere Passwörter in .env setzen!
cp .env.docker.example .env
nano .env

# Container starten
docker-compose up -d

# CORS_ORIGIN auf Domain setzen (z.B. https://vereino.mittwald.io)
# JWT_SECRET mit starkem Passwort ersetzen`}
            </pre>
            
            <p className="mode-switcher-text">
              Nach dem Start ist das Backend bereit für Cloud-Registrierungen.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
