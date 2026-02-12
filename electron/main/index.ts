import { app, BrowserWindow, shell, Menu, session, dialog, Tray, nativeImage, ipcMain } from 'electron'
import { getDb } from './db/database'
import { getSetting, setSetting } from './services/settings'
import * as backup from './services/backup'
import { applyMigrations } from './db/migrations'
import { registerIpcHandlers } from './ipc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getServerStatus } from './services/apiServer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged
const enableDevTools = isDev || process.env.BUDGETO_DEVTOOLS === '1'

let tray: Tray | null = null
let allowQuit = false

function getWindowsIconPath(): string {
    // Keep in sync with electron-builder.yml and ensure the file is packaged via `files: - assets/**`
    const icoName = 'Budget_Logo.ico'
    if (app.isPackaged) {
        // In production the app is inside resources/app.asar
        return path.join(process.resourcesPath, 'app.asar', 'assets', icoName)
    }
    return path.join(process.cwd(), 'assets', icoName)
}

function ensureTray(win: BrowserWindow): Tray {
    if (tray) return tray
    const icon = nativeImage.createFromPath(getWindowsIconPath())
    tray = new Tray(icon)
    tray.setToolTip('BudgetO')

    const showWindow = () => {
        try { win.setSkipTaskbar(false) } catch {}
        win.show()
        win.focus()
    }

    const quitApp = () => {
        allowQuit = true
        app.quit()
    }

    const menu = Menu.buildFromTemplate([
        { label: 'BudgetO öffnen', click: showWindow },
        { type: 'separator' },
        { label: 'Beenden', click: quitApp }
    ])
    tray.setContextMenu(menu)

    tray.on('click', showWindow)
    tray.on('double-click', showWindow)
    return tray
}

function hideToTray(win: BrowserWindow) {
    ensureTray(win)
    try { win.setSkipTaskbar(true) } catch {}
    win.hide()
}

async function createWindow(): Promise<BrowserWindow> {
    const winIconPath = getWindowsIconPath()
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        // Allow portrait/kiosk screens (e.g. 1080x1920) without forcing horizontal overflow.
        minWidth: 900,
        minHeight: 640,
        show: false,
        autoHideMenuBar: true,
        frame: false,
        title: 'BudgetO',
        // Set explicitly so the distributed build shows an icon (titlebar/taskbar)
        icon: winIconPath,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            devTools: enableDevTools
        }
    })

    win.on('ready-to-show', () => win.show())
    win.on('maximize', () => win.webContents.send('window:maximized', true))
    win.on('unmaximize', () => win.webContents.send('window:unmaximized', false))

    // Content Security Policy via headers (relaxed in dev for Vite/HMR)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const devCsp = [
            "default-src 'self' http://localhost:5173;",
            "base-uri 'self';",
            "object-src 'none';",
            "img-src 'self' data: blob:;",
            "font-src 'self' data:;",
            "style-src 'self' 'unsafe-inline';",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http://localhost:5173;",
            "connect-src 'self' http://localhost:5173 ws://localhost:5173 http://localhost:3000 https://*.mittwald.io;",
            "frame-src 'self' blob: data:;",
            "child-src 'self' blob: data:;",
            "frame-ancestors 'none'"
        ].join(' ')

        const prodCsp = [
            "default-src 'self';",
            "base-uri 'self';",
            "object-src 'none';",
            "img-src 'self' data:;",
            "font-src 'self' data:;",
            "style-src 'self' 'unsafe-inline';",
            "script-src 'self';",
            "connect-src 'self' https://*.mittwald.io;",
            "frame-src 'self' blob: data:;",
            "child-src 'self' blob: data:;",
            "frame-ancestors 'none'"
        ].join(' ')

        const csp = isDev ? devCsp : prodCsp

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp]
            }
        })
    })

    if (isDev) {
        const url = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
        await win.loadURL(url)
        // DevTools can be opened manually via menu or keyboard
    } else {
        await win.loadFile(path.join(__dirname, '../../dist/index.html'))
    }

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    return win
}

function createMenu() {
    if (isDev) {
        const template: Electron.MenuItemConstructorOptions[] = [
            { role: 'appMenu' },
            { role: 'fileMenu' },
            { role: 'editMenu' },
            { role: 'viewMenu' },
            { role: 'windowMenu' }
        ]
        const menu = Menu.buildFromTemplate(template)
        Menu.setApplicationMenu(menu)
    } else {
        // No application menu in production
        Menu.setApplicationMenu(null)
    }
}

app.whenReady().then(async () => {
    // Try DB init + migrations, but don't exit on failure – let renderer handle recovery
    let dbInitError: any = null
    try {
        const db = getDb()
        ; (global as any).singletonDb = db
        applyMigrations(db)
        
        // CRITICAL FIX: Always ensure enforce_time_range columns exist
        // This handles cases where migration 20 might have failed silently
        try {
            const budgetCols = db.prepare("PRAGMA table_info(budgets)").all() as Array<{ name: string }>
            const hasEnforceInBudgets = budgetCols.some((c: { name: string }) => c.name === 'enforce_time_range')
            
            if (!hasEnforceInBudgets) {
                console.log('[Startup] Adding missing enforce_time_range columns')
                db.exec('ALTER TABLE budgets ADD COLUMN enforce_time_range INTEGER NOT NULL DEFAULT 0')
                db.exec('ALTER TABLE earmarks ADD COLUMN enforce_time_range INTEGER NOT NULL DEFAULT 0')
                
                // Mark migration 20 as applied if not already
                const migrations = db.prepare('SELECT version FROM migrations').all() as Array<{ version: number }>
                const hasV20 = migrations.some((m: { version: number }) => m.version === 20)
                if (!hasV20) {
                    db.prepare('INSERT INTO migrations(version) VALUES (?)').run(20)
                }
                console.log('[Startup] enforce_time_range columns added successfully')
            }
        } catch (colErr: any) {
            console.error('[Startup] Failed to ensure enforce_time_range columns:', colErr)
            // Don't throw - let the app try to start anyway
        }
    } catch (err: any) {
        console.error('DB init/migrations failed', err)
        dbInitError = err
        // Do NOT block startup. We'll inform the renderer via an event so it can present recovery options.
    }
    // Register IPC first so renderer can use db.location.* to recover
    registerIpcHandlers()
    createMenu()
    
    // Auto-start API server if configured
    try {
        const { getServerConfig, startServer } = await import('./services/apiServer')
        const serverConfig = getServerConfig()
        if (serverConfig.mode === 'server' && serverConfig.autoStart) {
            console.log('[Startup] Auto-starting API server...')
            const result = await startServer()
            if (result.success) {
                console.log(`[Startup] API server running on port ${serverConfig.port}`)
            } else {
                console.error('[Startup] API server failed:', result.error)
            }
        }
    } catch (serverErr) {
        console.error('[Startup] API server init error:', serverErr)
    }
    
    const win = await createWindow()

    // Allow normal quit behavior when the app is explicitly quitting.
    app.on('before-quit', () => {
        allowQuit = true
    })

    // When server is running, intercept close and ask renderer to confirm.
    win.on('close', (e) => {
        if (allowQuit) return
        try {
            const st = getServerStatus()
            if (st?.running) {
                e.preventDefault()
                try {
                    win.webContents.send('app.closeRequest', {
                        running: true,
                        port: st.port,
                        connectedClients: st.connectedClients
                    })
                } catch {
                    // If renderer cannot be reached, fall back to not closing.
                }
            }
        } catch {
            // ignore
        }
    })

    // Renderer confirms close behavior.
    try { ipcMain.removeHandler('app.closeAction') } catch {}
    ipcMain.handle('app.closeAction', async (_e, payload: { action: 'quit' | 'tray' | 'cancel' }) => {
        const action = payload?.action
        if (action === 'quit') {
            allowQuit = true
            app.quit()
            return { ok: true }
        }
        if (action === 'tray') {
            hideToTray(win)
            return { ok: true }
        }
        return { ok: true }
    })

    // After window finished load, inform renderer if DB init failed
    if (dbInitError && win) {
        const send = () => {
            try { win.webContents.send('db:initFailed', { message: String(dbInitError?.message || dbInitError) }) } catch { /* ignore */ }
        }
        if (win.webContents.isLoading()) {
            win.webContents.once('did-finish-load', () => send())
        } else {
            send()
        }
    }

    // Auto-backup on startup (configurable)
    ;(async () => {
        try {
            const mode = (getSetting<string>('backup.auto') || 'PROMPT').toUpperCase() as 'SILENT' | 'PROMPT' | 'OFF'
            const intervalDays = Number(getSetting<number>('backup.intervalDays') || 7)
            const lastAuto = Number(getSetting<number>('backup.lastAuto') || 0)
            if (mode === 'OFF') return
            const now = Date.now()
            const due = !lastAuto || (now - lastAuto) > intervalDays * 24 * 60 * 60 * 1000
            if (!due) return
            if (mode === 'SILENT') {
                try { await backup.makeBackup('auto') } catch { /* ignore */ }
                setSetting('backup.lastAuto', now)
            } else if (mode === 'PROMPT') {
                // Renderer will handle user-facing prompt with a custom modal
                // (We avoid showing a native OS message box here to keep UX consistent.)
            }
        } catch { /* ignore */ }
    })()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
