import { useCallback, useEffect, useState } from 'react'

export type ArchiveSettings = {
  workYear: number
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
let _cachedShowArchived: boolean | null = null
let _ready = false

export function useArchiveSettings(): ArchiveSettings {
  const [workYear, setWorkYear] = useState<number>(() => _cachedWorkYear ?? new Date().getFullYear())
  const [showArchived, setShowArchived] = useState<boolean>(() => _cachedShowArchived ?? true)
  const [loading, setLoading] = useState<boolean>(!_ready)
  const [ready, setReady] = useState<boolean>(_ready)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const api = (window as any).api
      const wy = await api?.settings?.get?.({ key: 'ui.workYear' })
      const sa = await api?.settings?.get?.({ key: 'ui.showArchived' })

      const parsedWy = parseNumber(wy?.value)
      const parsedSa = parseBoolean(sa?.value)

      const finalWy = parsedWy ?? new Date().getFullYear()
      const finalSa = parsedSa ?? true

      _cachedWorkYear = finalWy
      _cachedShowArchived = finalSa
      _ready = true

      setWorkYear(finalWy)
      setShowArchived(finalSa)
      setReady(true)
    } catch {
      const fallbackWy = new Date().getFullYear()
      _cachedWorkYear = fallbackWy
      _cachedShowArchived = true
      _ready = true
      setWorkYear(fallbackWy)
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
    return () => window.removeEventListener('ui-archive-settings-changed', onChanged)
  }, [reload])

  return { workYear, showArchived, loading, ready, reload }
}
