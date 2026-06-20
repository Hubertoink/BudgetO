export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Ungültiges Fälligkeitsdatum')
  const parsed = { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
  if (parsed.month < 0 || parsed.month > 11 || parsed.day < 1 || parsed.day > daysInMonth(parsed.year, parsed.month)) {
    throw new Error('Ungültiges Fälligkeitsdatum')
  }
  return parsed
}

function formatUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function nextOccurrenceDate(
  currentDate: string,
  frequency: RecurrenceFrequency,
  intervalCount = 1,
  anchorDay?: number
) {
  const current = parseIsoDate(currentDate)
  const interval = Math.max(1, Math.floor(intervalCount))
  const anchor = Math.max(1, Math.min(31, anchorDay ?? current.day))

  if (frequency === 'WEEKLY') {
    const date = new Date(Date.UTC(current.year, current.month, current.day + 7 * interval))
    return formatUtcDate(date)
  }

  const monthsToAdd = frequency === 'MONTHLY'
    ? interval
    : frequency === 'QUARTERLY'
      ? interval * 3
      : interval * 12
  const targetFirst = new Date(Date.UTC(current.year, current.month + monthsToAdd, 1))
  const targetDay = Math.min(anchor, daysInMonth(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth()))
  return formatUtcDate(new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), targetDay)))
}
