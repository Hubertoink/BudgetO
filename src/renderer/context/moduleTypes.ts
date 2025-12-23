export type ModuleKey =
  | 'budgets'
  | 'instructors'
  | 'cash-advance'
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
