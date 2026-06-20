import React from 'react'

type UpdateStatus = {
  phase: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  version?: string
  releaseName?: string | null
  releaseDate?: string | null
  releaseNotes?: string | null
  percent?: number
  transferred?: number
  total?: number
  message?: string
  packaged: boolean
}

function formatBytes(value?: number) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UpdatePane() {
  const [status, setStatus] = React.useState<UpdateStatus | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    window.api?.updates?.status?.().then((result) => { if (alive) setStatus(result) }).catch(() => undefined)
    const off = window.api?.updates?.onStatus?.((result) => { if (alive) setStatus(result) })
    return () => { alive = false; off?.() }
  }, [])

  async function run(action: 'check' | 'download' | 'install') {
    setBusy(true)
    try {
      const result = await window.api?.updates?.[action]?.()
      if (result && action !== 'install') setStatus(result as UpdateStatus)
    } finally {
      if (action !== 'install') setBusy(false)
    }
  }

  const phase = status?.phase || 'idle'
  const title = phase === 'checking' ? 'Suche nach Updates …'
    : phase === 'available' ? `BudgetO ${status?.version} ist verfügbar`
      : phase === 'downloading' ? `Update wird geladen – ${(status?.percent || 0).toFixed(0)} %`
        : phase === 'downloaded' ? `BudgetO ${status?.version} ist bereit`
          : phase === 'not-available' ? 'BudgetO ist aktuell'
            : phase === 'error' ? 'Update-Prüfung nicht möglich'
              : 'BudgetO aktualisieren'

  return (
    <div className="update-pane">
      <div className="settings-section-heading">
        <strong>⬆️ App-Update</strong>
        <div className="helper">BudgetO direkt aus der App prüfen, herunterladen und installieren.</div>
      </div>

      <div className="card update-card">
        <div className="update-card__icon" aria-hidden>{phase === 'downloaded' ? '✓' : phase === 'error' ? '!' : '↻'}</div>
        <div className="update-card__content">
          <div className="update-card__title">{title}</div>
          <div className="helper">Installierte Version: <strong>{status?.currentVersion || '…'}</strong></div>
          {!status?.packaged && <div className="update-dev-note">Die Update-Funktion ist in der Entwicklungsumgebung deaktiviert und steht in der installierten App bereit.</div>}
          {status?.message && <div className={phase === 'error' ? 'update-message error' : 'update-message'}>{status.message}</div>}
          {phase === 'downloading' && <><div className="update-progress"><span style={{ width: `${Math.min(100, Math.max(0, status?.percent || 0))}%` }} /></div><div className="helper">{formatBytes(status?.transferred)} von {formatBytes(status?.total)}</div></>}
          {status?.releaseNotes && (phase === 'available' || phase === 'downloaded') && <div className="update-release-notes"><strong>Neuerungen</strong><div>{status.releaseNotes}</div></div>}
        </div>
        <div className="update-card__actions">
          {(phase === 'idle' || phase === 'not-available' || phase === 'error') && <button className="btn primary" disabled={busy || !status?.packaged} onClick={() => void run('check')}>Nach Updates suchen</button>}
          {phase === 'available' && <button className="btn primary" disabled={busy} onClick={() => void run('download')}>Update herunterladen</button>}
          {phase === 'downloaded' && <button className="btn primary" disabled={busy} onClick={() => void run('install')}>Neu starten & installieren</button>}
          {(phase === 'checking' || phase === 'downloading') && <button className="btn" disabled>Bitte warten …</button>}
        </div>
      </div>
    </div>
  )
}
