import React from 'react'
import { StoragePaneProps } from '../types'
import DbMigrateModal from '../../../DbMigrateModal'

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
  const [migrateModal, setMigrateModal] = React.useState<{ mode: 'useOrMigrate' | 'migrateEmpty'; root: string; dbPath?: string } | null>(null)

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

  // Handler für Ordner auswählen & migrieren/nutzen
  async function handlePickFolderForMigrate() {
    const picked = await pickFolder()
    if (!picked) return
    
    if (picked.hasDb) {
      // Datenbank gefunden -> zeige Modal mit Optionen
      setMigrateModal({ mode: 'useOrMigrate', root: picked.root, dbPath: picked.dbPath })
    } else {
      // Keine DB vorhanden -> zeige Bestätigung für Migration
      setMigrateModal({ mode: 'migrateEmpty', root: picked.root })
    }
  }

  async function handlePickFolderForUse() {
    const picked = await pickFolder()
    if (!picked) return
    
    if (picked.hasDb) {
      // Datenbank gefunden -> zeige Modal mit Optionen
      setMigrateModal({ mode: 'useOrMigrate', root: picked.root, dbPath: picked.dbPath })
    } else {
      // Keine DB vorhanden -> zeige Bestätigung für Migration
      setMigrateModal({ mode: 'migrateEmpty', root: picked.root })
    }
  }

  async function handleResetToDefault() {
    // Bei Standard-Reset verwenden wir smartRestore ohne Modal
    setBusy(true)
    try {
      const result = await resetToDefault()
      if (result.ok) {
        notify('success', 'Standard wiederhergestellt')
        await refreshLoc()
      } else {
        notify('error', 'Zurücksetzen fehlgeschlagen')
      }
    } catch (err: any) {
      notify('error', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleMigrateConfirm() {
    if (!migrateModal) return
    setBusy(true)
    try {
      const result = await migrateTo(migrateModal.root)
      if (result.ok) {
        notify('success', 'Migration erfolgreich')
        setMigrateModal(null)
        await refreshLoc()
      } else {
        notify('error', 'Migration fehlgeschlagen')
      }
    } catch (err: any) {
      notify('error', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleUseExisting() {
    if (!migrateModal) return
    setBusy(true)
    try {
      const result = await useFolder(migrateModal.root)
      if (result.ok) {
        notify('success', 'Ordner übernommen')
        setMigrateModal(null)
        await refreshLoc()
      } else {
        notify('error', 'Ordnerwechsel fehlgeschlagen')
      }
    } catch (err: any) {
      notify('error', err?.message || String(err))
    } finally {
      setBusy(false)
    }
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
          <button className="btn" disabled={busy || locBusy} onClick={handlePickFolderForUse}>📁 Ordner nutzen…</button>
          <button className="btn" disabled={busy || locBusy} onClick={handlePickFolderForMigrate}>🔀 Migrieren…</button>
          <button className="btn" disabled={busy || locBusy} onClick={handleResetToDefault}>↩️ Standard</button>
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

      {migrateModal && (
        <DbMigrateModal
          {...(migrateModal.mode === 'useOrMigrate'
            ? {
                mode: 'useOrMigrate' as const,
                root: migrateModal.root,
                dbPath: migrateModal.dbPath || '',
                busy,
                onCancel: () => setMigrateModal(null),
                onUse: handleUseExisting,
                onMigrate: handleMigrateConfirm,
              }
            : {
                mode: 'migrateEmpty' as const,
                root: migrateModal.root,
                busy,
                onCancel: () => setMigrateModal(null),
                onMigrate: handleMigrateConfirm,
              })}
        />
      )}

      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
    </div>
  )
}
