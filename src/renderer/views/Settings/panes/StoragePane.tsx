import React from 'react'
import { StoragePaneProps } from '../types'

import { useStorageLocation, useBackupSettings } from '../hooks'
import { LocationInfoDisplay, BackupList } from '../components'

/**
 * StoragePane - DB Location + Backups (auto + manual)
 */
export function StoragePane({ notify }: StoragePaneProps) {
  const { info, busy: locBusy, error: locError, refresh: refreshLoc, pickFolder, migrateTo, useFolder, resetToDefault } = useStorageLocation()
  const { autoMode, intervalDays, backups, busy: backupBusy, refreshBackups, makeBackup, updateAutoMode, updateInterval, chooseBackupDir, backupDir, openBackupFolder } = useBackupSettings()
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [compare, setCompare] = React.useState<{ a: string; b: string } | null>(null)

  async function doMakeBackup() {
    setBusy(true); setErr('')
    try { const res = await makeBackup('manual'); if (res?.filePath) { notify('success', `Backup erstellt: ${res.filePath}`); refreshBackups() } }
    catch (e: any) { setErr(e?.message || String(e)); notify('error', e?.message || String(e)) }
    finally { setBusy(false) }
  }
  async function doRestore(filePath: string) {
    setBusy(true); setErr('')
    try {
      const res = await window.api?.backup?.restore?.(filePath)
      if (res?.ok) { notify('success', 'Backup wiederhergestellt'); window.dispatchEvent(new Event('data-changed')) }
      else notify('error', res?.error || 'Wiederherstellung fehlgeschlagen')
    } catch (e: any) { setErr(e?.message || String(e)); notify('error', e?.message || String(e)) }
    finally { setBusy(false) }
  }

  React.useEffect(() => { refreshBackups(); refreshLoc() }, [])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>Speicher & Sicherungen</strong>
        <div className="helper">Verwalte Speicherort und Sicherungen der Datenbank.</div>
      </div>

      <section className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div className="helper">Aktueller Speicherort</div>
        <LocationInfoDisplay info={info} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy || locBusy} onClick={async () => { const picked = await pickFolder(); if (picked?.root) { const use = await useFolder(picked.root); if (use.ok) notify('success', 'Ordner übernommen'); } }}>📁 Ordner nutzen…</button>
          <button className="btn" disabled={busy || locBusy} onClick={async () => { const picked = await pickFolder(); if (picked?.root) { const mig = await migrateTo(picked.root); if (mig.ok) notify('success', 'Migration erfolgreich'); } }}>🔀 Migrieren…</button>
          <button className="btn" disabled={busy || locBusy} onClick={async () => { const r = await resetToDefault(); if (r.ok) notify('success', 'Standard wiederhergestellt') }}>↩️ Standard</button>
        </div>
        {locError && <div style={{ color: 'var(--danger)' }}>{locError}</div>}
      </section>

      <section className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div className="helper">Automatische Sicherungen</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field">
            <label htmlFor="auto-backup-mode">Modus</label>
            <select id="auto-backup-mode" className="input" value={autoMode} onChange={(e) => updateAutoMode(e.target.value as any)}>
              <option value="OFF">Aus</option>
              <option value="PROMPT">Nachfragen</option>
              <option value="SILENT">Still</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label htmlFor="auto-backup-interval">Intervall (Tage)</label>
            <input id="auto-backup-interval" title="Intervall (Tage)" className="input" type="number" min={1} value={intervalDays} onChange={(e) => updateInterval(Number(e.target.value) || 1)} />
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Backup-Verzeichnis</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{backupDir || 'Standard'}</code>
              <button className="btn" disabled={backupBusy} onClick={async () => { const r = await chooseBackupDir(); if (r.ok) notify('success', 'Backup-Verzeichnis gesetzt') }}>Ändern…</button>
              <button className="btn" disabled={backupBusy} onClick={openBackupFolder}>Öffnen…</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={doMakeBackup}>Jetzt sichern</button>
        </div>
        <BackupList backups={backups} onRestore={doRestore} />
      </section>

      {compare && (
        <div className="modal-overlay" onClick={() => setCompare(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Vergleich</h3>
            <div className="helper">Noch nicht implementiert – Dateiinhalte vergleichen.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setCompare(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
    </div>
  )
}
