import React from 'react'
import { StoragePaneProps } from '../types'
import DbMigrateModal from '../../../DbMigrateModal'

import { useStorageLocation, useBackupSettings } from '../hooks'
import { LocationInfoDisplay, BackupList } from '../components'
import { BackupInfo } from '../types'

/**
 * StoragePane - DB Location + Backups (auto + manual)
 */
export function StoragePane({ notify }: StoragePaneProps) {
  const { info, busy: locBusy, error: locError, refresh: refreshLoc, pickFolder, migrateTo, useFolder, resetToDefault } = useStorageLocation()
  const { autoMode, intervalDays, backups, busy: backupBusy, refreshBackups, makeBackup, updateAutoMode, updateInterval, chooseBackupDir, backupDir, openBackupFolder } = useBackupSettings()
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [restorePick, setRestorePick] = React.useState<BackupInfo | null>(null)
  const [busyRestore, setBusyRestore] = React.useState(false)
  // Data management & security (moved from GeneralPane)
  const [importPick, setImportPick] = React.useState<null | { filePath: string; size?: number; mtime?: number; counts?: Record<string, number>; currentCounts?: Record<string, number> }>(null)
  const [busyImport, setBusyImport] = React.useState(false)
  const [busyDanger, setBusyDanger] = React.useState(false)
  const [activeOrg, setActiveOrg] = React.useState<null | { id: string; name: string }>(null)
  const [showResetOrg, setShowResetOrg] = React.useState(false)
  const [resetConfirmText, setResetConfirmText] = React.useState('')
  const [showDeleteOrg, setShowDeleteOrg] = React.useState(false)
  const [deleteOrgConfirmText, setDeleteOrgConfirmText] = React.useState('')
  // Unified comparison modal state
  const [compareModal, setCompareModal] = React.useState<null | {
    mode: 'folder' | 'default'
    root: string
    dbPath?: string
    hasTargetDb: boolean
    currentCounts: Record<string, number>
    targetCounts: Record<string, number> | null
  }>(null)
  // Legacy simple migrate modal (kept for fallback when counts fail to load)
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

  async function confirmRestore() {
    if (!restorePick) return
    setBusyRestore(true)
    try {
      await doRestore(restorePick.filePath)
      setRestorePick(null)
    } finally {
      setBusyRestore(false)
    }
  }

  // Helper: load counts for current + selected DB (silently fall back to simple modal if inspection fails)
  async function loadCountsFor(dbPath?: string): Promise<Record<string, number> | null> {
    if (!dbPath) return null
    try {
      const res = await window.api?.backup?.inspect?.(dbPath)
      return res?.counts || null
    } catch { return null }
  }
  async function loadCurrentCounts(): Promise<Record<string, number>> {
    try {
      const res = await window.api?.backup?.inspectCurrent?.()
      return res?.counts || {}
    } catch { return {} }
  }

  async function ensureActiveOrgLoaded() {
    if (activeOrg) return activeOrg
    try {
      const res = await (window as any).api?.organizations?.active?.()
      const org = res?.organization
      if (org?.id && org?.name) {
        const next = { id: String(org.id), name: String(org.name) }
        setActiveOrg(next)
        return next
      }
    } catch {
      // ignore
    }
    return null
  }

  async function openFolderCompare(picked: { root: string; dbPath: string; hasDb: boolean }) {
    const [cur, target] = await Promise.all([
      loadCurrentCounts(),
      picked.hasDb ? loadCountsFor(picked.dbPath) : Promise.resolve(null)
    ])
    if (picked.hasDb && target === null) {
      // fallback
      setMigrateModal({ mode: 'useOrMigrate', root: picked.root, dbPath: picked.dbPath })
      return
    }
    setCompareModal({
      mode: 'folder',
      root: picked.root,
      dbPath: picked.dbPath,
      hasTargetDb: picked.hasDb,
      currentCounts: cur,
      targetCounts: target
    })
  }

  async function handlePickFolder() {
    const picked = await pickFolder()
    if (!picked) return
    await openFolderCompare(picked)
  }

  async function handleResetToDefault() {
    // Show smart restore preview instead of direct apply
    setBusy(true)
    try {
      const preview = await window.api?.db?.smartRestore?.preview?.()
      if (preview) {
        const cur = preview.current?.counts || {}
        const def = preview.default?.counts || null
        setCompareModal({
          mode: 'default',
          root: preview.default?.root || '(Standard)',
          dbPath: preview.default?.dbPath,
          hasTargetDb: !!preview.default?.exists,
          currentCounts: cur,
          targetCounts: def
        })
      } else {
        notify('error', 'Smart Restore Vorschau fehlgeschlagen')
      }
    } catch (e: any) {
      notify('error', e?.message || String(e))
    } finally { setBusy(false) }
  }

  async function handleMigrateConfirm() {
    // From legacy migrateModal fallback
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
    } finally { setBusy(false) }
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
    } finally { setBusy(false) }
  }

  // Actions from compare modal
  async function useSelectedFolder() {
    if (!compareModal || compareModal.mode !== 'folder') return
    setBusy(true)
    try {
      const result = await useFolder(compareModal.root)
      if (result.ok) { notify('success', 'Bestehende Datenbank verwendet'); await refreshLoc() }
    } catch (e: any) { notify('error', e?.message || String(e)) }
    finally { setBusy(false); setCompareModal(null) }
  }
  async function migrateToSelectedFolder() {
    if (!compareModal || compareModal.mode !== 'folder') return
    setBusy(true)
    try {
      const result = await migrateTo(compareModal.root)
      if (result.ok) { notify('success', 'Aktuelle Datenbank migriert'); await refreshLoc() }
    } catch (e: any) { notify('error', e?.message || String(e)) }
    finally { setBusy(false); setCompareModal(null) }
  }
  async function useDefaultDb() {
    if (!compareModal || compareModal.mode !== 'default') return
    setBusy(true)
    try {
      const res = await window.api?.db?.smartRestore?.apply?.({ action: 'useDefault' })
      if (res?.ok) { notify('success', 'Standard-Datenbank verwendet'); await refreshLoc() }
    } catch (e: any) { notify('error', e?.message || String(e)) }
    finally { setBusy(false); setCompareModal(null) }
  }
  async function migrateToDefaultDb() {
    if (!compareModal || compareModal.mode !== 'default') return
    setBusy(true)
    try {
      const res = await window.api?.db?.smartRestore?.apply?.({ action: 'migrateToDefault' })
      if (res?.ok) { notify('success', 'Aktuelle Datenbank zum Standard migriert'); await refreshLoc() }
    } catch (e: any) { notify('error', e?.message || String(e)) }
    finally { setBusy(false); setCompareModal(null) }
  }

  React.useEffect(() => { refreshBackups(); refreshLoc() }, [])

  // Helper: shorten backup dir path for display
  function shortBackupDir(dir: string): string {
    if (!dir) return 'Standard'
    const parts = dir.replace(/\\/g, '/').split('/')
    return '…/' + parts.slice(-2).join('/')
  }

  return (
    <div className="storage-pane-v2">
      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 1: Speicherort
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="storage-zone">
        <div className="storage-zone-header">
          <span className="storage-zone-icon">📁</span>
          <h3 className="storage-zone-title">Speicherort</h3>
        </div>
        <LocationInfoDisplay info={info} />
        <div className="helper storage-zone-hint">
          Beim Wechsel wählst du: bestehende DB nutzen oder aktuelle kopieren.
        </div>
        <div className="storage-zone-actions">
          <button
            className="btn"
            disabled={busy || locBusy}
            onClick={handlePickFolder}
            title="Wähle einen Ordner. Bei vorhandener DB kannst du wechseln oder dorthin migrieren."
          >
            Speicherort ändern…
          </button>
          <button
            className="btn"
            disabled={busy || locBusy}
            onClick={handleResetToDefault}
            title="Vergleiche mit dem Standard-App-Ordner."
          >
            Auf Standard zurücksetzen…
          </button>
        </div>
        {locError && <div className="error-text">{locError}</div>}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 2: Sicherungen (Automatisch + Manuell + Liste)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="storage-zone">
        <div className="storage-zone-header">
          <span className="storage-zone-icon">💾</span>
          <h3 className="storage-zone-title">Sicherungen</h3>
          <button
            className="btn primary"
            disabled={busy}
            onClick={doMakeBackup}
            title="Erstellt sofort eine Sicherung der aktuellen Datenbank."
          >
            Jetzt sichern
          </button>
        </div>

        {/* Auto-Backup Settings */}
        <div className="storage-subsection">
          <div className="storage-subsection-label">Automatisch</div>
          <div className="storage-auto-row">
            <div className="field field-compact">
              <label htmlFor="auto-backup-mode" title="Aus = keine; Nachfragen = du wirst gefragt; Still = automatisch im Hintergrund">Modus</label>
              <select id="auto-backup-mode" className="input" value={autoMode} onChange={(e) => updateAutoMode(e.target.value as any)}>
                <option value="OFF">Aus</option>
                <option value="PROMPT">Nachfragen</option>
                <option value="SILENT">Still</option>
              </select>
            </div>
            <div className="field field-compact field-narrow">
              <label htmlFor="auto-backup-interval" title="Intervall in Tagen">Tage</label>
              <input id="auto-backup-interval" className="input" type="number" min={1} value={intervalDays} onChange={(e) => updateInterval(Number(e.target.value) || 1)} />
            </div>
            <div className="field field-compact field-grow">
              <label title="Ordner für automatische und manuelle Sicherungen">Verzeichnis</label>
              <div className="storage-dir-row">
                <code className="storage-dir-code" title={backupDir || 'Standard'}>{shortBackupDir(backupDir)}</code>
                <button className="btn btn-sm" disabled={backupBusy} onClick={async () => { const r = await chooseBackupDir(); if (r.ok) notify('success', 'Backup-Verzeichnis geändert') }}>Ändern</button>
                <button className="btn btn-sm" disabled={backupBusy} onClick={openBackupFolder} title="Im Explorer öffnen">📂</button>
              </div>
            </div>
          </div>
          <div className="helper storage-retention-hint">
            Aufbewahrung: max. 5 Sicherungen. Ältere werden automatisch gelöscht.
          </div>
        </div>

        {/* Backup List */}
        <div className="storage-subsection">
          <div className="storage-subsection-label">Verfügbare Sicherungen</div>
          <BackupList backups={backups} onRestore={(b) => setRestorePick(b)} />
          <div className="helper storage-restore-hint">
            Wiederherstellen ersetzt die aktuelle DB. Anhänge werden nicht automatisch wiederhergestellt.
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 3: Datenverwaltung (Export/Import + Gefahrenzone)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="storage-zone">
        <div className="storage-zone-header">
          <span className="storage-zone-icon">🗄️</span>
          <h3 className="storage-zone-title">Datenverwaltung</h3>
        </div>

        {/* Export / Import */}
        <div className="storage-subsection">
          <div className="storage-subsection-label">Export / Import</div>
          <div className="storage-zone-actions">
            <button
              className="btn"
              onClick={async () => {
                try {
                  const res = await window.api?.db.export?.()
                  if (res?.filePath && String(res.filePath).trim().length > 0) {
                    notify('success', `Exportiert: ${res.filePath}`)
                  }
                } catch (e: any) {
                  const msg = e?.message || String(e)
                  if (!/Abbruch/i.test(msg)) notify('error', msg)
                }
              }}
              title="Speichert eine Kopie der aktuellen DB an einem Ort deiner Wahl."
            >
              Exportieren
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                try {
                  const api = window.api?.db?.import as any
                  const picked = await api?.pick?.()
                  if (picked?.ok && picked.filePath) {
                    const cur = await loadCurrentCounts()
                    setImportPick({ filePath: picked.filePath, size: picked.size, mtime: picked.mtime, counts: picked.counts, currentCounts: cur })
                  }
                } catch (e: any) {
                  const msg = e?.message || String(e)
                  if (!/Abbruch/i.test(msg)) notify('error', msg)
                }
              }}
            >
              Importieren…
            </button>
          </div>
          <div className="helper">Import überschreibt die aktuelle Datenbank vollständig.</div>
        </div>

        {/* Danger Zone */}
        <div className="storage-subsection storage-danger-zone">
          <div className="storage-subsection-label storage-danger-label">⚠️ Gefahrenzone</div>
          <div className="helper">
            Setzt dieses Sachgebiet zurück oder löscht es vollständig. Diese Aktionen sind nicht rückgängig zu machen.
          </div>
          <div className="storage-zone-actions">
            <button
              className="btn danger"
              onClick={async () => {
                setResetConfirmText('')
                await ensureActiveOrgLoaded()
                setShowResetOrg(true)
              }}
            >
              Zurücksetzen…
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                setDeleteOrgConfirmText('')
                await ensureActiveOrgLoaded()
                setShowDeleteOrg(true)
              }}
            >
              Löschen…
            </button>
          </div>
        </div>
      </section>

      {/* Import comparison modal */}
      {importPick && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !busyImport && setImportPick(null)}>
          <div className="modal modal-wide modal-grid" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import vergleichen</h2>
              <button className="btn ghost" onClick={() => setImportPick(null)}>✕</button>
            </div>
            <div className="helper helper-danger">
              Die aktuelle Datenbank wird beim Import überschrieben. Prüfe die Tabellenstände, bevor du fortfährst.
            </div>
            <div className="card compare-table">
              <div className="compare-header">
                <div>Tabelle</div>
                <div className="compare-badge-current">Aktuell</div>
                <div className="compare-badge-target">Import</div>
              </div>
              <div className="compare-rows">
                {(() => {
                  const currentCounts = importPick.currentCounts || {}
                  const importCounts = importPick.counts || {}
                  const tableNames: Record<string, string> = {
                    'invoice_files': 'Verbindlichkeitsdateien',
                    'invoices': 'Verbindlichkeiten',
                    'members': 'Mitglieder',
                    'tags': 'Tags',
                    'voucher_files': 'Belegdateien',
                    'vouchers': 'Buchungen',
                    'budgets': 'Budgets',
                    'bindings': 'Zweckbindungen',
                    'member_payments': 'Mitgliedsbeiträge',
                    'audit_log': 'Änderungsprotokoll',
                    'settings': 'Einstellungen'
                  }
                  const all = Array.from(new Set([...Object.keys(currentCounts), ...Object.keys(importCounts)])).sort()
                  return all.map(k => {
                    const cur = currentCounts[k] ?? 0
                    const imp = importCounts[k] ?? 0
                    const diff = cur !== imp
                    return (
                      <React.Fragment key={k}>
                        <div>{tableNames[k] || k}</div>
                        <div className={diff ? 'compare-cell compare-cell-diff' : 'compare-cell'}>{cur}</div>
                        <div className={diff ? 'compare-cell compare-cell-diff-blue' : 'compare-cell'}>{imp}</div>
                      </React.Fragment>
                    )
                  })
                })()}
                {(() => {
                  const currentCounts = importPick.currentCounts || {}
                  const importCounts = importPick.counts || {}
                  if (!Object.keys(currentCounts).length && !Object.keys(importCounts).length) {
                    return <div className="compare-no-data helper">Keine Tabellenstände verfügbar.</div>
                  }
                  return null
                })()}
              </div>
            </div>
            <div className="modal-actions-end">
              <button className="btn" disabled={busyImport} onClick={() => setImportPick(null)}>Abbrechen</button>
              <button className="btn danger" disabled={busyImport} onClick={async () => {
                try {
                  setBusyImport(true)
                  const api = window.api?.db?.import as any
                  const res = await api?.fromPath?.(importPick.filePath)
                  if (res?.ok) {
                    notify('success', 'Datenbank importiert. Neu laden …')
                    window.dispatchEvent(new Event('data-changed'))
                    window.setTimeout(() => window.location.reload(), 600)
                  }
                } catch (e: any) {
                  const msg = e?.message || String(e)
                  notify('error', msg)
                } finally {
                  setBusyImport(false)
                  setImportPick(null)
                }
              }}>Import bestätigen</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset current Sachgebiet Confirmation Modal */}
      {showResetOrg && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !busyDanger && setShowResetOrg(false)}>
          <div className="modal modal-grid" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sachgebiet zurücksetzen</h2>
              <button className="btn ghost" onClick={() => setShowResetOrg(false)} aria-label="Schließen">✕</button>
            </div>
            <div className="helper">
              Dieser Vorgang löscht die komplette Datenbank und alle Anhänge dieses Sachgebiets{activeOrg?.name ? ` ("${activeOrg.name}")` : ''} dauerhaft.
              Danach wird eine leere Datenbank neu initialisiert. Dies kann nicht rückgängig gemacht werden.
            </div>
            <div className="field">
              <label>Zur Bestätigung bitte exakt "ZURÜCKSETZEN" eingeben</label>
              <input
                className="input"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.currentTarget.value)}
                placeholder="ZURÜCKSETZEN"
              />
            </div>
            <div className="modal-actions-end">
              <button className="btn" disabled={busyDanger} onClick={() => setShowResetOrg(false)}>Abbrechen</button>
              <button
                className="btn danger"
                disabled={busyDanger || resetConfirmText !== 'ZURÜCKSETZEN'}
                onClick={async () => {
                  setBusyDanger(true)
                  try {
                    await (window as any).api?.organizations?.resetCurrentData?.()
                    setShowResetOrg(false)
                    notify('success', 'Sachgebiet zurückgesetzt. Neu laden …')
                    window.dispatchEvent(new Event('data-changed'))
                    window.setTimeout(() => window.location.reload(), 600)
                  } catch (e: any) {
                    notify('error', e?.message || String(e))
                  } finally {
                    setBusyDanger(false)
                  }
                }}
              >
                Ja, zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sachgebiet Confirmation Modal */}
      {showDeleteOrg && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !busyDanger && setShowDeleteOrg(false)}>
          <div className="modal modal-grid" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sachgebiet löschen</h2>
              <button className="btn ghost" onClick={() => setShowDeleteOrg(false)} aria-label="Schließen">✕</button>
            </div>
            <div className="helper">
              Dieses Sachgebiet{activeOrg?.name ? ` ("${activeOrg.name}")` : ''} wird vollständig gelöscht (inkl. Datenbank und Anhänge).
              Dies ist irreversibel.
            </div>
            <div className="field">
              <label>Zur Bestätigung bitte exakt "LÖSCHEN" eingeben</label>
              <input
                className="input"
                value={deleteOrgConfirmText}
                onChange={(e) => setDeleteOrgConfirmText(e.currentTarget.value)}
                placeholder="LÖSCHEN"
              />
            </div>
            <div className="modal-actions-end">
              <button className="btn" disabled={busyDanger} onClick={() => setShowDeleteOrg(false)}>Abbrechen</button>
              <button
                className="btn danger"
                disabled={busyDanger || deleteOrgConfirmText !== 'LÖSCHEN'}
                onClick={async () => {
                  setBusyDanger(true)
                  try {
                    const org = await ensureActiveOrgLoaded()
                    if (!org) throw new Error('Aktives Sachgebiet konnte nicht ermittelt werden')
                    await (window as any).api?.organizations?.delete?.({ orgId: org.id, deleteData: true })
                    setShowDeleteOrg(false)
                    notify('success', 'Sachgebiet gelöscht. Neu laden …')
                    window.dispatchEvent(new Event('data-changed'))
                    window.setTimeout(() => window.location.reload(), 600)
                  } catch (e: any) {
                    notify('error', e?.message || String(e))
                  } finally {
                    setBusyDanger(false)
                  }
                }}
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Fallback simple migrate modal */}
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

      {compareModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !busy && setCompareModal(null)}>
          <div className="modal modal-wider modal-grid-14" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>
                {compareModal.mode === 'folder' ? 'Datenbanken vergleichen' : 'Standard-Datenbank Vergleich'}
              </h2>
              <button className="btn ghost" onClick={() => setCompareModal(null)} aria-label="Schließen">✕</button>
            </header>
            <div className="helper helper-mt-neg">
              {compareModal.mode === 'folder' ? (
                compareModal.hasTargetDb ? 'Im gewählten Ordner wurde eine bestehende Datenbank gefunden. Vergleiche die Tabellenstände und wähle eine Aktion.' : 'Der gewählte Ordner enthält keine Datenbank. Du kannst deine aktuelle Datenbank dorthin migrieren.'
              ) : (
                compareModal.hasTargetDb ? 'Es existiert bereits eine Standard-Datenbank. Vergleiche Tabellenstände, bevor du wechselst oder migrierst.' : 'Im Standardordner liegt keine Datenbank. Du kannst deine aktuelle dorthin migrieren.'
              )}
            </div>
            <div className="card compare-table-10">
              <div className="compare-header">
                <div>Tabelle</div>
                <div className="compare-badge-current">Aktuell</div>
                <div className="compare-badge-target">{compareModal.mode === 'folder' ? 'Gewählt' : 'Standard'}</div>
              </div>
              <div className="compare-rows">
                {(() => {
                  // Map technical table names to German
                  const tableNames: Record<string, string> = {
                    'invoice_files': 'Verbindlichkeitsdateien',
                    'invoices': 'Verbindlichkeiten',
                    'members': 'Mitglieder',
                    'tags': 'Tags',
                    'voucher_files': 'Belegdateien',
                    'vouchers': 'Buchungen',
                    'budgets': 'Budgets',
                    'bindings': 'Zweckbindungen',
                    'member_payments': 'Mitgliedsbeiträge',
                    'audit_log': 'Änderungsprotokoll',
                    'settings': 'Einstellungen'
                  }
                  
                  const allTables = Array.from(new Set([
                    ...Object.keys(compareModal.currentCounts || {}),
                    ...Object.keys(compareModal.targetCounts || {})
                  ])).sort()
                  
                  return allTables.map(k => {
                    const current = compareModal.currentCounts[k] ?? 0
                    const target = (compareModal.targetCounts || {})[k] ?? 0
                    const isDifferent = current !== target
                    const germanName = tableNames[k] || k
                    
                    return (
                      <React.Fragment key={k}>
                        <div>{germanName}</div>
                        <div className={isDifferent ? 'compare-cell-diff-current' : 'compare-cell'}>
                          {current}
                        </div>
                        <div className={isDifferent ? 'compare-cell-diff-target' : 'compare-cell'}>
                          {target || '0'}
                        </div>
                      </React.Fragment>
                    )
                  })
                })()}
                {Object.keys(compareModal.currentCounts).length === 0 && Object.keys(compareModal.targetCounts || {}).length === 0 && (
                  <div className="compare-no-data helper">Keine Tabellenstände verfügbar.</div>
                )}
              </div>
            </div>
            <div className="modal-actions-between">
              <div className="helper helper-flex-1">
                {compareModal.mode === 'folder' ? (
                  compareModal.hasTargetDb ? 'Aktion wählen: Bestehende Datenbank verwenden oder aktuelle Datenbank in den Ordner kopieren.' : 'Aktion wählen: Aktuelle Datenbank in den Ordner kopieren.'
                ) : (
                  compareModal.hasTargetDb ? 'Aktion wählen: Standard-Datenbank verwenden oder aktuelle zur Standard migrieren.' : 'Aktion wählen: Aktuelle Datenbank zum Standard migrieren.'
                )}
              </div>
              <div className="storage-actions">
                {compareModal.mode === 'folder' && compareModal.hasTargetDb && (
                  <button className="btn" onClick={useSelectedFolder} disabled={busy}>Bestehende verwenden</button>
                )}
                {compareModal.mode === 'default' && compareModal.hasTargetDb && (
                  <button className="btn" onClick={useDefaultDb} disabled={busy}>Standard verwenden</button>
                )}
                {compareModal.mode === 'folder' && (
                  <button className="btn primary" onClick={migrateToSelectedFolder} disabled={busy}>Aktuelle migrieren</button>
                )}
                {compareModal.mode === 'default' && (
                  <button className="btn primary" onClick={migrateToDefaultDb} disabled={busy}>Aktuelle migrieren</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {restorePick && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !busyRestore && setRestorePick(null)}>
          <div className="modal modal-grid" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Backup wiederherstellen</h2>
              <button className="btn ghost" onClick={() => setRestorePick(null)} aria-label="Schließen" disabled={busyRestore}>✕</button>
            </div>
            <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
              <div className="helper">Ausgewähltes Backup</div>
              <div style={{ wordBreak: 'break-all' }}><code>{restorePick.filePath}</code></div>
              <div className="helper">Datum</div>
              <div>{new Date(restorePick.mtime).toLocaleString('de-DE')}</div>
              <div className="helper">Größe</div>
              <div>{(restorePick.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div className="helper helper-danger">
              Achtung: Diese Aktion ersetzt die aktuell verwendete Datenbankdatei. Das kann nicht rückgängig gemacht werden.
              Anhänge werden dabei nicht automatisch wiederhergestellt.
            </div>
            <div className="modal-actions-end">
              <button className="btn" onClick={() => setRestorePick(null)} disabled={busyRestore}>Abbrechen</button>
              <button className="btn danger" onClick={confirmRestore} disabled={busyRestore}>Ja, wiederherstellen</button>
            </div>
          </div>
        </div>
      )}

      {err && <div className="error-text">{err}</div>}
    </div>
  )
}
