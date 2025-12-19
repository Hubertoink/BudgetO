/**
 * BudgetO Remote Client
 * 
 * Provides an API bridge that works over HTTP when in client mode.
 * In local/server mode, this falls back to IPC.
 */

// Client-side storage for server config
let clientConfig: { mode: string; serverAddress: string } | null = null

/**
 * Initialize the remote client with config
 */
export function initRemoteClient(config: { mode: string; serverAddress: string }) {
  clientConfig = config
}

/**
 * Check if we're in client mode (should use HTTP instead of IPC)
 */
export function isClientMode(): boolean {
  return clientConfig?.mode === 'client' && !!clientConfig?.serverAddress
}

/**
 * Get the server address for HTTP calls
 */
export function getServerAddress(): string {
  if (!clientConfig?.serverAddress) return ''
  const addr = clientConfig.serverAddress
  return addr.startsWith('http') ? addr : `http://${addr}`
}

/**
 * Make an API call - uses HTTP in client mode, returns null for IPC fallback otherwise
 */
export async function remoteApiCall<T>(route: string, body: any = {}): Promise<T | null> {
  if (!isClientMode()) {
    return null // Fallback to IPC
  }
  
  const url = getServerAddress()
  if (!url) {
    throw new Error('Server-Adresse nicht konfiguriert')
  }
  
  try {
    const response = await fetch(`${url}/api/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add Authorization header with JWT token
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return response.json()
  } catch (e: any) {
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      throw new Error('Server nicht erreichbar. Prüfe die Verbindung.')
    }
    throw e
  }
}

/**
 * Create a proxy API that uses HTTP in client mode, IPC otherwise
 */
export function createRemoteProxy(ipcApi: any): any {
  if (!isClientMode()) {
    return ipcApi // Use IPC directly
  }
  
  // Create a proxy that intercepts all calls
  return new Proxy({}, {
    get(_target, namespace: string) {
      if (typeof namespace !== 'string') return undefined
      
      // Return a proxy for the namespace (e.g., 'vouchers', 'users')
      return new Proxy({}, {
        get(_nsTarget, method: string) {
          if (typeof method !== 'string') return undefined
          
          // Return an async function that makes the HTTP call
          return async (payload: any) => {
            const route = `${namespace}.${method}`
            return remoteApiCall(route, payload)
          }
        }
      })
    }
  })
}
