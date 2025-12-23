import { useContext } from 'react'
import { ModuleContext } from './moduleContextStore'
import type { ModuleContextValue } from './moduleContextStore'
import type { ModuleKey } from './moduleTypes'

export function useModules(): ModuleContextValue {
  const context = useContext(ModuleContext)
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider')
  }
  return context
}

export function useIsModuleEnabled(key: ModuleKey): boolean {
  const { isModuleEnabled } = useModules()
  return isModuleEnabled(key)
}
