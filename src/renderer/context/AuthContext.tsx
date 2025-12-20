import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

/**
 * BudgetO Authentication Context
 * Provides user authentication state and authorization helpers
 */

export type UserRole = 'ADMIN' | 'KASSE' | 'READONLY'

export interface User {
  id: number
  name: string
  username: string | null
  email: string | null
  role: UserRole
  isActive: boolean
  lastLogin: string | null
}

interface AuthContextValue {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authRequired: boolean
  
  // Actions
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
  
  // Authorization helpers
  canWrite: boolean
  canManageUsers: boolean
  canAccessSettings: boolean
  isAdmin: boolean
  isKassier: boolean
  isReadonly: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Storage key for persisting user session
const USER_STORAGE_KEY = 'budgeto_current_user'
const TOKEN_STORAGE_KEY = 'budgeto_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)

  const refreshAuthRequired = useCallback(async () => {
    try {
      const authResult = await (window as any).api?.auth?.isRequired?.()
      const required = authResult?.required ?? false
      setAuthRequired(required)
      return required
    } catch {
      return authRequired
    }
  }, [authRequired])

  // Check if auth is required and restore session on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true)

        // Restore client-mode token early so protected API calls work after reload.
        try {
          const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
          if (storedToken) {
            await (window as any).api?.auth?.setToken?.({ token: storedToken })
          }
        } catch {
          // ignore
        }
        
        // Check if authentication is required
        const required = await refreshAuthRequired()
        
        // Try to restore session from storage
        const storedUser = sessionStorage.getItem(USER_STORAGE_KEY)
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser)
            // Verify user still exists and is active
            const userResult = await (window as any).api?.users?.get?.({ id: parsed.id })
            if (userResult?.user?.isActive) {
              setUser(userResult.user)
            } else {
              sessionStorage.removeItem(USER_STORAGE_KEY)
            }
          } catch {
            sessionStorage.removeItem(USER_STORAGE_KEY)
          }
        }
        
        // If no auth required and no user, auto-login as admin
        if (!required && !storedUser) {
          const usersResult = await (window as any).api?.users?.list?.()
          const adminUser = usersResult?.users?.find((u: any) => u.role === 'ADMIN' && u.isActive)
          if (adminUser) {
            setUser(adminUser)
            sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))
          }
        }
      } catch (e) {
        console.error('Auth init failed:', e)
      } finally {
        setIsLoading(false)
      }
    }
    
    init()
  }, [])

  useEffect(() => {
    const onAuthChanged = () => { void refreshAuthRequired() }
    const onDataChanged = () => { void refreshAuthRequired() }
    window.addEventListener('auth-changed', onAuthChanged)
    window.addEventListener('data-changed', onDataChanged)
    return () => {
      window.removeEventListener('auth-changed', onAuthChanged)
      window.removeEventListener('data-changed', onDataChanged)
    }
  }, [refreshAuthRequired])

  // If auth is not required, ensure we always have a selected user (admin) for local usage.
  useEffect(() => {
    async function ensureLocalUser() {
      if (isLoading) return
      if (authRequired) return
      if (user) return
      try {
        const usersResult = await (window as any).api?.users?.list?.()
        const adminUser = usersResult?.users?.find((u: any) => u.role === 'ADMIN' && u.isActive)
        if (adminUser) {
          setUser(adminUser)
          sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))
        }
      } catch {
        // ignore
      }
    }
    void ensureLocalUser()
  }, [authRequired, user, isLoading])

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await (window as any).api?.auth?.login?.({ username, password })
      
      if (result?.success && result?.user) {
        const token = typeof result?.token === 'string' ? result.token : null
        if (token) {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
          try {
            await (window as any).api?.auth?.setToken?.({ token })
          } catch {
            // ignore
          }
        }
        setUser(result.user)
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user))
        window.dispatchEvent(new Event('auth-changed'))
        return { success: true }
      }
      
      return { success: false, error: result?.error || 'Login fehlgeschlagen' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Login fehlgeschlagen' }
    }
  }, [])

  const logout = useCallback(() => {
    // Invalidate server/main-process session token (best-effort)
    try { void (window as any).api?.auth?.logout?.() } catch {}
    try { void (window as any).api?.auth?.setToken?.({ token: null }) } catch {}
    setUser(null)
    sessionStorage.removeItem(USER_STORAGE_KEY)
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    window.dispatchEvent(new Event('auth-changed'))
  }, [])

  const refreshUser = useCallback(async () => {
    if (!user) return
    
    try {
      const result = await (window as any).api?.users?.get?.({ id: user.id })
      if (result?.user) {
        setUser(result.user)
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user))
      }
    } catch (e) {
      console.error('Failed to refresh user:', e)
    }
  }, [user])

  // Authorization helpers based on role
  const role = user?.role
  const canWrite = role === 'ADMIN' || role === 'KASSE'
  const canManageUsers = role === 'ADMIN'
  const canAccessSettings = role === 'ADMIN' || role === 'KASSE'
  const isAdmin = role === 'ADMIN'
  const isKassier = role === 'KASSE'
  const isReadonly = role === 'READONLY'

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    authRequired,
    login,
    logout,
    refreshUser,
    canWrite,
    canManageUsers,
    canAccessSettings,
    isAdmin,
    isKassier,
    isReadonly
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to require authentication - redirects to login if not authenticated
 */
export function useRequireAuth(): { isAuthenticated: boolean; isLoading: boolean } {
  const { isAuthenticated, isLoading, authRequired } = useAuth()
  
  // If auth is not required, always return authenticated
  if (!authRequired) {
    return { isAuthenticated: true, isLoading }
  }
  
  return { isAuthenticated, isLoading }
}

/**
 * Hook to check write permission - for use in components that modify data
 */
export function useCanWrite(): boolean {
  const { canWrite, isAuthenticated } = useAuth()
  return isAuthenticated && canWrite
}
