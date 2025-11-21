import type { IDataAdapter } from './IDataAdapter'

/**
 * Local Adapter - verwendet bestehende window.api (IPC) Calls
 * Wrapper um die lokalen SQLite-Zugriffe
 */
export class LocalAdapter implements IDataAdapter {
  vouchers = {
    list: async (params: { year?: number; page?: number; limit?: number }) => {
      return await window.api?.vouchers?.list?.(params)
    },
    recent: async (params: { limit: number }) => {
      return await window.api?.vouchers?.recent?.(params)
    },
    create: async (params: any) => {
      return await window.api?.vouchers?.create?.(params)
    },
    update: async (params: any) => {
      return await window.api?.vouchers?.update?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.vouchers?.delete?.(params)
    },
    reverse: async (params: { originalId: number; reason: string }) => {
      return await window.api?.vouchers?.reverse?.(params)
    }
  }

  members = {
    list: async (params: { search?: string; active?: boolean }) => {
      return await window.api?.members?.list?.(params)
    },
    get: async (params: { id: number }) => {
      return await window.api?.members?.get?.(params)
    },
    create: async (params: any) => {
      return await window.api?.members?.create?.(params)
    },
    update: async (params: any) => {
      return await window.api?.members?.update?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.members?.delete?.(params)
    },
    payments: {
      list: async (params: { memberId: number }) => {
        return await window.api?.members?.payments?.list?.(params)
      },
      create: async (params: any) => {
        return await window.api?.members?.payments?.create?.(params)
      }
    }
  }

  attachments = {
    list: async (params: { voucherId: number }) => {
      return await window.api?.attachments?.list?.(params)
    },
    add: async (params: { voucherId: number; files: any[] }) => {
      return await window.api?.attachments?.add?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.attachments?.delete?.(params)
    },
    download: async (params: { id: number }) => {
      return await window.api?.attachments?.download?.(params)
    }
  }

  bindings = {
    list: async (params: { activeOnly?: boolean }) => {
      return await window.api?.bindings?.list?.(params)
    },
    create: async (params: any) => {
      return await window.api?.bindings?.create?.(params)
    },
    update: async (params: any) => {
      return await window.api?.bindings?.update?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.bindings?.delete?.(params)
    }
  }

  budgets = {
    list: async (params: object) => {
      return await window.api?.budgets?.list?.(params)
    },
    create: async (params: any) => {
      return await window.api?.budgets?.create?.(params)
    },
    update: async (params: any) => {
      return await window.api?.budgets?.update?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.budgets?.delete?.(params)
    }
  }

  tags = {
    list: async (params: { includeUsage?: boolean }) => {
      return await window.api?.tags?.list?.(params)
    },
    create: async (params: any) => {
      return await window.api?.tags?.create?.(params)
    },
    update: async (params: any) => {
      return await window.api?.tags?.update?.(params)
    },
    delete: async (params: { id: number }) => {
      return await window.api?.tags?.delete?.(params)
    }
  }

  settings = {
    get: async (params: { key: string }) => {
      return await window.api?.settings?.get?.(params)
    },
    set: async (params: { key: string; value: string }) => {
      return await window.api?.settings?.set?.(params)
    },
    delete: async (params: { key: string }) => {
      return await window.api?.settings?.delete?.(params)
    }
  }

  reports = {
    years: async () => {
      return await window.api?.reports?.years?.()
    },
    summary: async (params: { from: string; to: string }) => {
      return await window.api?.reports?.summary?.(params)
    }
  }

  yearEnd = {
    status: async () => {
      return await window.api?.yearEnd?.status?.()
    },
    preview: async (params: { year: number }) => {
      return await window.api?.yearEnd?.preview?.(params)
    },
    export: async (params: { year: number }) => {
      return await window.api?.yearEnd?.export?.(params)
    },
    close: async (params: { year: number }) => {
      return await window.api?.yearEnd?.close?.(params)
    },
    reopen: async (params: { year: number }) => {
      return await window.api?.yearEnd?.reopen?.(params)
    }
  }

  backup = {
    create: async () => {
      return await window.api?.backup?.create?.()
    },
    restore: async (filePath: string) => {
      return await window.api?.backup?.restore?.(filePath)
    },
    inspect: async (dbPath: string) => {
      return await window.api?.backup?.inspect?.(dbPath)
    },
    inspectCurrent: async () => {
      return await window.api?.backup?.inspectCurrent?.()
    }
  }

  db = {
    smartRestore: {
      preview: async () => {
        return await window.api?.db?.smartRestore?.preview?.()
      },
      apply: async (params: { action: string }) => {
        return await window.api?.db?.smartRestore?.apply?.(params)
      }
    }
  }
}
