import { useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import type { ModuleInfo, ModuleKey } from './moduleTypes'
import { ModuleContext } from './moduleContextStore'
import type { ModuleContextValue } from './moduleContextStore'

/**
 * BudgetO Module System - React Context
 * Provides module state management across the application
 */

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedOnceRef = useRef(false)

  const loadModules = useCallback(async () => {
    // Only show the loading state for the initial load.
    // Refreshes (e.g., after toggling a module) should not flip `loading` to true,
    // otherwise consumers like the Settings Modules pane unmount briefly and
    // lose scroll position.
    const isInitialLoad = !hasLoadedOnceRef.current
    try {
      if (isInitialLoad) setLoading(true)
      setError(null)
      const result = await (window as any).api?.modules?.list?.()
      if (result?.modules) {
        setModules(result.modules)
        hasLoadedOnceRef.current = true
      }
    } catch (e: any) {
      console.error('Failed to load modules:', e)
      setError(e?.message || 'Failed to load modules')
      setModules([])
    } finally {
      if (isInitialLoad) setLoading(false)
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

  // BudgetO requires custom categories.
  if (!enabledModules.includes('custom-categories')) enabledModules.push('custom-categories')

  const isModuleEnabled = useCallback((key: ModuleKey): boolean => {
    if (key === 'custom-categories') return true
    const mod = modules.find(m => m.key === key)
    return mod?.enabled ?? false
  }, [modules])

  const setModuleEnabled = useCallback(async (key: ModuleKey, enabled: boolean) => {
    try {
      if (key === 'custom-categories') {
        // BudgetO requires custom categories; do not allow disabling.
        return
      }
      await (window as any).api?.modules?.setEnabled?.({ moduleKey: key, enabled })
      // Optimistic update – no need to dispatch modules-changed here since the
      // context state already reflects the change and consumers re-render via context.
      // Dispatching the event triggers loadModules() which sets loading=true and
      // causes the ModulesPane list to unmount briefly, losing scroll position.
      setModules(prev => prev.map(m => 
        m.key === key ? { ...m, enabled } : m
      ))
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
