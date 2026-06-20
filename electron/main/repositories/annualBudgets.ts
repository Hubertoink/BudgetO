/**
 * Compatibility facade for older renderer/server call sites.
 * New code should use budgetPeriods.ts directly.
 */
import {
  deleteBudgetPeriod,
  getBudgetPeriod,
  getBudgetPeriodUsage,
  listBudgetPeriods,
  upsertBudgetPeriod
} from './budgetPeriods'

export interface AnnualBudget {
  id: number
  year: number
  amount: number
  costCenterId: number | null
  description: string | null
  createdAt: string
  updatedAt: string | null
}

function asAnnual(period: ReturnType<typeof getBudgetPeriod>): AnnualBudget | null {
  if (!period) return null
  return {
    id: period.id,
    year: period.year,
    amount: period.amount,
    costCenterId: null,
    description: period.description,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt
  }
}

export function getAnnualBudget(params: { year: number; costCenterId?: number | null }): AnnualBudget | null {
  return asAnnual(getBudgetPeriod({ cadence: 'ANNUAL', year: params.year }))
}

export function listAnnualBudgets(params: { year?: number } = {}): AnnualBudget[] {
  return listBudgetPeriods({ cadence: 'ANNUAL', year: params.year })
    .map((period) => asAnnual(period))
    .filter((period): period is AnnualBudget => Boolean(period))
}

export function upsertAnnualBudget(input: {
  year: number
  amount: number
  costCenterId?: number | null
  description?: string | null
}): { id: number; created: boolean } {
  return upsertBudgetPeriod({ cadence: 'ANNUAL', year: input.year, amount: input.amount, description: input.description })
}

export function deleteAnnualBudget(id: number): { id: number } {
  return deleteBudgetPeriod(id)
}

export function getAnnualBudgetUsage(params: { year: number; costCenterId?: number | null }): {
  budgeted: number
  spent: number
  income: number
  remaining: number
  percentage: number
} {
  const usage = getBudgetPeriodUsage({ cadence: 'ANNUAL', year: params.year })
  return {
    budgeted: usage.budgeted,
    spent: usage.spent,
    income: usage.income,
    remaining: usage.remaining,
    percentage: usage.percentage
  }
}
