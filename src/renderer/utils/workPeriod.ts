export function getWorkPeriodRange(cadence: 'ANNUAL' | 'MONTHLY', year: number, month: number) {
  if (cadence === 'ANNUAL') return { from: `${year}-01-01`, to: `${year}-12-31` }
  const normalizedMonth = Math.max(1, Math.min(12, Math.trunc(month)))
  const lastDay = new Date(Date.UTC(year, normalizedMonth, 0)).getUTCDate()
  const prefix = `${year}-${String(normalizedMonth).padStart(2, '0')}`
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, '0')}` }
}
