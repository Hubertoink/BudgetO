import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    window: {
        minimize: () => ipcRenderer.invoke('window.minimize'),
        toggleMaximize: () => ipcRenderer.invoke('window.toggleMaximize'),
        isMaximized: () => ipcRenderer.invoke('window.isMaximized').then(r => !!r?.isMaximized),
        close: () => ipcRenderer.invoke('window.close'),
        onMaximizeChanged: (cb: (isMax: boolean) => void) => {
            const handler = (_: any, v: boolean) => cb(!!v)
            ipcRenderer.on('window:maximized', handler)
            ipcRenderer.on('window:unmaximized', (_e) => cb(false))
            return () => {
                ipcRenderer.removeListener('window:maximized', handler)
                ipcRenderer.removeAllListeners('window:unmaximized')
            }
        }
    },
    ping: () => 'pong',
    vouchers: {
        create: (payload: any) => ipcRenderer.invoke('vouchers.create', payload),
        reverse: (payload: any) => ipcRenderer.invoke('vouchers.reverse', payload),
        list: (payload?: any) => ipcRenderer.invoke('vouchers.list', payload),
        recent: (payload?: any) => ipcRenderer.invoke('vouchers.recent', payload),
        update: (payload: any) => ipcRenderer.invoke('vouchers.update', payload),
        delete: (payload: any) => ipcRenderer.invoke('vouchers.delete', payload),
        batchAssignEarmark: (payload: any) => ipcRenderer.invoke('vouchers.batchAssignEarmark', payload),
        batchAssignBudget: (payload: any) => ipcRenderer.invoke('vouchers.batchAssignBudget', payload),
        batchAssignTags: (payload: any) => ipcRenderer.invoke('vouchers.batchAssignTags', payload),
        clearAll: () => ipcRenderer.invoke('vouchers.clearAll', { confirm: true })
    },
    tags: {
        list: (payload?: any) => ipcRenderer.invoke('tags.list', payload),
        upsert: (payload: any) => ipcRenderer.invoke('tags.upsert', payload),
        delete: (payload: any) => ipcRenderer.invoke('tags.delete', payload)
    },
    audit: {
        recent: (payload?: any) => ipcRenderer.invoke('audit.recent', payload)
    },
        yearEnd: {
            preview: (payload: { year: number }) => ipcRenderer.invoke('yearEnd.preview', payload),
            export: (payload: { year: number }) => ipcRenderer.invoke('yearEnd.export', payload),
            close: (payload: { year: number }) => ipcRenderer.invoke('yearEnd.close', payload),
            reopen: (payload: { year: number }) => ipcRenderer.invoke('yearEnd.reopen', payload),
            status: () => ipcRenderer.invoke('yearEnd.status')
        },
    attachments: {
        list: (payload: any) => ipcRenderer.invoke('attachments.list', payload),
        open: (payload: any) => ipcRenderer.invoke('attachments.open', payload),
        saveAs: (payload: any) => ipcRenderer.invoke('attachments.saveAs', payload),
        read: (payload: any) => ipcRenderer.invoke('attachments.read', payload),
        add: (payload: any) => ipcRenderer.invoke('attachments.add', payload),
        delete: (payload: any) => ipcRenderer.invoke('attachments.delete', payload)
    },
    bindings: {
        list: (payload?: any) => ipcRenderer.invoke('bindings.list', payload),
        upsert: (payload: any) => ipcRenderer.invoke('bindings.upsert', payload),
        delete: (payload: any) => ipcRenderer.invoke('bindings.delete', payload),
        usage: (payload: any) => ipcRenderer.invoke('bindings.usage', payload)
    },
    budgets: {
        upsert: (payload: any) => ipcRenderer.invoke('budgets.upsert', payload),
        list: (payload?: any) => ipcRenderer.invoke('budgets.list', payload),
        delete: (payload: any) => ipcRenderer.invoke('budgets.delete', payload),
        usage: (payload: any) => ipcRenderer.invoke('budgets.usage', payload)
    },
    invoices: {
        create: (payload: any) => ipcRenderer.invoke('invoices.create', payload),
        update: (payload: any) => ipcRenderer.invoke('invoices.update', payload),
        delete: (payload: any) => ipcRenderer.invoke('invoices.delete', payload),
        list: (payload?: any) => ipcRenderer.invoke('invoices.list', payload),
        summary: (payload?: any) => ipcRenderer.invoke('invoices.summary', payload),
        get: (payload: any) => ipcRenderer.invoke('invoices.get', payload),
        addPayment: (payload: any) => ipcRenderer.invoke('invoices.addPayment', payload),
        markPaid: (payload: any) => ipcRenderer.invoke('invoices.markPaid', payload)
    },
    invoiceFiles: {
        open: (payload: any) => ipcRenderer.invoke('invoiceFiles.open', payload),
        saveAs: (payload: any) => ipcRenderer.invoke('invoiceFiles.saveAs', payload),
        read: (payload: any) => ipcRenderer.invoke('invoiceFiles.read', payload),
        list: (payload: any) => ipcRenderer.invoke('invoiceFiles.list', payload),
        add: (payload: any) => ipcRenderer.invoke('invoiceFiles.add', payload),
        delete: (payload: any) => ipcRenderer.invoke('invoiceFiles.delete', payload)
    },
    reports: {
        export: (payload: any) => ipcRenderer.invoke('reports.export', payload),
        summary: (payload: any) => ipcRenderer.invoke('reports.summary', payload),
        monthly: (payload: any) => ipcRenderer.invoke('reports.monthly', payload),
        cashBalance: (payload: any) => ipcRenderer.invoke('reports.cashBalance', payload),
        years: () => ipcRenderer.invoke('reports.years'),
    },
    db: {
        export: () => ipcRenderer.invoke('db.export'),
        import: () => ipcRenderer.invoke('db.import'),
        location: {
            get: () => ipcRenderer.invoke('db.location.get'),
            pick: () => ipcRenderer.invoke('db.location.pick'),
            migrateTo: (payload: any) => ipcRenderer.invoke('db.location.migrateTo', payload),
            useFolder: (payload: any) => ipcRenderer.invoke('db.location.useFolder', payload),
            chooseAndMigrate: () => ipcRenderer.invoke('db.location.chooseAndMigrate'),
            useExisting: () => ipcRenderer.invoke('db.location.useExisting'),
            resetDefault: () => ipcRenderer.invoke('db.location.resetDefault')
        }
    },
    quotes: {
        weekly: (payload?: any) => ipcRenderer.invoke('quotes.weekly', payload)
    },
    settings: {
        get: (payload: any) => ipcRenderer.invoke('settings.get', payload),
        set: (payload: any) => ipcRenderer.invoke('settings.set', payload)
    },
    app: {
        version: () => ipcRenderer.invoke('app.version')
    },
    imports: {
        preview: (payload: any) => ipcRenderer.invoke('imports.preview', payload),
        execute: (payload: any) => ipcRenderer.invoke('imports.execute', payload),
        template: () => ipcRenderer.invoke('imports.template'),
        testdata: () => ipcRenderer.invoke('imports.testdata')
    },
    shell: {
        showItemInFolder: (fullPath: string) => ipcRenderer.invoke('shell.showItemInFolder', { fullPath }),
        openPath: (fullPath: string) => ipcRenderer.invoke('shell.openPath', { fullPath })
    }
})

export { }
