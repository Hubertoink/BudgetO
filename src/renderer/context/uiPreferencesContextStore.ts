import { createContext } from 'react'
import type { UIPreferencesContextValue } from './uiPreferencesTypes'

export const UIPreferencesContext = createContext<UIPreferencesContextValue | null>(null)
