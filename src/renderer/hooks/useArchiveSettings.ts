import { useCallback, useEffect, useState } from 'react'
import { getWorkPeriodRange } from '../utils/workPeriod'

export type ArchiveSettings = {
  workYear: number
  workMonth: number
  budgetCadence: 'ANNUAL' | 'MONTHLY'
  periodStart: string
  periodEnd: string
  showArchived: boolean
  loading: boolean
  ready: boolean // true once settings have been loaded at least once
  reload: () => Promise<void>
}

function parseNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function parseBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

// Cached global state to prevent flickering on remounts
let _cachedWorkYear: number | null = null
let _cachedWorkMonth: number | null = null
let _cachedBudgetCadence: 'ANNUAL' | 'MONTHLY' | null = null
let _cachedShowArchived: boolean | null = null
let _ready = false

export function useArchiveSettings(): ArchiveSettings {
  const [workYear, setWorkYear] = useState<number>(() => _cachedWorkYear ?? new Date().getFullYear())
  const [workMonth, setWorkMonth] = useState<number>(() => _cachedWorkMonth ?? new Date().getMonth() + 1)
  const [budgetCadence, setBudgetCadence] = useState<'ANNUAL' | 'MONTHLY'>(() => _cachedBudgetCadence ?? 'ANNUAL')
  const [showArchived, setShowArchived] = useState<boolean>(() => _cachedShowArchived ?? true)
  const [loading, setLoading] = useState<boolean>(!_ready)
  const [ready, setReady] = useState<boolean>(_ready)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const api = (window as any).api
      const [wy, wm, sa, config] = await Promise.all([
        api?.settings?.get?.({ key: 'ui.workYear' }),
        api?.settings?.get?.({ key: 'ui.workMonth' }),
        api?.settings?.get?.({ key: 'ui.showArchived' }),
        api?.budgetPeriods?.config?.get?.()
      ])

      const parsedWy = parseNumber(wy?.value)
      const parsedWm = parseNumber(wm?.value)
      const parsedSa = parseBoolean(sa?.value)

      const finalWy = parsedWy ?? new Date().getFullYear()
      const finalWm = parsedWm != null && parsedWm >= 1 && parsedWm <= 12 ? Math.trunc(parsedWm) : new Date().getMonth() + 1
      const finalCadence = config?.cadence === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL'
      const finalSa = parsedSa ?? true

      _cachedWorkYear = finalWy
      _cachedWorkMonth = finalWm
      _cachedBudgetCadence = finalCadence
      _cachedShowArchived = finalSa
      _ready = true

      setWorkYear(finalWy)
      setWorkMonth(finalWm)
      setBudgetCadence(finalCadence)
      setShowArchived(finalSa)
      setReady(true)
    } catch {
      const fallbackWy = new Date().getFullYear()
      const fallbackWm = new Date().getMonth() + 1
      _cachedWorkYear = fallbackWy
      _cachedWorkMonth = fallbackWm
      _cachedBudgetCadence = 'ANNUAL'
      _cachedShowArchived = true
      _ready = true
      setWorkYear(fallbackWy)
      setWorkMonth(fallbackWm)
      setBudgetCadence('ANNUAL')
      setShowArchived(true)
      setReady(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const onChanged = () => { void reload() }
    window.addEventListener('ui-archive-settings-changed', onChanged)
    window.addEventListener('budget-period-config-changed', onChanged)
    return () => {
      window.removeEventListener('ui-archive-settings-changed', onChanged)
      window.removeEventListener('budget-period-config-changed', onChanged)
    }
  }, [reload])

  const period = getWorkPeriodRange(budgetCadence, workYear, workMonth)
  const periodStart = period.from
  const periodEnd = period.to

  return { workYear, workMonth, budgetCadence, periodStart, periodEnd, showArchived, loading, ready, reload }
}
