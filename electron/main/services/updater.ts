import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
export type UpdateStatus = {
  phase: UpdatePhase
  currentVersion: string
  version?: string
  releaseName?: string | null
  releaseDate?: string | null
  releaseNotes?: string | null
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  message?: string
  packaged: boolean
}

let initialized = false
let status: UpdateStatus = {
  phase: 'idle',
  currentVersion: app.getVersion(),
  packaged: app.isPackaged
}

function notesToText(notes: UpdateInfo['releaseNotes']): string | null {
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) return notes.map((entry) => entry.note).filter(Boolean).join('\n\n') || null
  return null
}

function publish(next: Partial<UpdateStatus>) {
  status = { ...status, ...next, currentVersion: app.getVersion(), packaged: app.isPackaged }
  for (const window of BrowserWindow.getAllWindows()) {
    try { window.webContents.send('updates:status', status) } catch { /* window may be closing */ }
  }
  return status
}

export function initializeUpdater() {
  if (initialized) return
  initialized = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', message: undefined }))
  autoUpdater.on('update-available', (info) => publish({
    phase: 'available',
    version: info.version,
    releaseName: info.releaseName || null,
    releaseDate: info.releaseDate || null,
    releaseNotes: notesToText(info.releaseNotes),
    percent: 0,
    message: undefined
  }))
  autoUpdater.on('update-not-available', (info) => publish({ phase: 'not-available', version: info.version, message: 'BudgetO ist aktuell.' }))
  autoUpdater.on('download-progress', (progress: ProgressInfo) => publish({
    phase: 'downloading',
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
    message: undefined
  }))
  autoUpdater.on('update-downloaded', (info) => publish({
    phase: 'downloaded',
    version: info.version,
    releaseName: info.releaseName || null,
    releaseDate: info.releaseDate || null,
    releaseNotes: notesToText(info.releaseNotes),
    percent: 100,
    message: 'Update ist bereit zur Installation.'
  }))
  autoUpdater.on('error', (error) => publish({ phase: 'error', message: error?.message || String(error) }))
}

export function getUpdateStatus(): UpdateStatus {
  initializeUpdater()
  return { ...status, currentVersion: app.getVersion(), packaged: app.isPackaged }
}

export async function checkForAppUpdates(): Promise<UpdateStatus> {
  initializeUpdater()
  if (!app.isPackaged) return publish({ phase: 'error', message: 'Die Update-Prüfung ist nur in der installierten BudgetO-App verfügbar.' })
  publish({ phase: 'checking', message: undefined })
  await autoUpdater.checkForUpdates()
  return getUpdateStatus()
}

export async function downloadAppUpdate(): Promise<UpdateStatus> {
  initializeUpdater()
  if (!app.isPackaged) return publish({ phase: 'error', message: 'Updates können nur in der installierten App geladen werden.' })
  if (status.phase !== 'available' && status.phase !== 'error') return getUpdateStatus()
  publish({ phase: 'downloading', percent: status.percent || 0, message: undefined })
  await autoUpdater.downloadUpdate()
  return getUpdateStatus()
}

export function installAppUpdate(): { ok: boolean } {
  initializeUpdater()
  if (status.phase !== 'downloaded') throw new Error('Es ist noch kein Update zur Installation bereit.')
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true }
}
