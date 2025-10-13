import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'

const require = createRequire(import.meta.url)
let BetterSqlite3: any
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BetterSqlite3 = require('better-sqlite3')
} catch (e) {
    BetterSqlite3 = null
}

export function getAppDataDir() {
    const root = getConfiguredRoot()
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    const filesDir = path.join(root, 'files')
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true })
    return { root, filesDir }
}

type DB = any
let db: DB | undefined
let appLockMode: 'rw' | 'ro' | undefined
let appLockHeld = false
let appLockOwner: string | undefined

// Simple app-level JSON config (outside DB) to remember custom DB location
type AppConfig = { dbRoot?: string }
function getConfigPath() {
    const ud = app.getPath('userData')
    if (!fs.existsSync(ud)) fs.mkdirSync(ud, { recursive: true })
    return path.join(ud, 'config.json')
}
export function readAppConfig(): AppConfig {
    try {
        const p = getConfigPath()
        if (!fs.existsSync(p)) return {}
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw) as AppConfig
    } catch { return {} }
}
export function writeAppConfig(cfg: AppConfig) {
    const p = getConfigPath()
    try { fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8') } catch { }
}
export function getConfiguredRoot(): string {
    const cfg = readAppConfig()
    return (cfg.dbRoot && typeof cfg.dbRoot === 'string' && cfg.dbRoot.trim()) ? cfg.dbRoot : app.getPath('userData')
}
export function getCurrentDbInfo() {
    const { root, filesDir } = getAppDataDir()
    const dbPath = path.join(root, 'database.sqlite')
    return { root, filesDir, dbPath }
}

function getLockPath(): string {
    const { root } = getAppDataDir()
    return path.join(root, 'db.lock')
}

function acquireAppLock(): { mode: 'rw' | 'ro'; owner?: string } {
    if (appLockMode) return { mode: appLockMode, owner: appLockOwner }
    const lockPath = getLockPath()
    try {
        const fd = fs.openSync(lockPath, 'wx')
        const info = { host: os.hostname(), user: process.env.USERNAME || process.env.USER || 'user', pid: process.pid, startedAt: Date.now() }
        fs.writeFileSync(fd, JSON.stringify(info), 'utf8')
        fs.closeSync(fd)
        appLockMode = 'rw'
        appLockHeld = true
        appLockOwner = `${info.user}@${info.host} (pid ${info.pid})`
    } catch (e: any) {
        if (e?.code === 'EEXIST') {
            appLockMode = 'ro'
            try {
                const raw = fs.readFileSync(lockPath, 'utf8')
                const o = JSON.parse(raw)
                appLockOwner = `${o.user || 'user'}@${o.host || 'host'}${o.pid ? ` (pid ${o.pid})` : ''}`
            } catch { /* ignore */ }
        } else {
            // On unexpected error, fall back to read-only to be safe
            appLockMode = 'ro'
        }
    }
    return { mode: appLockMode!, owner: appLockOwner }
}

export function releaseAppLock() {
    if (appLockHeld && appLockMode === 'rw') {
        try { fs.unlinkSync(getLockPath()) } catch { /* ignore */ }
    }
    appLockHeld = false
}

export function getDb(): DB {
    if (db) return db
    if (!BetterSqlite3) {
        throw new Error(
            'better-sqlite3 native bindings konnten nicht geladen werden.\n' +
            'Stelle sicher, dass die Abhängigkeit für die Electron-Version neu gebaut wurde.\n\n' +
            'Schritte (Windows):\n' +
            '1) Installiere Visual Studio 2022 mit dem Workload "Desktopentwicklung mit C++" inkl. ARM64 (falls ARM-Gerät).\n' +
            '2) Stelle sicher, dass Python 3 installiert ist und in PATH liegt.\n' +
            '3) Führe im Projektordner aus: npm run rebuild:native\n' +
            '4) Starte die App neu.'
        )
    }
    const { root } = getAppDataDir()
    const dbPath = path.join(root, 'database.sqlite')
    const { mode } = acquireAppLock()
    db = new BetterSqlite3(dbPath, { readonly: mode === 'ro', fileMustExist: mode === 'ro' })
    // Busy timeout to wait for locks instead of failing immediately
    try { db.pragma('busy_timeout = 5000') } catch { /* ignore */ }
    // WAL only when we are the writer
    if (mode === 'rw') {
        try { db.pragma('journal_mode = WAL') } catch { /* ignore */ }
    }
    try { db.pragma('foreign_keys = ON') } catch { /* ignore */ }
    return db
}

export function withTransaction<T>(fn: (db: DB) => T): T {
    const d = getDb()
    const trx = d.transaction(() => fn(d))
    return trx()
}

export function closeDb() {
    if (db) {
        db.close()
        db = undefined
    }
}

export function getDbOpenInfo(): { mode: 'rw' | 'ro'; owner?: string | undefined } {
    if (!appLockMode) { acquireAppLock() }
    return { mode: appLockMode || 'rw', owner: appLockOwner }
}

// Migrate database and attachments to a new root directory.
// mode: 'use' -> just switch to the folder (expects a database.sqlite there), no copy
//       'copy-overwrite' -> copy current DB and attachments to new root; rewrite attachment file paths
export function migrateToRoot(newRoot: string, mode: 'use' | 'copy-overwrite' = 'copy-overwrite') {
    if (!newRoot || typeof newRoot !== 'string') throw new Error('Ungültiger Zielordner')
    const normalizedTarget = path.resolve(newRoot)
    if (!fs.existsSync(normalizedTarget)) fs.mkdirSync(normalizedTarget, { recursive: true })

    const currentInfo = getCurrentDbInfo()
    const srcRoot = currentInfo.root
    const srcDbPath = currentInfo.dbPath
    const srcFilesDir = currentInfo.filesDir

    const dstRoot = normalizedTarget
    const dstFilesDir = path.join(dstRoot, 'files')
    if (!fs.existsSync(dstFilesDir)) fs.mkdirSync(dstFilesDir, { recursive: true })
    const dstDbPath = path.join(dstRoot, 'database.sqlite')

    // Close current DB so OS file locks are released
    try { closeDb() } catch { }

    if (mode === 'use') {
        if (!fs.existsSync(dstDbPath)) throw new Error('Im gewählten Ordner wurde keine database.sqlite gefunden')
        // Save config and return; do not touch files
        writeAppConfig({ ...readAppConfig(), dbRoot: dstRoot })
        return { root: dstRoot, dbPath: dstDbPath, filesDir: dstFilesDir }
    }

    // copy-overwrite: copy DB file
    try { fs.copyFileSync(srcDbPath, dstDbPath) } catch (e) { throw new Error('Kopieren der Datenbank fehlgeschlagen: ' + (e as any)?.message) }

    // Try to update attachment paths inside the copied DB and copy files
    try {
        const d = new BetterSqlite3(dstDbPath)
        d.pragma('journal_mode = WAL')
        const rows = d.prepare('SELECT id, file_path FROM voucher_files').all() as Array<{ id: number; file_path: string }>
        for (const r of rows) {
            const baseName = path.basename(r.file_path)
            const src = path.join(srcFilesDir, baseName)
            const dst = path.join(dstFilesDir, baseName)
            try {
                if (fs.existsSync(src)) fs.copyFileSync(src, dst)
            } catch { /* ignore */ }
            d.prepare('UPDATE voucher_files SET file_path = ? WHERE id = ?').run(dst, r.id)
        }
        d.close()
    } catch (e) {
        // If anything fails, leave DB as-is; user can reattach files manually
        // Re-throw to signal UI
        throw new Error('Migration der Anhänge fehlgeschlagen: ' + (e as any)?.message)
    }

    // Persist new root in config
    writeAppConfig({ ...readAppConfig(), dbRoot: dstRoot })

    return { root: dstRoot, dbPath: dstDbPath, filesDir: dstFilesDir }
}
