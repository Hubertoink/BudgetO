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
