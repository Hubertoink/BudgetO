/**
 * BudgetO API Server
 * 
 * Express-based HTTP server for multi-user/network mode.
 * Exposes the same functionality as IPC handlers over HTTP.
 */

import http from 'node:http'
import type net from 'node:net'
import { URL } from 'node:url'
import { networkInterfaces } from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { getDb, getAppDataDir } from '../db/database'

// Server state
let server: http.Server | null = null
let connectedClients = 0
const activeSockets = new Set<net.Socket>()

// Client-mode auth token (kept in main process memory)
let clientAuthToken: string | null = null

export function setClientAuthToken(token: string | null) {
  clientAuthToken = token && token.trim() ? token.trim() : null
}

export function getClientAuthToken(): string | null {
  return clientAuthToken
}

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
    const { login, createSession } = await import('../repositories/users')
    const res = login(body.username, body.password)
    if (res?.success && res.user) {
      const token = createSession(res.user.id)
      return { ...res, token }
    }
    return res
  })
  
  apiHandlers.set('auth.isRequired', async () => {
    const { isAuthRequired } = await import('../repositories/users')
    return { required: isAuthRequired() }
  })

  apiHandlers.set('auth.logout', async (_body, authUser) => {
    const { deleteSessionByToken } = await import('../repositories/users')
    if (!authUser?.token) return { success: true }
    deleteSessionByToken(authUser.token)
    return { success: true }
  })

  apiHandlers.set('auth.setInitialPassword', async (body, authUser) => {
    const { isAuthRequired, setInitialPassword } = await import('../repositories/users')
    // Bootstrap: when auth is not yet required, allow without token.
    // Once auth is enabled, only admins may reset/set passwords for users.
    if (isAuthRequired()) {
      if (authUser?.role !== 'ADMIN') {
        throw new Error('Forbidden')
      }
    }
    return setInitialPassword(body.userId, body.password)
  })

  apiHandlers.set('auth.changePassword', async (body, authUser) => {
    const { isAuthRequired, changePassword } = await import('../repositories/users')
    // When auth is enabled, only the user themself (or an admin) may change a password via this endpoint.
    if (isAuthRequired()) {
      if (!authUser) throw new Error('Unauthorized')
      const sameUser = Number(authUser.id) === Number(body.userId)
      const isAdmin = authUser.role === 'ADMIN'
      if (!sameUser && !isAdmin) throw new Error('Forbidden')
    }
    return changePassword(body.userId, body.currentPassword, body.newPassword)
  })

  apiHandlers.set('auth.clearPassword', async (body, authUser) => {
    const { isAuthRequired, clearPassword, clearPasswordAdmin } = await import('../repositories/users')

    // Never allow password removal while configured for server mode.
    const cfg = getServerConfig()
    if (cfg.mode === 'server') {
      throw new Error('Forbidden')
    }

    // If auth isn't required anymore, this is effectively a no-op.
    if (!isAuthRequired()) {
      return { success: true }
    }

    // When auth is enabled, require same user (with current password) or admin.
    if (!authUser) throw new Error('Unauthorized')
    const targetId = Number(body.userId)
    const sameUser = Number(authUser.id) === targetId
    const isAdmin = authUser.role === 'ADMIN'
    if (!sameUser && !isAdmin) throw new Error('Forbidden')

    if (sameUser) {
      return clearPassword(targetId, String(body.currentPassword || ''))
    }
    return clearPasswordAdmin(targetId)
  })
  
  // Users
  apiHandlers.set('users.list', async (body) => {
    const { listUsers } = await import('../repositories/users')
    return { users: listUsers(body) }
  })

  // Settings: simple key/value
  apiHandlers.set('settings.get', async (body, authUser) => {
    const { isAuthRequired } = await import('../repositories/users')
    if (isAuthRequired()) {
      if (!authUser) throw new Error('Unauthorized')
      if (authUser.role !== 'ADMIN' && authUser.role !== 'KASSE') throw new Error('Forbidden')
    }
    const { getSetting } = await import('./settings')
    const value = getSetting(body.key)
    return { value }
  })

  apiHandlers.set('settings.set', async (body, authUser) => {
    const { isAuthRequired } = await import('../repositories/users')
    if (isAuthRequired()) {
      if (!authUser) throw new Error('Unauthorized')
      if (authUser.role !== 'ADMIN' && authUser.role !== 'KASSE') throw new Error('Forbidden')
    }
    const { setSetting } = await import('./settings')
    setSetting(body.key, body.value)
    return { ok: true }
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
    const { updateVoucher, setVoucherBudgets, setVoucherEarmarks } = await import('../repositories/vouchers')
    const res = updateVoucher(body)
    if (body?.budgets !== undefined) {
      setVoucherBudgets(body.id, body.budgets)
    }
    if (body?.earmarks !== undefined) {
      setVoucherEarmarks(body.id, body.earmarks)
    }
    return res
  })
  
  apiHandlers.set('vouchers.delete', async (body) => {
    const { deleteVoucher } = await import('../repositories/vouchers')
    return deleteVoucher(body.id)
  })
  
  apiHandlers.set('vouchers.totals', async (body) => {
    const { summarizeVouchers } = await import('../repositories/vouchers')
    return summarizeVouchers(body)
  })

  apiHandlers.set('vouchers.reverse', async (body) => {
    const { reverseVoucher } = await import('../repositories/vouchers')
    return reverseVoucher(body.originalId, null)
  })

  apiHandlers.set('vouchers.batchAssignEarmark', async (body) => {
    const { batchAssignEarmark } = await import('../repositories/vouchers')
    return batchAssignEarmark(body)
  })

  apiHandlers.set('vouchers.batchAssignBudget', async (body) => {
    const { batchAssignBudget } = await import('../repositories/vouchers')
    return batchAssignBudget(body)
  })

  apiHandlers.set('vouchers.batchAssignTags', async (body) => {
    const { batchAssignTags } = await import('../repositories/vouchers')
    return batchAssignTags(body)
  })

  apiHandlers.set('vouchers.clearAll', async (body) => {
    if (!body?.confirm) throw new Error('Nicht bestätigt')
    const { clearAllVouchers } = await import('../repositories/vouchers')
    return clearAllVouchers()
  })

  // Reports
  apiHandlers.set('reports.summary', async (body) => {
    const { summarizeVouchers } = await import('../repositories/vouchers')
    return summarizeVouchers(body)
  })

  apiHandlers.set('reports.monthly', async (body) => {
    const { monthlyVouchers } = await import('../repositories/vouchers')
    return { buckets: monthlyVouchers(body) }
  })

  apiHandlers.set('reports.daily', async (body) => {
    const { dailyVouchers } = await import('../repositories/vouchers')
    return { buckets: dailyVouchers(body) }
  })

  apiHandlers.set('reports.cashBalance', async (body) => {
    const { cashBalance } = await import('../repositories/vouchers')
    return cashBalance(body)
  })

  apiHandlers.set('reports.years', async () => {
    const { listVoucherYears } = await import('../repositories/vouchers')
    return { years: listVoucherYears() }
  })
  
  // Budgets
  apiHandlers.set('budgets.list', async (body) => {
    const { listBudgets } = await import('../repositories/budgets')
    return { rows: listBudgets(body || {}) }
  })
  
  apiHandlers.set('budgets.upsert', async (body) => {
    const { upsertBudget } = await import('../repositories/budgets')
    const res = upsertBudget(body)
    return { id: res.id }
  })
  
  apiHandlers.set('budgets.delete', async (body) => {
    const { deleteBudget } = await import('../repositories/budgets')
    return deleteBudget(body.id)
  })

  apiHandlers.set('budgets.usage', async (body) => {
    const { budgetUsage } = await import('../repositories/budgets')
    return budgetUsage(body)
  })

  // Bindings
  apiHandlers.set('bindings.list', async (body) => {
    const { listBindings } = await import('../repositories/bindings')
    return { rows: listBindings(body ?? undefined) }
  })

  apiHandlers.set('bindings.upsert', async (body) => {
    const { upsertBinding } = await import('../repositories/bindings')
    const res = upsertBinding(body)
    return { id: res.id }
  })

  apiHandlers.set('bindings.delete', async (body) => {
    const { deleteBinding } = await import('../repositories/bindings')
    return deleteBinding(body.id)
  })

  apiHandlers.set('bindings.usage', async (body) => {
    const { bindingUsage } = await import('../repositories/bindings')
    return bindingUsage(body.earmarkId, { from: body.from, to: body.to, sphere: body.sphere })
  })
  
  // Tags
  apiHandlers.set('tags.list', async (body) => {
    const { listTags } = await import('../repositories/tags')
    return { rows: listTags(body ?? undefined) }
  })
  
  apiHandlers.set('tags.upsert', async (body) => {
    const { upsertTag } = await import('../repositories/tags')
    const res = upsertTag(body)
    return { id: res.id }
  })
  
  apiHandlers.set('tags.delete', async (body) => {
    const { deleteTag } = await import('../repositories/tags')
    return deleteTag(body.id)
  })
  
  // Custom Categories
  apiHandlers.set('customCategories.list', async (body) => {
    const { listCustomCategories } = await import('../repositories/customCategories')
    return { categories: listCustomCategories(body || {}) }
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

  apiHandlers.set('customCategories.get', async (body) => {
    const { getCustomCategory } = await import('../repositories/customCategories')
    return { category: getCustomCategory(body.id) }
  })

  apiHandlers.set('customCategories.usageCount', async (body) => {
    const { getCategoryUsageCount } = await import('../repositories/customCategories')
    return { count: getCategoryUsageCount(body.id) }
  })

  apiHandlers.set('customCategories.reorder', async (body) => {
    const { reorderCustomCategories } = await import('../repositories/customCategories')
    return reorderCustomCategories(body.orderedIds)
  })
  
  // Annual Budgets
  apiHandlers.set('annualBudgets.get', async (body) => {
    const { getAnnualBudget } = await import('../repositories/annualBudgets')
    return getAnnualBudget(body)
  })

  apiHandlers.set('annualBudgets.list', async (body) => {
    const { listAnnualBudgets } = await import('../repositories/annualBudgets')
    return { budgets: listAnnualBudgets(body) }
  })
  
  apiHandlers.set('annualBudgets.upsert', async (body) => {
    const { upsertAnnualBudget } = await import('../repositories/annualBudgets')
    return upsertAnnualBudget(body)
  })

  apiHandlers.set('annualBudgets.delete', async (body) => {
    const { deleteAnnualBudget } = await import('../repositories/annualBudgets')
    return deleteAnnualBudget(body.id)
  })
  
  apiHandlers.set('annualBudgets.getUsage', async (body) => {
    const { getAnnualBudgetUsage } = await import('../repositories/annualBudgets')
    return getAnnualBudgetUsage(body)
  })

  apiHandlers.set('annualBudgets.usage', async (body) => {
    const { getAnnualBudgetUsage } = await import('../repositories/annualBudgets')
    return getAnnualBudgetUsage(body)
  })
  
  // Modules
  apiHandlers.set('modules.list', async () => {
    const { listModules, MODULE_DEFINITIONS } = await import('../repositories/modules')
    const configs = listModules()
    const result = MODULE_DEFINITIONS.map(def => {
      const config = configs.find((c: any) => c.moduleKey === def.key)
      return {
        ...def,
        enabled: config?.enabled ?? true,
        displayOrder: config?.displayOrder ?? 0,
        configJson: config?.configJson ?? null
      }
    })
    return { modules: result }
  })
  
  apiHandlers.set('modules.setEnabled', async (body) => {
    const { setModuleEnabled } = await import('../repositories/modules')
    return setModuleEnabled(body.moduleKey ?? body.key, body.enabled)
  })

  apiHandlers.set('modules.setConfig', async (body) => {
    const { setModuleConfig } = await import('../repositories/modules')
    return setModuleConfig(body.moduleKey, body.configJson)
  })

  apiHandlers.set('modules.getEnabled', async () => {
    const { getEnabledModules } = await import('../repositories/modules')
    return { enabledModules: getEnabledModules() }
  })

  // Attachments (Voucher files)
  apiHandlers.set('attachments.list', async (body) => {
    const { listFilesForVoucher } = await import('../repositories/vouchers')
    const files = listFilesForVoucher(body.voucherId)
    return {
      files: (files || []).map((f: any) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType ?? null,
        size: f.size ?? null,
        createdAt: f.createdAt
      }))
    }
  })

  apiHandlers.set('attachments.read', async (body) => {
    const { getFileById } = await import('../repositories/vouchers')
    const f = getFileById(body.fileId)
    if (!f) throw new Error('Datei nicht gefunden')
    const pathBase = path.basename(f.filePath || '')
    let src = f.filePath
    if (!src || !fs.existsSync(src)) {
      const alt = path.join(getAppDataDir().filesDir, pathBase)
      if (fs.existsSync(alt)) src = alt
    }
    if (!src || !fs.existsSync(src)) throw new Error('Quelldatei nicht gefunden: ' + (f.filePath || pathBase))
    const buff = fs.readFileSync(src)
    const dataBase64 = Buffer.from(buff).toString('base64')
    return { fileName: f.fileName, mimeType: f.mimeType || undefined, dataBase64 }
  })

  apiHandlers.set('attachments.add', async (body) => {
    const { addFileToVoucher } = await import('../repositories/vouchers')
    return addFileToVoucher(body.voucherId, body.fileName, body.dataBase64, body.mimeType)
  })

  apiHandlers.set('attachments.delete', async (body) => {
    const { deleteVoucherFile } = await import('../repositories/vouchers')
    return deleteVoucherFile(body.fileId)
  })

  // Instructors
  apiHandlers.set('instructors.list', async (body) => {
    const { listInstructors } = await import('../repositories/instructors')
    return listInstructors(body || {})
  })

  apiHandlers.set('instructors.get', async (body) => {
    const { getInstructorById } = await import('../repositories/instructors')
    return getInstructorById(body.id)
  })

  apiHandlers.set('instructors.create', async (body) => {
    const { createInstructor } = await import('../repositories/instructors')
    return createInstructor(body)
  })

  apiHandlers.set('instructors.update', async (body) => {
    const { updateInstructor } = await import('../repositories/instructors')
    return updateInstructor(body)
  })

  apiHandlers.set('instructors.delete', async (body) => {
    const { deleteInstructor } = await import('../repositories/instructors')
    return deleteInstructor(body.id)
  })

  apiHandlers.set('instructors.contracts.add', async (body) => {
    const { addContract } = await import('../repositories/instructors')
    return addContract(body)
  })

  apiHandlers.set('instructors.contracts.delete', async (body) => {
    const { deleteContract } = await import('../repositories/instructors')
    return deleteContract(body.contractId)
  })

  apiHandlers.set('instructors.contracts.read', async (body) => {
    const { getContractFile } = await import('../repositories/instructors')
    const file = getContractFile(body.contractId)
    if (!file) throw new Error('Vertrag nicht gefunden')
    let src = file.filePath
    if (!fs.existsSync(src)) {
      const alt = path.join(getAppDataDir().filesDir, path.basename(src))
      if (fs.existsSync(alt)) src = alt
    }
    if (!fs.existsSync(src)) throw new Error('Vertragsdatei nicht gefunden')
    const buff = fs.readFileSync(src)
    return { fileName: file.fileName, mimeType: file.mimeType, dataBase64: Buffer.from(buff).toString('base64') }
  })

  apiHandlers.set('instructors.invoices.add', async (body) => {
    const { addInstructorInvoice } = await import('../repositories/instructors')
    return addInstructorInvoice(body)
  })

  apiHandlers.set('instructors.invoices.delete', async (body) => {
    const { deleteInstructorInvoice } = await import('../repositories/instructors')
    return deleteInstructorInvoice(body.invoiceId)
  })

  apiHandlers.set('instructors.invoices.read', async (body) => {
    const { getInvoiceFile } = await import('../repositories/instructors')
    const file = getInvoiceFile(body.invoiceId)
    if (!file) throw new Error('Rechnungsdatei nicht gefunden')
    let src = file.filePath
    if (!fs.existsSync(src)) {
      const alt = path.join(getAppDataDir().filesDir, path.basename(src))
      if (fs.existsSync(alt)) src = alt
    }
    if (!fs.existsSync(src)) throw new Error('Rechnungsdatei nicht gefunden')
    const buff = fs.readFileSync(src)
    return { fileName: file.fileName, mimeType: file.mimeType, dataBase64: Buffer.from(buff).toString('base64') }
  })

  apiHandlers.set('instructors.yearlySummary', async (body) => {
    const { getInstructorYearlySummary } = await import('../repositories/instructors')
    return getInstructorYearlySummary(body.instructorId, body.year)
  })

  // Cash Advances
  apiHandlers.set('cashAdvances.list', async (body) => {
    const { listCashAdvances } = await import('../repositories/cashAdvances')
    return listCashAdvances(body || {})
  })

  apiHandlers.set('cashAdvances.getById', async (body) => {
    const { getCashAdvanceById } = await import('../repositories/cashAdvances')
    return getCashAdvanceById(body.id)
  })

  apiHandlers.set('cashAdvances.create', async (body) => {
    const { createCashAdvance } = await import('../repositories/cashAdvances')
    return createCashAdvance(body)
  })

  apiHandlers.set('cashAdvances.update', async (body) => {
    const { updateCashAdvance } = await import('../repositories/cashAdvances')
    return updateCashAdvance(body)
  })

  apiHandlers.set('cashAdvances.delete', async (body) => {
    const { deleteCashAdvance } = await import('../repositories/cashAdvances')
    return deleteCashAdvance(body.id)
  })

  apiHandlers.set('cashAdvances.nextOrderNumber', async () => {
    const { getNextOrderNumber } = await import('../repositories/cashAdvances')
    return { orderNumber: getNextOrderNumber() }
  })

  apiHandlers.set('cashAdvances.stats', async () => {
    const { getCashAdvanceStats } = await import('../repositories/cashAdvances')
    return getCashAdvanceStats()
  })

  apiHandlers.set('cashAdvances.partials.add', async (body) => {
    const { addPartialCashAdvance } = await import('../repositories/cashAdvances')
    return addPartialCashAdvance(body)
  })

  apiHandlers.set('cashAdvances.partials.settle', async (body) => {
    const { settlePartialCashAdvance } = await import('../repositories/cashAdvances')
    return settlePartialCashAdvance(body)
  })

  apiHandlers.set('cashAdvances.partials.delete', async (body) => {
    const { deletePartialCashAdvance } = await import('../repositories/cashAdvances')
    return deletePartialCashAdvance(body.id)
  })

  apiHandlers.set('cashAdvances.settlements.add', async (body) => {
    const { addSettlement } = await import('../repositories/cashAdvances')
    return addSettlement(body)
  })

  apiHandlers.set('cashAdvances.settlements.delete', async (body) => {
    const { deleteSettlement } = await import('../repositories/cashAdvances')
    return deleteSettlement(body.id)
  })

  apiHandlers.set('cashAdvances.settlements.read', async (body) => {
    const { getSettlementFile } = await import('../repositories/cashAdvances')
    const file = getSettlementFile(body.id)
    if (!file) throw new Error('Beleg nicht gefunden')
    if (!file.filePath) throw new Error('Beleg nicht gefunden')
    let src = file.filePath
    if (!fs.existsSync(src)) {
      const alt = path.join(getAppDataDir().filesDir, path.basename(src))
      if (fs.existsSync(alt)) src = alt
    }
    if (!fs.existsSync(src)) throw new Error('Beleg nicht gefunden')
    const buff = fs.readFileSync(src)
    return { fileName: file.fileName, mimeType: file.mimeType, dataBase64: Buffer.from(buff).toString('base64') }
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

      // Authentication (only enforced if at least one active user has a password)
      const { isAuthRequired, getUserBySessionToken } = await import('../repositories/users')
      const mustAuth = isAuthRequired()

      let authUser: any = undefined
      if (route !== 'auth.login' && route !== 'auth.isRequired' && route !== 'auth.logout') {
        if (mustAuth) {
          const authHeader = String(req.headers.authorization || '')
          const m = /^Bearer\s+(.+)$/i.exec(authHeader)
          const token = m?.[1]?.trim()
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unauthorized' }))
            return
          }
          const u = getUserBySessionToken(token)
          if (!u) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unauthorized' }))
            return
          }
          authUser = { ...u, token }
        }
      } else if (route === 'auth.logout') {
        const authHeader = String(req.headers.authorization || '')
        const m = /^Bearer\s+(.+)$/i.exec(authHeader)
        const token = m?.[1]?.trim()
        authUser = token ? { token } : undefined
      }

      const result = await handler(body, authUser)
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

export async function startServer(): Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    if (server) {
      resolve({ success: true }) // Already running
      return
    }
    
    const config = getServerConfig()

    if (config.mode !== 'server') {
      resolve({ success: false, error: 'Server kann nur im Modus „Server“ gestartet werden.' })
      return
    }

    try {
      const { isAuthRequired } = await import('../repositories/users')
      if (!isAuthRequired()) {
        resolve({ success: false, error: 'Bitte zuerst ein Admin-Passwort setzen (Einstellungen → Benutzer), bevor der Server gestartet werden kann.' })
        return
      }
    } catch (e: any) {
      resolve({ success: false, error: e?.message || 'Authentifizierungsprüfung fehlgeschlagen' })
      return
    }
    
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

    server.on('connection', (socket) => {
      // Track active sockets instead of counting total connections ever seen.
      activeSockets.add(socket)
      connectedClients = activeSockets.size
      socket.on('close', () => {
        activeSockets.delete(socket)
        connectedClients = activeSockets.size
      })
    })

    server.on('close', () => {
      activeSockets.clear()
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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getClientAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  
  const response = await fetch(`${url}/api/${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}
