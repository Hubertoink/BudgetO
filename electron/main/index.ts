import { app, BrowserWindow, shell, Menu, session, dialog, Tray, nativeImage, ipcMain, screen } from 'electron'
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
const detachedBookingInitials = new Map<string, any>()
const detachedBookingWindows = new Map<string, BrowserWindow>()
const DETACHED_BOOKING_BOUNDS_SETTING = 'ui.detachedBookingBounds'

type WindowBounds = { x: number; y: number; width: number; height: number }

function getDetachedBookingBounds(): WindowBounds | undefined {
    try {
        const saved = getSetting<Partial<WindowBounds>>(DETACHED_BOOKING_BOUNDS_SETTING)
        if (![saved?.x, saved?.y, saved?.width, saved?.height].every(Number.isFinite)) return undefined
        const bounds = {
            x: Math.round(saved!.x!),
            y: Math.round(saved!.y!),
            width: Math.max(860, Math.round(saved!.width!)),
            height: Math.max(620, Math.round(saved!.height!))
        }
        const isVisible = screen.getAllDisplays().some(({ workArea }) => {
            const overlapWidth = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x)
            const overlapHeight = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y)
            return overlapWidth >= 100 && overlapHeight >= 100
        })
        return isVisible ? bounds : undefined
    } catch {
        return undefined
    }
}

let tray: Tray | null = null
let allowQuit = false

function createWindowOpenHandler() {
    return ({ url }: { url: string }) => {
        void shell.openExternal(url)
        return { action: 'deny' as const }
    }
}

async function createDetachedBookingWindow(initialState?: any): Promise<{ ok: boolean; token: string }> {
    const token = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const draftId = String(initialState?.draftId || token)
    const existing = detachedBookingWindows.get(draftId)
    if (existing && !existing.isDestroyed()) {
        if (existing.isMinimized()) existing.restore()
        existing.show()
        existing.focus()
        return { ok: true, token }
    }

    detachedBookingInitials.set(token, initialState || null)
    const savedBounds = getDetachedBookingBounds()
    const win = new BrowserWindow({
        width: 1180,
        height: 780,
        ...(savedBounds || {}),
        minWidth: 860,
        minHeight: 620,
        show: false,
        autoHideMenuBar: true,
        frame: true,
        title: initialState?.mode === 'edit' ? 'BudgetO – Buchung bearbeiten' : 'BudgetO – Neue Buchung',
        icon: getWindowsIconPath(),
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            devTools: enableDevTools
        }
    })

    let allowClose = false
    ;(win as any).__allowRendererClose = () => { allowClose = true }
    win.on('close', (event) => {
        if (allowClose || win.webContents.isDestroyed()) {
            if (!win.isDestroyed()) {
                try { setSetting(DETACHED_BOOKING_BOUNDS_SETTING, win.getNormalBounds()) } catch { /* ignore */ }
            }
            return
        }
        event.preventDefault()
        try { win.webContents.send('window:close-requested') } catch { allowClose = true; win.close() }
    })
    win.on('ready-to-show', () => win.show())
    detachedBookingWindows.set(draftId, win)
    win.on('closed', () => {
        detachedBookingInitials.delete(token)
        detachedBookingWindows.delete(draftId)
        for (const browserWindow of BrowserWindow.getAllWindows()) {
            try { browserWindow.webContents.send('quickAdd:detachedClosed', { draftId }) } catch { /* ignore */ }
        }
    })

    if (isDev) {
        const url = new URL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173')
        url.searchParams.set('window', 'booking')
        url.searchParams.set('token', token)
        await win.loadURL(url.toString())
    } else {
        await win.loadFile(path.join(__dirname, '../../dist/index.html'), { query: { window: 'booking', token } })
    }
    win.webContents.setWindowOpenHandler(createWindowOpenHandler())
    return { ok: true, token }
}

function focusDetachedBookingWindow(draftId: string) {
    const win = detachedBookingWindows.get(draftId)
    if (!win || win.isDestroyed()) return { ok: false }
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return { ok: true }
}

function closeDetachedBookingWindow(draftId: string) {
    const win = detachedBookingWindows.get(draftId)
    if (!win || win.isDestroyed()) return { ok: false }
    try { ;(win as any).__allowRendererClose?.() } catch { /* ignore */ }
    win.close()
    return { ok: true }
}

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
        showWindow()
        try {
            const st = getServerStatus()
            win.webContents.send('app.closeRequest', {
                running: !!st?.running,
                port: st?.port,
                connectedClients: st?.connectedClients
            })
        } catch {
            try { win.webContents.send('app.closeRequest', { running: false }) } catch { /* keep app alive */ }
        }
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

    win.webContents.setWindowOpenHandler(createWindowOpenHandler())

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
    registerIpcHandlers({
        openDetachedBooking: createDetachedBookingWindow,
        focusDetachedBooking: focusDetachedBookingWindow,
        closeDetachedBooking: closeDetachedBookingWindow,
        getDetachedBookingInitial: (token: string) => detachedBookingInitials.get(token) ?? null,
        notifyBookingSaved: (payload: any) => {
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                try { browserWindow.webContents.send('quickAdd:saved', payload || {}) } catch { /* ignore */ }
            }
        }
    })
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

    // Always let the renderer guard open drafts; it also adds server details when relevant.
    win.on('close', (e) => {
        if (allowQuit) return
        e.preventDefault()
        try {
            const st = getServerStatus()
            win.webContents.send('app.closeRequest', {
                running: !!st?.running,
                port: st?.port,
                connectedClients: st?.connectedClients
            })
        } catch {
            try { win.webContents.send('app.closeRequest', { running: false }) } catch { /* keep window open */ }
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
