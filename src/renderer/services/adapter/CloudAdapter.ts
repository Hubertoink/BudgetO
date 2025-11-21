import type { IDataAdapter } from './IDataAdapter'

/**
 * Cloud Adapter - REST API Calls zum Backend
 * Verwendet fetch() für HTTP-Requests
 */
export class CloudAdapter implements IDataAdapter {
  private apiUrl: string
  private token: string | null = null

  constructor(apiUrl: string, token?: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '') // Remove trailing slash
    this.token = token || null
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token
    // Store in localStorage for persistence
    localStorage.setItem('cloud_token', token)
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token || localStorage.getItem('cloud_token')
  }

  /**
   * Clear authentication
   */
  clearAuth() {
    this.token = null
    localStorage.removeItem('cloud_token')
  }

  /**
   * Generic fetch with auth
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.clearAuth()
        throw new Error('Unauthorized - please login again')
      }
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.message || error.error || 'Request failed')
    }

    return await response.json()
  }

  /**
   * Login
   */
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const result = await this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    this.setToken(result.token)
    return result
  }

  /**
   * Register
   */
  async register(email: string, password: string, organizationName: string): Promise<{ token: string; user: any }> {
    const result = await this.fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, organizationName })
    })
    this.setToken(result.token)
    return result
  }

  vouchers = {
    list: async (params: { year?: number; page?: number; limit?: number }) => {
      const query = new URLSearchParams()
      if (params.year) query.set('year', String(params.year))
      if (params.page) query.set('page', String(params.page))
      if (params.limit) query.set('limit', String(params.limit))
      return await this.fetch(`/api/vouchers?${query}`)
    },
    recent: async (params: { limit: number }) => {
      return await this.fetch(`/api/vouchers?limit=${params.limit}`)
    },
    create: async (params: any) => {
      return await this.fetch('/api/vouchers', {
        method: 'POST',
        body: JSON.stringify(params)
      })
    },
    update: async (params: any) => {
      return await this.fetch(`/api/vouchers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify(params)
      })
    },
    delete: async (params: { id: number }) => {
      return await this.fetch(`/api/vouchers/${params.id}`, {
        method: 'DELETE'
      })
    },
    reverse: async (params: { originalId: number; reason: string }) => {
      // Backend needs reverse endpoint implementation
      return await this.fetch(`/api/vouchers/${params.originalId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: params.reason })
      })
    }
  }

  members = {
    list: async (params: { search?: string; active?: boolean }) => {
      const query = new URLSearchParams()
      if (params.search) query.set('search', params.search)
      if (params.active !== undefined) query.set('active', String(params.active))
      return await this.fetch(`/api/members?${query}`)
    },
    get: async (params: { id: number }) => {
      return await this.fetch(`/api/members/${params.id}`)
    },
    create: async (params: any) => {
      return await this.fetch('/api/members', {
        method: 'POST',
        body: JSON.stringify(params)
      })
    },
    update: async (params: any) => {
      return await this.fetch(`/api/members/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify(params)
      })
    },
    delete: async (params: { id: number }) => {
      return await this.fetch(`/api/members/${params.id}`, {
        method: 'DELETE'
      })
    },
    payments: {
      list: async (params: { memberId: number }) => {
        return await this.fetch(`/api/members/${params.memberId}/payments`)
      },
      create: async (params: any) => {
        return await this.fetch(`/api/members/${params.memberId}/payments`, {
          method: 'POST',
          body: JSON.stringify(params)
        })
      }
    }
  }

  attachments = {
    list: async (params: { voucherId: number }) => {
      return await this.fetch(`/api/vouchers/${params.voucherId}/attachments`)
    },
    add: async (params: { voucherId: number; files: any[] }) => {
      // File upload requires FormData
      const formData = new FormData()
      params.files.forEach((file) => {
        formData.append('files', file)
      })
      
      const token = this.getToken()
      const response = await fetch(`${this.apiUrl}/api/vouchers/${params.voucherId}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      })
      
      if (!response.ok) throw new Error('Upload failed')
      return await response.json()
    },
    delete: async (params: { id: number }) => {
      return await this.fetch(`/api/attachments/${params.id}`, {
        method: 'DELETE'
      })
    },
    download: async (params: { id: number }) => {
      const token = this.getToken()
      const response = await fetch(`${this.apiUrl}/api/attachments/${params.id}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!response.ok) throw new Error('Download failed')
      return await response.blob()
    }
  }

  // Note: bindings, budgets, tags, settings, reports, yearEnd, backup, db
  // need backend implementation. For now, throw "not implemented" errors
  bindings = {
    list: async () => { throw new Error('Bindings not yet implemented in cloud mode') },
    create: async () => { throw new Error('Bindings not yet implemented in cloud mode') },
    update: async () => { throw new Error('Bindings not yet implemented in cloud mode') },
    delete: async () => { throw new Error('Bindings not yet implemented in cloud mode') }
  }

  budgets = {
    list: async () => { throw new Error('Budgets not yet implemented in cloud mode') },
    create: async () => { throw new Error('Budgets not yet implemented in cloud mode') },
    update: async () => { throw new Error('Budgets not yet implemented in cloud mode') },
    delete: async () => { throw new Error('Budgets not yet implemented in cloud mode') }
  }

  tags = {
    list: async () => { throw new Error('Tags not yet implemented in cloud mode') },
    create: async () => { throw new Error('Tags not yet implemented in cloud mode') },
    update: async () => { throw new Error('Tags not yet implemented in cloud mode') },
    delete: async () => { throw new Error('Tags not yet implemented in cloud mode') }
  }

  settings = {
    get: async () => { throw new Error('Settings not yet implemented in cloud mode') },
    set: async () => { throw new Error('Settings not yet implemented in cloud mode') },
    delete: async () => { throw new Error('Settings not yet implemented in cloud mode') }
  }

  reports = {
    years: async () => { throw new Error('Reports not yet implemented in cloud mode') },
    summary: async () => { throw new Error('Reports not yet implemented in cloud mode') }
  }

  yearEnd = {
    status: async () => { throw new Error('Year end not yet implemented in cloud mode') },
    preview: async () => { throw new Error('Year end not yet implemented in cloud mode') },
    export: async () => { throw new Error('Year end not yet implemented in cloud mode') },
    close: async () => { throw new Error('Year end not yet implemented in cloud mode') },
    reopen: async () => { throw new Error('Year end not yet implemented in cloud mode') }
  }

  backup = {
    create: async () => { throw new Error('Backup not available in cloud mode (handled by server)') },
    restore: async () => { throw new Error('Restore not available in cloud mode') },
    inspect: async () => { throw new Error('Inspect not available in cloud mode') },
    inspectCurrent: async () => { throw new Error('Inspect not available in cloud mode') }
  }

  db = {
    smartRestore: {
      preview: async () => { throw new Error('Smart restore not available in cloud mode') },
      apply: async () => { throw new Error('Smart restore not available in cloud mode') }
    }
  }
}
