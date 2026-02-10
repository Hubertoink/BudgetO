import type { ModuleKey } from './moduleTypes'

export const MODULE_NAV_MAP: Record<ModuleKey, string | undefined> = {
  budgets: 'Budgets',
  instructors: 'Übungsleiter',
  'cash-advance': 'Barvorschüsse',
  'cash-check': undefined,
  'excel-import': undefined,
  members: 'Mitglieder',
  earmarks: 'Zweckbindungen',
  invoices: 'Verbindlichkeiten',
  'custom-categories': undefined
}
