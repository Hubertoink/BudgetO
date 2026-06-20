import { getBudgetPeriodBounds, nextCarryover, normalizeBudgetCadence } from '../../electron/main/services/budgetPeriod'
import { getWorkPeriodRange } from '../renderer/utils/workPeriod'

describe('budget periods', () => {
  it('builds annual boundaries without timezone-dependent dates', () => {
    expect(getBudgetPeriodBounds({ cadence: 'ANNUAL', year: 2026 })).toEqual({
      cadence: 'ANNUAL',
      year: 2026,
      month: null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      key: '2026'
    })
  })

  it('handles month ends and leap years', () => {
    expect(getBudgetPeriodBounds({ cadence: 'MONTHLY', year: 2028, month: 2 }).endDate).toBe('2028-02-29')
    expect(getBudgetPeriodBounds({ cadence: 'MONTHLY', year: 2027, month: 2 }).endDate).toBe('2027-02-28')
    expect(getBudgetPeriodBounds({ cadence: 'MONTHLY', year: 2026, month: 6 }).key).toBe('2026-06')
  })

  it('rejects invalid period input and safely normalizes stored cadence', () => {
    expect(() => getBudgetPeriodBounds({ cadence: 'MONTHLY', year: 2026, month: 13 })).toThrow('Monat')
    expect(() => getBudgetPeriodBounds({ cadence: 'ANNUAL', year: 1800 })).toThrow('Budgetjahr')
    expect(normalizeBudgetCadence('monthly')).toBe('MONTHLY')
    expect(normalizeBudgetCadence('unknown')).toBe('ANNUAL')
  })

  it('carries surplus and deficit independently', () => {
    expect(nextCarryover(200, { carrySurplus: true, carryDeficit: false })).toBe(200)
    expect(nextCarryover(-200, { carrySurplus: true, carryDeficit: false })).toBe(0)
    expect(nextCarryover(-200, { carrySurplus: false, carryDeficit: true })).toBe(-200)
    expect(nextCarryover(200, { carrySurplus: false, carryDeficit: true })).toBe(0)
  })

  it('uses the same leap-safe month range for the global work period', () => {
    expect(getWorkPeriodRange('MONTHLY', 2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(getWorkPeriodRange('ANNUAL', 2028, 2)).toEqual({ from: '2028-01-01', to: '2028-12-31' })
  })
})
