import { ICONS } from './icons.constants'

export function emptyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ICONS.EMPTY
  }
  return String(value)
}

export function transferDisplayString(
  from: 'BAR' | 'BANK' | null | undefined,
  to: 'BAR' | 'BANK' | null | undefined
): string {
  const fromStr = from || ICONS.EMPTY
  const toStr = to || ICONS.EMPTY
  return `${fromStr} ${ICONS.ARROW_RIGHT} ${toStr}`
}
