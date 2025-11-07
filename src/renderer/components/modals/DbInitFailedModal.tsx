import React from 'react'

export default function DbInitFailedModal(props: {
  message?: string
  busy?: boolean
  onUseExisting: () => void
  onChooseAndMigrate: () => void
  onResetDefault: () => void
  onImportFile?: () => void
}) {
  const { message, busy } = props
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Datenbank konnte nicht geöffnet werden</h2>
        </div>
        {message && (
          <div className="card" style={{ padding: 8, maxHeight: 180, overflow: 'auto', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 12 }}>{String(message)}</div>
          </div>
        )}
        <div>
          Wähle eine Option, um fortzufahren:
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" onClick={props.onUseExisting} disabled={!!busy}>
            Bestehende Datenbank verwenden (Ordner auswählen)
          </button>
          <button className="btn" onClick={props.onChooseAndMigrate} disabled={!!busy}>
            Ordner wählen und aktuelle Daten migrieren (kopieren)
          </button>
          <button className="btn" onClick={props.onResetDefault} disabled={!!busy}>
            Neue Datenbank im Standardordner erstellen
          </button>
          {props.onImportFile && (
            <button className="btn ghost" onClick={props.onImportFile} disabled={!!busy}>
              SQLite-Datei importieren …
            </button>
          )}
        </div>
        <div className="helper">Nach erfolgreicher Auswahl wird die App neu geladen.</div>
      </div>
    </div>
  )
}
