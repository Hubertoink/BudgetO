import { createContext } from 'react'
import type { ModuleInfo, ModuleKey } from './moduleTypes'

export interface ModuleContextValue {
  modules: ModuleInfo[]
  enabledModules: ModuleKey[]
  loading: boolean
  error: string | null
  isModuleEnabled: (key: ModuleKey) => boolean
  setModuleEnabled: (key: ModuleKey, enabled: boolean) => Promise<void>
  refreshModules: () => Promise<void>
}

export const ModuleContext = createContext<ModuleContextValue | undefined>(undefined)
