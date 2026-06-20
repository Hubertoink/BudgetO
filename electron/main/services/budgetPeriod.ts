export type BudgetCadence = 'ANNUAL' | 'MONTHLY'

export interface BudgetPeriodBounds {
  cadence: BudgetCadence
  year: number
  month: number | null
  startDate: string
  endDate: string
  key: string
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizeBudgetCadence(value: unknown): BudgetCadence {
  return String(value || '').toUpperCase() === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL'
}

export function nextCarryover(remaining: number, options: { carrySurplus: boolean; carryDeficit: boolean }): number {
  if (remaining > 0) return options.carrySurplus ? remaining : 0
  if (remaining < 0) return options.carryDeficit ? remaining : 0
  return 0
}

export function getBudgetPeriodBounds(input: {
  cadence: BudgetCadence
  year: number
  month?: number | null
}): BudgetPeriodBounds {
  const cadence = normalizeBudgetCadence(input.cadence)
  const year = Math.trunc(Number(input.year))
  if (!Number.isFinite(year) || year < 1900 || year > 9999) {
    throw new Error('Ungültiges Budgetjahr')
  }

  if (cadence === 'ANNUAL') {
    return {
      cadence,
      year,
      month: null,
      startDate: isoDate(year, 1, 1),
      endDate: isoDate(year, 12, 31),
      key: String(year)
    }
  }

  const month = Math.trunc(Number(input.month))
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Für ein Monatsbudget wird ein Monat zwischen 1 und 12 benötigt')
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    cadence,
    year,
    month,
    startDate: isoDate(year, month, 1),
    endDate: isoDate(year, month, lastDay),
    key: `${year}-${String(month).padStart(2, '0')}`
  }
}

export function monthLabel(year: number, month: number): string {
  const value = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
