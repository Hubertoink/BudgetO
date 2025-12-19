/**
 * BudgetO API Server
 * 
 * Express-based HTTP server for multi-user/network mode.
 * Exposes the same functionality as IPC handlers over HTTP.
 */

import http from 'node:http'
import { URL } from 'node:url'
import { networkInterfaces } from 'node:os'
import { getDb } from '../db/database'

// Server state
let server: http.Server | null = null
let connectedClients = 0

// Server configuration (persisted in settings table)
export interface ServerConfig {
  mode: 'local' | 'server' | 'client'
  port: number
  serverAddress: string
  autoStart: boolean
}

const DEFAULT_CONFIG: ServerConfig = {
  mode: 'local',
  port: 3847,
  serverAddress: '',
  autoStart: false
}

// ============================================================================
// Configuration Management
// ============================================================================

export function getServerConfig(): ServerConfig {
  try {
    const d = getDb()
    const row = d.prepare("SELECT value_json FROM settings WHERE key = 'server.config'").get() as any
    if (row?.value_json) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(row.value_json) }
    }
  } catch (e) {
    console.error('Failed to load server config:', e)
  }
  return DEFAULT_CONFIG
}

export function setServerConfig(config: Partial<ServerConfig>): ServerConfig {
  const d = getDb()
  const current = getServerConfig()
  const updated = { ...current, ...config }
  
  d.prepare(`
    INSERT INTO settings (key, value_json) VALUES ('server.config', ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `).run(JSON.stringify(updated))
  
  return updated
}

// ============================================================================
// Server Status
// ============================================================================

export function getServerStatus() {
  const config = getServerConfig()
  return {
    running: server !== null,
    connectedClients,
    mode: config.mode,
    port: config.port
  }
}

export function getLocalIPs(): string[] {
  const ips: string[] = []
  const interfaces = networkInterfaces()
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address)
      }
    }
  }
  
  return ips.length > 0 ? ips : ['127.0.0.1']
}

// ============================================================================
// Request Handler
// ============================================================================

type ApiHandler = (body: any, authUser?: any) => Promise<any>

// Map of route -> handler
const apiHandlers: Map<string, ApiHandler> = new Map()

// Register all API routes (mirrors IPC handlers)
function registerHandlers() {
  // Auth
  apiHandlers.set('auth.login', async (body) => {
    const { login } = await import('../repositories/users')
    return login(body.username, body.password)
  })
  
  apiHandlers.set('auth.isRequired', async () => {
    const { isAuthRequired } = await import('../repositories/users')
    return { required: isAuthRequired() }
  })
  
  // Users
  apiHandlers.set('users.list', async (body) => {
    const { listUsers } = await import('../repositories/users')
    return { users: listUsers(body) }
  })
  
  apiHandlers.set('users.get', async (body) => {
    const { getUserById } = await import('../repositories/users')
    return { user: getUserById(body.id) }
  })
  
  apiHandlers.set('users.create', async (body) => {
    const { createUser } = await import('../repositories/users')
    return { user: createUser(body) }
  })
  
  apiHandlers.set('users.update', async (body) => {
    const { updateUser } = await import('../repositories/users')
    return { user: updateUser(body) }
  })
  
  apiHandlers.set('users.delete', async (body) => {
    const { deleteUser } = await import('../repositories/users')
    return deleteUser(body.id)
  })
  
  // Vouchers
  apiHandlers.set('vouchers.list', async (body) => {
    const { listVouchersAdvancedPaged } = await import('../repositories/vouchers')
    return listVouchersAdvancedPaged(body)
  })
  
  apiHandlers.set('vouchers.create', async (body) => {
    const { createVoucher } = await import('../repositories/vouchers')
    return createVoucher(body)
  })
  
  apiHandlers.set('vouchers.update', async (body) => {
    const { updateVoucher } = await import('../repositories/vouchers')
    return updateVoucher(body)
  })
  
  apiHandlers.set('vouchers.delete', async (body) => {
    const { deleteVoucher } = await import('../repositories/vouchers')
    return deleteVoucher(body.id)
  })
  
  apiHandlers.set('vouchers.totals', async (body) => {
    const { summarizeVouchers } = await import('../repositories/vouchers')
    return summarizeVouchers(body)
  })
  
  // Budgets
  apiHandlers.set('budgets.list', async (body) => {
    const { listBudgets } = await import('../repositories/budgets')
    return listBudgets(body)
  })
  
  apiHandlers.set('budgets.upsert', async (body) => {
    const { upsertBudget } = await import('../repositories/budgets')
    return upsertBudget(body)
  })
  
  apiHandlers.set('budgets.delete', async (body) => {
    const { deleteBudget } = await import('../repositories/budgets')
    return deleteBudget(body.id)
  })
  
  // Tags
  apiHandlers.set('tags.list', async (body) => {
    const { listTags } = await import('../repositories/tags')
    return { tags: listTags(body) }
  })
  
  apiHandlers.set('tags.upsert', async (body) => {
    const { upsertTag } = await import('../repositories/tags')
    return { tag: upsertTag(body) }
  })
  
  apiHandlers.set('tags.delete', async (body) => {
    const { deleteTag } = await import('../repositories/tags')
    return deleteTag(body.id)
  })
  
  // Custom Categories
  apiHandlers.set('customCategories.list', async (body) => {
    const { listCustomCategories } = await import('../repositories/customCategories')
    return listCustomCategories(body || {})
  })
  
  apiHandlers.set('customCategories.create', async (body) => {
    const { createCustomCategory } = await import('../repositories/customCategories')
    return createCustomCategory(body)
  })
  
  apiHandlers.set('customCategories.update', async (body) => {
    const { updateCustomCategory } = await import('../repositories/customCategories')
    return updateCustomCategory(body)
  })
  
  apiHandlers.set('customCategories.delete', async (body) => {
    const { deleteCustomCategory } = await import('../repositories/customCategories')
    return deleteCustomCategory(body.id)
  })
  
  // Annual Budgets
  apiHandlers.set('annualBudgets.get', async (body) => {
    const { getAnnualBudget } = await import('../repositories/annualBudgets')
    return getAnnualBudget(body)
  })
  
  apiHandlers.set('annualBudgets.upsert', async (body) => {
    const { upsertAnnualBudget } = await import('../repositories/annualBudgets')
    return upsertAnnualBudget(body)
  })
  
  apiHandlers.set('annualBudgets.getUsage', async (body) => {
    const { getAnnualBudgetUsage } = await import('../repositories/annualBudgets')
    return getAnnualBudgetUsage(body)
  })
  
  // Modules
  apiHandlers.set('modules.list', async () => {
    const { listModules } = await import('../repositories/modules')
    return { modules: listModules() }
  })
  
  apiHandlers.set('modules.setEnabled', async (body) => {
    const { setModuleEnabled } = await import('../repositories/modules')
    return setModuleEnabled(body.key, body.enabled)
  })
}

// Parse JSON body from request
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// Main request handler
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  
  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }))
    return
  }
  
  // API routes: POST /api/{handler}
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const route = url.pathname.slice(5) // Remove '/api/'
    const handler = apiHandlers.get(route)
    
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }
    
    try {
      const body = await parseBody(req)
      
      // TODO: Add authentication check here
      // const authHeader = req.headers.authorization
      // if (!authHeader) { ... }
      
      const result = await handler(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e: any) {
      console.error(`API error [${route}]:`, e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Internal error' }))
    }
    return
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// ============================================================================
// Server Lifecycle
// ============================================================================

export function startServer(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (server) {
      resolve({ success: true }) // Already running
      return
    }
    
    const config = getServerConfig()
    
    // Register handlers on first start
    if (apiHandlers.size === 0) {
      registerHandlers()
    }
    
    server = http.createServer(handleRequest)
    
    server.on('error', (err: any) => {
      console.error('Server error:', err)
      if (err.code === 'EADDRINUSE') {
        resolve({ success: false, error: `Port ${config.port} ist bereits belegt` })
      } else {
        resolve({ success: false, error: err.message })
      }
      server = null
    })
    
    server.on('connection', () => {
      connectedClients++
    })
    
    server.on('close', () => {
      connectedClients = 0
    })
    
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`BudgetO API Server running on port ${config.port}`)
      resolve({ success: true })
    })
  })
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve()
      return
    }
    
    server.close(() => {
      console.log('BudgetO API Server stopped')
      server = null
      connectedClients = 0
      resolve()
    })
  })
}

// ============================================================================
// Client Mode: HTTP API Client
// ============================================================================

export async function testConnection(address: string): Promise<{ success: boolean; message: string }> {
  try {
    const url = address.startsWith('http') ? address : `http://${address}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${url}/health`, { 
      signal: controller.signal,
      method: 'GET'
    })
    clearTimeout(timeout)
    
    if (response.ok) {
      const data = await response.json()
      return { success: true, message: `Verbunden mit BudgetO Server v${data.version}` }
    } else {
      return { success: false, message: `Server antwortet mit Status ${response.status}` }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return { success: false, message: 'Zeitüberschreitung - Server nicht erreichbar' }
    }
    return { success: false, message: e.message || 'Verbindungsfehler' }
  }
}

/**
 * Make an API call to a remote BudgetO server
 */
export async function remoteCall(address: string, route: string, body: any = {}): Promise<any> {
  const url = address.startsWith('http') ? address : `http://${address}`
  
  const response = await fetch(`${url}/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}
