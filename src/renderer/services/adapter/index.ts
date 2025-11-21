/**
 * Data Adapter Module
 * Central export for adapter pattern
 */

export { type IDataAdapter, type AppMode, type AppModeConfig } from './IDataAdapter'
export { LocalAdapter } from './LocalAdapter'
export { CloudAdapter } from './CloudAdapter'
