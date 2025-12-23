import { createContext } from 'react'
import type { User } from './authTypes'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authRequired: boolean
  authEnforced: boolean

  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>

  canWrite: boolean
  canManageUsers: boolean
  canAccessSettings: boolean
  isAdmin: boolean
  isKassier: boolean
  isReadonly: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const USER_STORAGE_KEY = 'budgeto_current_user'
export const TOKEN_STORAGE_KEY = 'budgeto_auth_token'
