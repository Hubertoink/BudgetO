import type { ModuleKey } from '../context/ModuleContext'

export type NavKey = 'Dashboard' | 'Buchungen' | 'Verbindlichkeiten' | 'Mitglieder' | 'Budgets' | 'Zweckbindungen' | 'Übungsleiter' | 'Barvorschüsse' | 'Belege' | 'Reports' | 'Einstellungen'

/**
 * Navigation groups for visual separation:
 * - overview: Dashboard (Startseite)
 * - transactions: Buchungen, Verbindlichkeiten, Barvorschüsse (Kernbereiche Geldfluss)
 * - organization: Mitglieder, Budgets, Zweckbindungen, Übungsleiter (Vereinsstruktur)
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
  { key: 'Barvorschüsse', label: 'Barvorschüsse', group: 'transactions', moduleKey: 'cash-advance' },
  // Vereinsstruktur & Planung
  { key: 'Mitglieder', label: 'Mitglieder', group: 'organization', moduleKey: 'members' },
  { key: 'Budgets', label: 'Budgets', group: 'organization', moduleKey: 'budgets' },
  { key: 'Zweckbindungen', label: 'Zweckbindungen', group: 'organization', moduleKey: 'earmarks' },
  { key: 'Übungsleiter', label: 'Übungsleiter', group: 'organization', moduleKey: 'instructors' },
  // Dokumente & Auswertungen
  { key: 'Belege', label: 'Belege', group: 'documents' },
  { key: 'Reports', label: 'Reports', group: 'documents' },
  // System
  { key: 'Einstellungen', label: 'Einstellungen', group: 'system' },
]
