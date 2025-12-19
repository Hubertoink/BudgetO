import type { ModuleKey } from '../context/ModuleContext'

export type NavKey = 'Dashboard' | 'Buchungen' | 'Verbindlichkeiten' | 'Mitglieder' | 'Budgets' | 'Zweckbindungen' | 'Belege' | 'Reports' | 'Einstellungen'

/**
 * Navigation groups for visual separation:
 * - overview: Dashboard (Startseite)
 * - transactions: Buchungen, Verbindlichkeiten (Kernbereiche Geldfluss)
 * - organization: Mitglieder, Budgets, Zweckbindungen (Vereinsstruktur)
 * - documents: Belege, Reports (Dokumente & Auswertungen)
 * - system: Einstellungen (Konfiguration)
 */
export type NavGroup = 'overview' | 'transactions' | 'organization' | 'documents' | 'system'

export interface NavItem {
  key: NavKey
  label: string
  group: NavGroup
  showDividerAfter?: boolean
  /** If set, this nav item is only shown when the corresponding module is enabled */
  moduleKey?: ModuleKey
}

export const navItems: NavItem[] = [
  // Übersicht
  { key: 'Dashboard', label: 'Dashboard', group: 'overview' },
  // Kernbereiche Geldfluss
  { key: 'Buchungen', label: 'Buchungen', group: 'transactions' },
  { key: 'Verbindlichkeiten', label: 'Verbindlichkeiten', group: 'transactions', moduleKey: 'invoices' },
  // Vereinsstruktur & Planung
  { key: 'Mitglieder', label: 'Mitglieder', group: 'organization', moduleKey: 'members' },
  { key: 'Budgets', label: 'Budgets', group: 'organization', moduleKey: 'budgets' },
  { key: 'Zweckbindungen', label: 'Zweckbindungen', group: 'organization', moduleKey: 'earmarks' },
  // Dokumente & Auswertungen
  { key: 'Belege', label: 'Belege', group: 'documents' },
  { key: 'Reports', label: 'Reports', group: 'documents' },
  // System
  { key: 'Einstellungen', label: 'Einstellungen', group: 'system' },
]
