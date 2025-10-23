import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
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
    let root = getConfiguredRoot()
    try {
        if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    } catch {
        // Fallback: configured root ist nicht verfügbar (z. B. Netzwerklaufwerk entfernt)
        // Verwende den Standard-App-Datenordner, damit der Prozess nicht abstürzt.
        root = app.getPath('userData')
        try { if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true }) } catch { /* last resort: ignore, other calls will throw with clearer errors */ }
    }
    const filesDir = path.join(root, 'files')
    try {
        if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true })
    } catch {
        // Wenn selbst der files-Ordner nicht angelegt werden kann, belasse ihn als Pfad;
        // nachgelagerte Funktionen behandeln dies und liefern verständlichere Fehlermeldungen.
    }
    return { root, filesDir }
}

type DB = any
let db: DB | undefined

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
    db = new BetterSqlite3(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
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

// Migrate database and attachments to a new root directory.
// mode: 'use' -> just switch to the folder (expects a database.sqlite there), no copy
//       'copy-overwrite' -> copy current DB and attachments to new root; rewrite attachment file paths
export function migrateToRoot(newRoot: string, mode: 'use' | 'copy-overwrite' = 'copy-overwrite') {
    if (!newRoot || typeof newRoot !== 'string') throw new Error('Ungültiger Zielordner')
    const normalizedTarget = path.resolve(newRoot)
    if (!fs.existsSync(normalizedTarget)) fs.mkdirSync(normalizedTarget, { recursive: true })
    const dstRoot = normalizedTarget
    const dstFilesDir = path.join(dstRoot, 'files')
    if (!fs.existsSync(dstFilesDir)) fs.mkdirSync(dstFilesDir, { recursive: true })
    const dstDbPath = path.join(dstRoot, 'database.sqlite')

    // Close current DB so OS file locks are released
    try { closeDb() } catch { }

    if (mode === 'use') {
        // Use existing folder: do not depend on current root availability
        if (!fs.existsSync(dstDbPath)) throw new Error('Im gewählten Ordner wurde keine database.sqlite gefunden')
        writeAppConfig({ ...readAppConfig(), dbRoot: dstRoot })
        return { root: dstRoot, dbPath: dstDbPath, filesDir: dstFilesDir }
    }

    // copy-overwrite requires access to current DB as source
    let srcRoot = ''
    let srcDbPath = ''
    let srcFilesDir = ''
    try {
        const currentInfo = getCurrentDbInfo()
        srcRoot = currentInfo.root
        srcDbPath = currentInfo.dbPath
        srcFilesDir = currentInfo.filesDir
    } catch (e: any) {
        throw new Error('Aktueller Speicherort ist nicht verfügbar. Verwende bitte "Bestehende verwenden" oder setze auf Standard zurück.')
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
        throw new Error('Migration der Anhänge fehlgeschlagen: ' + (e as any)?.message)
    }

    // Persist new root in config
    writeAppConfig({ ...readAppConfig(), dbRoot: dstRoot })

    return { root: dstRoot, dbPath: dstDbPath, filesDir: dstFilesDir }
}
