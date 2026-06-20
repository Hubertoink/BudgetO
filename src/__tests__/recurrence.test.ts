import { nextOccurrenceDate } from '../../electron/main/services/recurrence'

describe('nextOccurrenceDate', () => {
  it('preserves the anchor day after a short month', () => {
    expect(nextOccurrenceDate('2027-01-31', 'MONTHLY', 1, 31)).toBe('2027-02-28')
    expect(nextOccurrenceDate('2027-02-28', 'MONTHLY', 1, 31)).toBe('2027-03-31')
  })

  it('handles leap years for yearly schedules', () => {
    expect(nextOccurrenceDate('2028-02-29', 'YEARLY', 1, 29)).toBe('2029-02-28')
  })

  it('supports weekly and multi-quarter intervals', () => {
    expect(nextOccurrenceDate('2026-06-20', 'WEEKLY', 2)).toBe('2026-07-04')
    expect(nextOccurrenceDate('2026-01-15', 'QUARTERLY', 2, 15)).toBe('2026-07-15')
  })

  it('rejects impossible calendar dates', () => {
    expect(() => nextOccurrenceDate('2026-02-31', 'MONTHLY')).toThrow('Ungültiges Fälligkeitsdatum')
  })
})
