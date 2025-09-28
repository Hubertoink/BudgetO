import { app, BrowserWindow, shell, Menu, session, dialog } from 'electron'
import { getDb } from './db/database'
import { applyMigrations } from './db/migrations'
import { registerIpcHandlers } from './ipc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

async function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
    minWidth: 1264,
        minHeight: 640,
        show: false,
        autoHideMenuBar: true,
        frame: false,
        title: 'VereinO',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            devTools: isDev
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
            "connect-src 'self' http://localhost:5173 ws://localhost:5173;",
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
            "connect-src 'self';",
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

app.whenReady().then(() => {
    // DB init + migrations
    try {
        const db = getDb()
            ; (global as any).singletonDb = db
        applyMigrations(db)
    } catch (err: any) {
        console.error('DB init/migrations failed', err)
        dialog.showErrorBox('Datenbank-Fehler', String(err?.message || err))
        // In einem unrecoverable Zustand beenden
        app.exit(1)
        return
    }
    registerIpcHandlers()
    createMenu()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
