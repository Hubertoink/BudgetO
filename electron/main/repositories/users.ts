import { getDb } from '../db/database'
import { getSetting } from '../services/settings'
import crypto from 'node:crypto'

/**
 * BudgetO User & Authentication System
 * Supports roles: ADMIN (full access), KASSE (Kassier - full access), READONLY (view only)
 */

export type UserRole = 'ADMIN' | 'KASSE' | 'READONLY'

export interface User {
  id: number
  name: string
  username: string | null
  email: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  lastLogin: string | null
}

export interface UserCreateInput {
  name: string
  username: string
  password: string
  email?: string
  role: UserRole
}

export interface UserUpdateInput {
  id: number
  name?: string
  username?: string
  password?: string
  email?: string
  role?: UserRole
  isActive?: boolean
}

// ============================================================================
// Password Hashing (using Node.js crypto - no external dependencies)
// ============================================================================

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const ITERATIONS = 100000
const DIGEST = 'sha512'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'))
}

// ============================================================================
// User CRUD Operations
// ============================================================================

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role as UserRole,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login
  }
}

/**
 * List all users
 */
export function listUsers(opts?: { includeInactive?: boolean }): User[] {
  const d = getDb()
  const whereClause = opts?.includeInactive ? '' : 'WHERE is_active = 1'
  const rows = d.prepare(`
    SELECT id, name, username, email, role, is_active, created_at, updated_at, last_login 
    FROM users 
    ${whereClause}
    ORDER BY name
  `).all() as any[]
  
  return rows.map(mapRowToUser)
}

/**
 * Get user by ID
 */
export function getUserById(id: number): User | null {
  const d = getDb()
  const row = d.prepare(`
    SELECT id, name, username, email, role, is_active, created_at, updated_at, last_login 
    FROM users WHERE id = ?
  `).get(id) as any
  
  return row ? mapRowToUser(row) : null
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): User | null {
  const d = getDb()
  const row = d.prepare(`
    SELECT id, name, username, email, role, is_active, created_at, updated_at, last_login 
    FROM users WHERE username = ? AND is_active = 1
  `).get(username) as any
  
  return row ? mapRowToUser(row) : null
}

/**
 * Create a new user
 */
export function createUser(input: UserCreateInput): User {
  const d = getDb()
  const passwordHash = hashPassword(input.password)
  
  const info = d.prepare(`
    INSERT INTO users (name, username, password_hash, email, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
  `).run(input.name, input.username, passwordHash, input.email || null, input.role)
  
  return getUserById(Number(info.lastInsertRowid))!
}

/**
 * Update an existing user
 */
export function updateUser(input: UserUpdateInput): User | null {
  const d = getDb()
  const existing = getUserById(input.id)
  if (!existing) return null

  const updates: string[] = []
  const params: any[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    params.push(input.name)
  }
  if (input.username !== undefined) {
    updates.push('username = ?')
    params.push(input.username)
  }
  if (input.password !== undefined) {
    updates.push('password_hash = ?')
    params.push(hashPassword(input.password))
  }
  if (input.email !== undefined) {
    updates.push('email = ?')
    params.push(input.email)
  }
  if (input.role !== undefined) {
    updates.push('role = ?')
    params.push(input.role)
  }
  if (input.isActive !== undefined) {
    updates.push('is_active = ?')
    params.push(input.isActive ? 1 : 0)
  }

  if (updates.length === 0) return existing

  updates.push("updated_at = datetime('now')")
  params.push(input.id)

  d.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  
  return getUserById(input.id)
}

/**
 * Delete a user (soft delete - set is_active = 0)
 */
export function deleteUser(id: number): { success: boolean } {
  const d = getDb()
  d.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id)
  return { success: true }
}

// ============================================================================
// Authentication
// ============================================================================

export interface LoginResult {
  success: boolean
  user?: User
  error?: string
}

// ============================================================================
// Sessions (token-based, used by network mode HTTP API)
// ============================================================================

export function createSession(userId: number): string {
  const d = getDb()
  const token = crypto.randomBytes(32).toString('hex')

  // Session TTL: keep relatively short for network mode.
  // Must always set expires_at due to NOT NULL constraint.
  const TTL_DAYS = 7
  try {
    d.prepare(`
      INSERT INTO user_sessions (token, user_id, created_at, expires_at, is_valid)
      VALUES (?, ?, datetime('now'), datetime('now', ?), 1)
    `).run(token, userId, `+${TTL_DAYS} days`)
  } catch {
    // Fallback for older schemas that don't have expires_at/is_valid
    d.prepare(`
      INSERT INTO user_sessions (token, user_id)
      VALUES (?, ?)
    `).run(token, userId)
  }
  return token
}

export function deleteSessionByToken(token: string): void {
  const d = getDb()
  d.prepare('DELETE FROM user_sessions WHERE token = ?').run(token)
}

export function getUserBySessionToken(token: string): User | null {
  const d = getDb()
  try {
    const row = d.prepare(`
      SELECT u.id, u.name, u.username, u.email, u.role, u.is_active, u.created_at, u.updated_at, u.last_login
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND u.is_active = 1 AND s.is_valid = 1 AND s.expires_at > datetime('now')
    `).get(token) as any
    return row ? mapRowToUser(row) : null
  } catch {
    // Fallback for older schemas
    const row = d.prepare(`
      SELECT u.id, u.name, u.username, u.email, u.role, u.is_active, u.created_at, u.updated_at, u.last_login
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND u.is_active = 1
    `).get(token) as any
    return row ? mapRowToUser(row) : null
  }
}

/**
 * Authenticate a user with username and password
 */
export function login(username: string, password: string): LoginResult {
  const d = getDb()
  
  // Get user with password hash
  const row = d.prepare(`
    SELECT id, name, username, email, role, is_active, created_at, updated_at, last_login, password_hash 
    FROM users WHERE username = ?
  `).get(username) as any
  
  if (!row) {
    return { success: false, error: 'Benutzername oder Passwort falsch' }
  }
  
  if (!row.is_active) {
    return { success: false, error: 'Benutzer ist deaktiviert' }
  }
  
  // Check if password_hash exists (for migrated users without password)
  if (!row.password_hash) {
    // For initial setup: allow login without password if no hash set
    // This allows the first admin to set their password
    d.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id)
    return { success: true, user: mapRowToUser(row) }
  }
  
  if (!verifyPassword(password, row.password_hash)) {
    return { success: false, error: 'Benutzername oder Passwort falsch' }
  }
  
  // Update last login
  d.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id)
  
  return { success: true, user: mapRowToUser(row) }
}

/**
 * Set initial password for a user (for first-time setup)
 */
export function setInitialPassword(userId: number, password: string): { success: boolean } {
  const d = getDb()
  const passwordHash = hashPassword(password)
  d.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, userId)
  return { success: true }
}

/**
 * Change password for a user
 */
export function changePassword(userId: number, currentPassword: string, newPassword: string): { success: boolean; error?: string } {
  const d = getDb()
  
  const row = d.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any
  if (!row) {
    return { success: false, error: 'Benutzer nicht gefunden' }
  }
  
  // If password_hash exists, verify current password
  if (row.password_hash && !verifyPassword(currentPassword, row.password_hash)) {
    return { success: false, error: 'Aktuelles Passwort ist falsch' }
  }
  
  const newHash = hashPassword(newPassword)
  d.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, userId)
  
  return { success: true }
}

/**
 * Clear password for a user (requires current password if a password is set).
 * Intended for switching back to local-only usage without authentication.
 */
export function clearPassword(userId: number, currentPassword: string): { success: boolean; error?: string } {
  const d = getDb()
  const row = d.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any
  if (!row) return { success: false, error: 'Benutzer nicht gefunden' }

  if (row.password_hash) {
    if (!currentPassword) return { success: false, error: 'Aktuelles Passwort ist erforderlich' }
    if (!verifyPassword(currentPassword, row.password_hash)) {
      return { success: false, error: 'Aktuelles Passwort ist falsch' }
    }
  }

  d.prepare("UPDATE users SET password_hash = NULL, updated_at = datetime('now') WHERE id = ?").run(userId)
  return { success: true }
}

/**
 * Admin-only clear without knowing the current password.
 */
export function clearPasswordAdmin(userId: number): { success: boolean } {
  const d = getDb()
  d.prepare("UPDATE users SET password_hash = NULL, updated_at = datetime('now') WHERE id = ?").run(userId)
  return { success: true }
}

// ============================================================================
// Authorization Helpers
// ============================================================================

/**
 * Check if a role has write permissions
 */
export function canWrite(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'KASSE'
}

/**
 * Check if a role can manage users
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN'
}

/**
 * Check if a role can access settings
 */
export function canAccessSettings(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'KASSE'
}

/**
 * Check if authentication is required (returns true if any user has a password set)
 */
export function isAuthRequired(): boolean {
  const d = getDb()
  const row = d.prepare('SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL AND is_active = 1').get() as any
  return (row?.count || 0) > 0
}

/**
 * Effective auth enforcement depending on server mode.
 *
 * - If no active user has a password: never require auth.
 * - In local mode: auth can be disabled even if passwords exist (setting).
 * - In server/client mode: auth is always enforced when passwords exist.
 */
export function isAuthEnforced(mode: 'local' | 'server' | 'client'): boolean {
  const requiredByPasswords = isAuthRequired()
  if (!requiredByPasswords) return false
  if (mode !== 'local') return true
  const requireInLocal = getSetting<boolean>('auth.requireInLocalMode')
  return requireInLocal === true
}

/**
 * Get count of active users
 */
export function getUserCount(): number {
  const d = getDb()
  const row = d.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get() as any
  return row?.count || 0
}
