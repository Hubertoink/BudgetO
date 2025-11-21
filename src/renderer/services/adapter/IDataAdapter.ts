/**
 * Data Adapter Interface
 * Abstraction layer for local (SQLite/IPC) and cloud (REST API) data access
 */

export interface IDataAdapter {
  // Vouchers
  vouchers: {
    list: (params: { year?: number; page?: number; limit?: number }) => Promise<any>
    recent: (params: { limit: number }) => Promise<any>
    create: (params: any) => Promise<any>
    update: (params: any) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
    reverse: (params: { originalId: number; reason: string }) => Promise<any>
  }

  // Members
  members: {
    list: (params: { search?: string; active?: boolean }) => Promise<any>
    get: (params: { id: number }) => Promise<any>
    create: (params: any) => Promise<any>
    update: (params: any) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
    payments: {
      list: (params: { memberId: number }) => Promise<any>
      create: (params: any) => Promise<any>
    }
  }

  // Attachments
  attachments: {
    list: (params: { voucherId: number }) => Promise<any>
    add: (params: { voucherId: number; files: any[] }) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
    download: (params: { id: number }) => Promise<any>
  }

  // Bindings (Kontenplan)
  bindings: {
    list: (params: { activeOnly?: boolean }) => Promise<any>
    create: (params: any) => Promise<any>
    update: (params: any) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
  }

  // Budgets
  budgets: {
    list: (params: object) => Promise<any>
    create: (params: any) => Promise<any>
    update: (params: any) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
  }

  // Tags
  tags: {
    list: (params: { includeUsage?: boolean }) => Promise<any>
    create: (params: any) => Promise<any>
    update: (params: any) => Promise<any>
    delete: (params: { id: number }) => Promise<any>
  }

  // Settings
  settings: {
    get: (params: { key: string }) => Promise<any>
    set: (params: { key: string; value: string }) => Promise<any>
    delete: (params: { key: string }) => Promise<any>
  }

  // Reports
  reports: {
    years: () => Promise<any>
    summary: (params: { from: string; to: string }) => Promise<any>
  }

  // Year End
  yearEnd: {
    status: () => Promise<any>
    preview: (params: { year: number }) => Promise<any>
    export: (params: { year: number }) => Promise<any>
    close: (params: { year: number }) => Promise<any>
    reopen: (params: { year: number }) => Promise<any>
  }

  // Backup
  backup: {
    create: () => Promise<any>
    restore: (filePath: string) => Promise<any>
    inspect: (dbPath: string) => Promise<any>
    inspectCurrent: () => Promise<any>
  }

  // Database
  db: {
    smartRestore: {
      preview: () => Promise<any>
      apply: (params: { action: string }) => Promise<any>
    }
  }
}

/**
 * App Mode Configuration
 */
export type AppMode = 'local' | 'cloud'

export interface AppModeConfig {
  mode: AppMode
  cloudConfig?: {
    apiUrl: string
    token?: string
  }
}
