import { getDb } from '../db/database'

/**
 * BudgetO Module System
 * Allows enabling/disabling feature modules dynamically
 */

export type ModuleKey = 
  | 'budgets' 
  | 'instructors' 
  | 'cash-advance' 
  | 'cash-check'
  | 'excel-import' 
  | 'members' 
  | 'earmarks' 
  | 'invoices'
  | 'custom-categories'

export interface ModuleConfig {
  id: number
  moduleKey: ModuleKey
  enabled: boolean
  displayOrder: number
  configJson?: string | null
  updatedAt: string
}

export interface ModuleDefinition {
  key: ModuleKey
  name: string
  description: string
  icon: string
  navKey?: string // Navigation key if module has a view
  isCore?: boolean // Core modules cannot be disabled
}

// Module definitions with metadata
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: 'budgets',
    name: 'Budgets',
    description: 'Jahresbudget-Planung mit Soll-Ist-Vergleich',
    icon: 'chart-bar',
    navKey: 'Budgets'
  },
  {
    key: 'instructors',
    name: 'Übungsleiter',
    description: 'Verträge, Rechnungen und Jahresobergrenzen für Übungsleiter',
    icon: 'users',
    navKey: 'Übungsleiter'
  },
  {
    key: 'cash-advance',
    name: 'Barvorschüsse',
    description: 'Barvorschuss-Verwaltung mit Anordnungsnummern und Teil-Vorschüssen',
    icon: 'banknotes',
    navKey: 'Barvorschüsse'
  },
  {
    key: 'cash-check',
    name: 'Kassenprüfung',
    description: 'Kassenprüfung erfassen (Soll/Ist), Ausgleichsbuchung erstellen und PDF-Bericht exportieren',
    icon: 'clipboard-document-check',
    navKey: undefined
  },
  {
    key: 'excel-import',
    name: 'Excel-Import',
    description: 'Import von Buchungen via Excel-Dateien mit Spalten-Mapping',
    icon: 'table-cells',
    navKey: undefined // No dedicated nav, accessed via menu
  },
  {
    key: 'members',
    name: 'Mitglieder',
    description: 'Mitgliederverwaltung mit Beiträgen und SEPA-Daten',
    icon: 'user-group',
    navKey: 'Mitglieder'
  },
  {
    key: 'earmarks',
    name: 'Zweckbindungen',
    description: 'Verwaltung zweckgebundener Mittel und Fördermittel',
    icon: 'bookmark',
    navKey: 'Zweckbindungen'
  },
  {
    key: 'invoices',
    name: 'Verbindlichkeiten',
    description: 'Rechnungsverwaltung mit Zahlungsverfolgung',
    icon: 'document-text',
    navKey: 'Verbindlichkeiten'
  },
  {
    key: 'custom-categories',
    name: 'Eigene Kategorien',
    description: 'Ersetzt die festen Sphären durch flexible, benutzerdefinierte Kategorien',
    icon: 'folder',
    navKey: undefined // Accessed via Settings > Kategorien
  }
]

/**
 * List all module configurations
 */
export function listModules(): ModuleConfig[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT id, module_key, enabled, display_order, config_json, updated_at 
    FROM module_config 
    ORDER BY display_order ASC
  `).all() as any[]
  
  return rows.map(r => ({
    id: r.id,
    moduleKey: r.module_key as ModuleKey,
    enabled: !!r.enabled,
    displayOrder: r.display_order,
    configJson: r.config_json,
    updatedAt: r.updated_at
  }))
}

/**
 * Get a single module configuration by key
 */
export function getModule(moduleKey: ModuleKey): ModuleConfig | null {
  const d = getDb()
  const row = d.prepare(`
    SELECT id, module_key, enabled, display_order, config_json, updated_at 
    FROM module_config 
    WHERE module_key = ?
  `).get(moduleKey) as any
  
  if (!row) return null
  
  return {
    id: row.id,
    moduleKey: row.module_key as ModuleKey,
    enabled: !!row.enabled,
    displayOrder: row.display_order,
    configJson: row.config_json,
    updatedAt: row.updated_at
  }
}

/**
 * Update a module's enabled state
 */
export function setModuleEnabled(moduleKey: ModuleKey, enabled: boolean): { success: boolean } {
  const d = getDb()
  d.prepare(`
    UPDATE module_config 
    SET enabled = ?, updated_at = datetime('now') 
    WHERE module_key = ?
  `).run(enabled ? 1 : 0, moduleKey)
  
  return { success: true }
}

/**
 * Update module configuration JSON
 */
export function setModuleConfig(moduleKey: ModuleKey, configJson: string | null): { success: boolean } {
  const d = getDb()
  d.prepare(`
    UPDATE module_config 
    SET config_json = ?, updated_at = datetime('now') 
    WHERE module_key = ?
  `).run(configJson, moduleKey)
  
  return { success: true }
}

/**
 * Update display order for all modules
 */
export function updateModuleOrder(order: ModuleKey[]): { success: boolean } {
  const d = getDb()
  const stmt = d.prepare(`
    UPDATE module_config 
    SET display_order = ?, updated_at = datetime('now') 
    WHERE module_key = ?
  `)
  
  order.forEach((key, index) => {
    stmt.run(index, key)
  })
  
  return { success: true }
}

/**
 * Get list of enabled module keys
 */
export function getEnabledModules(): ModuleKey[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT module_key FROM module_config 
    WHERE enabled = 1 
    ORDER BY display_order ASC
  `).all() as any[]
  
  return rows.map(r => r.module_key as ModuleKey)
}
