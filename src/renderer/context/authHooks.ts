import { useContext } from 'react'
import { AuthContext } from './authContextStore'
import type { AuthContextValue } from './authContextStore'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useRequireAuth(): { isAuthenticated: boolean; isLoading: boolean } {
  const { isAuthenticated, isLoading, authEnforced } = useAuth()

  if (!authEnforced) {
    return { isAuthenticated: true, isLoading }
  }

  return { isAuthenticated, isLoading }
}

export function useCanWrite(): boolean {
  const { canWrite, isAuthenticated } = useAuth()
  return isAuthenticated && canWrite
}
