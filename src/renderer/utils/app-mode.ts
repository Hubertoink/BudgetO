import type { AppMode, AppModeConfig, IDataAdapter } from '../services/adapter/IDataAdapter'
import { LocalAdapter } from '../services/adapter/LocalAdapter'
import { CloudAdapter } from '../services/adapter/CloudAdapter'

// Export types for external use
export type { AppMode, AppModeConfig }

const APP_MODE_KEY = 'app_mode'
const CLOUD_CONFIG_KEY = 'cloud_config'

/**
 * Get current app mode from localStorage
 */
export function getAppMode(): AppMode {
  const stored = localStorage.getItem(APP_MODE_KEY)
  return (stored as AppMode) || 'local'
}

/**
 * Set app mode
 */
export function setAppMode(mode: AppMode): void {
  localStorage.setItem(APP_MODE_KEY, mode)
  // Trigger re-render by dispatching event
  window.dispatchEvent(new CustomEvent('app-mode-changed', { detail: { mode } }))
}

/**
 * Get cloud configuration
 */
export function getCloudConfig(): { apiUrl: string; token?: string } | null {
  const stored = localStorage.getItem(CLOUD_CONFIG_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

/**
 * Set cloud configuration
 */
export function setCloudConfig(config: { apiUrl: string; token?: string }): void {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config))
}

/**
 * Clear cloud configuration
 */
export function clearCloudConfig(): void {
  localStorage.removeItem(CLOUD_CONFIG_KEY)
  localStorage.removeItem('cloud_token')
}

/**
 * Get full app mode configuration
 */
export function getAppModeConfig(): AppModeConfig {
  const mode = getAppMode()
  const cloudConfig = mode === 'cloud' ? getCloudConfig() : undefined
  return {
    mode,
    cloudConfig: cloudConfig || undefined
  }
}

/**
 * Create data adapter based on current mode
 */
export function createDataAdapter(): IDataAdapter {
  const mode = getAppMode()
  
  if (mode === 'local') {
    return new LocalAdapter()
  }
  
  // Cloud mode
  const cloudConfig = getCloudConfig()
  if (!cloudConfig) {
    throw new Error('Cloud mode selected but no cloud configuration found')
  }
  
  return new CloudAdapter(cloudConfig.apiUrl, cloudConfig.token)
}

/**
 * Hook to use data adapter (React-friendly)
 */
let cachedAdapter: IDataAdapter | null = null
let currentMode: AppMode | null = null

export function useDataAdapter(): IDataAdapter {
  const mode = getAppMode()
  
  // Recreate adapter if mode changed
  if (!cachedAdapter || mode !== currentMode) {
    cachedAdapter = createDataAdapter()
    currentMode = mode
  }
  
  return cachedAdapter
}

/**
 * Invalidate cached adapter (call when switching modes)
 */
export function invalidateDataAdapter(): void {
  cachedAdapter = null
  currentMode = null
}
