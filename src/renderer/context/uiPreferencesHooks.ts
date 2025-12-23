import { useContext } from 'react'
import { UIPreferencesContext } from './uiPreferencesContextStore'
import type { UIPreferencesContextValue } from './uiPreferencesTypes'

export function useUIPreferences(): UIPreferencesContextValue {
  const ctx = useContext(UIPreferencesContext)
  if (!ctx) throw new Error('useUIPreferences must be used within UIPreferencesProvider')
  return ctx
}
