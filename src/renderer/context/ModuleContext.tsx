import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

/**
 * BudgetO Module System - React Context
 * Provides module state management across the application
 */

export type ModuleKey = 
  | 'budgets' 
  | 'instructors' 
  | 'cash-advance' 
  | 'excel-import' 
  | 'members' 
  | 'earmarks' 
  | 'invoices'
  | 'custom-categories'

export interface ModuleInfo {
  key: ModuleKey
  name: string
  description: string
  icon: string
  navKey?: string
  enabled: boolean
  displayOrder: number
  configJson?: string | null
}

interface ModuleContextValue {
  modules: ModuleInfo[]
  enabledModules: ModuleKey[]
  loading: boolean
  error: string | null
  isModuleEnabled: (key: ModuleKey) => boolean
  setModuleEnabled: (key: ModuleKey, enabled: boolean) => Promise<void>
  refreshModules: () => Promise<void>
}

const ModuleContext = createContext<ModuleContextValue | undefined>(undefined)

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadModules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await (window as any).api?.modules?.list?.()
      if (result?.modules) {
        setModules(result.modules)
      }
    } catch (e: any) {
      console.error('Failed to load modules:', e)
      setError(e?.message || 'Failed to load modules')
      setModules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadModules()
    
    // Listen for module changes
    const handleModulesChanged = () => loadModules()
    window.addEventListener('modules-changed', handleModulesChanged)
    // Reload after login/logout so modules are visible once authenticated
    const handleAuthChanged = () => loadModules()
    window.addEventListener('auth-changed', handleAuthChanged)
    return () => {
      window.removeEventListener('modules-changed', handleModulesChanged)
      window.removeEventListener('auth-changed', handleAuthChanged)
    }
  }, [loadModules])

  const enabledModules = modules
    .filter(m => m.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(m => m.key)

  const isModuleEnabled = useCallback((key: ModuleKey): boolean => {
    const mod = modules.find(m => m.key === key)
    return mod?.enabled ?? false
  }, [modules])

  const setModuleEnabled = useCallback(async (key: ModuleKey, enabled: boolean) => {
    try {
      await (window as any).api?.modules?.setEnabled?.({ moduleKey: key, enabled })
      // Optimistic update
      setModules(prev => prev.map(m => 
        m.key === key ? { ...m, enabled } : m
      ))
      window.dispatchEvent(new Event('modules-changed'))
    } catch (e: any) {
      console.error('Failed to update module:', e)
      throw e
    }
  }, [])

  const value: ModuleContextValue = {
    modules,
    enabledModules,
    loading,
    error,
    isModuleEnabled,
    setModuleEnabled,
    refreshModules: loadModules
  }

  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  )
}

export function useModules(): ModuleContextValue {
  const context = useContext(ModuleContext)
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider')
  }
  return context
}

/**
 * Hook to check if a specific module is enabled
 */
export function useIsModuleEnabled(key: ModuleKey): boolean {
  const { isModuleEnabled } = useModules()
  return isModuleEnabled(key)
}

/**
 * Mapping from ModuleKey to NavKey for navigation
 */
export const MODULE_NAV_MAP: Record<ModuleKey, string | undefined> = {
  'budgets': 'Budgets',
  'instructors': 'Übungsleiter',
  'cash-advance': 'Barvorschüsse',
  'excel-import': undefined,
  'members': 'Mitglieder',
  'earmarks': 'Zweckbindungen',
  'invoices': 'Verbindlichkeiten',
  'custom-categories': undefined
}
