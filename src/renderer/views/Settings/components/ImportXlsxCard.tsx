import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CONST_MAPPING_PREFIX = '__CONST__:'
const IMPORT_MAPPING_KEYS = [
  'date',
  'type',
  'description',
  'paymentMethod',
  'netAmount',
  'vatRate',
  'grossAmount',
  'inGross',
  'outGross',
  'earmarkCode',
  'category',
  'bankIn',
  'bankOut',
  'cashIn',
  'cashOut'
] as const
const IMPORT_PRESETS_SETTINGS_KEY = 'imports.vouchers.mappingPresets'

type ImportMappingPreset = {
  id: string
  name: string
  mapping: Record<string, string | null>
  options: {
    deselectDuplicatesByDefault: boolean
  }
  updatedAt: string
}

type ImportAnalyzeResult = {
  rows: Array<{
    row: number
    status: 'ready' | 'skip' | 'error'
    message?: string
    entries: Array<{
      date: string
      type: 'IN' | 'OUT' | 'TRANSFER'
      paymentMethod?: 'BAR' | 'BANK' | null
      description?: string
      grossAmount: number
      signedGrossAmount: number
    }>
  }>
  summary: {
    totalRows: number
    readyRows: number
    plannedEntries: number
    skippedRows: number
    errorRows: number
  }
}

type DuplicateCandidate = {
  date: string
  grossAmount: number
  source: string
}

type DuplicateJournalMatch = {
  id: number
  voucherNo?: string | null
  date: string
  type: 'IN' | 'OUT' | 'TRANSFER'
  paymentMethod?: 'BAR' | 'BANK' | null
  description?: string | null
  counterparty?: string | null
  categoryName?: string | null
  netAmount?: number | null
  vatRate?: number | null
  grossAmount: number
  earmarkCode?: string | null
  budgetLabel?: string | null
}

type DuplicateModalData = {
  rowNumber: number
  importRow: {
    date: string | null
    type: string | null
    paymentMethod: string | null
    description: string | null
    category: string | null
  }
  candidates: DuplicateCandidate[]
  matchesByKey: Record<string, DuplicateJournalMatch[]>
}

interface ImportXlsxCardProps {
  notify?: (type: 'success' | 'error' | 'info', text: string, ms?: number, action?: { label: string; onClick: () => void }) => void
}

export function ImportXlsxCard({ notify }: ImportXlsxCardProps) {
  const [fileName, setFileName] = useState<string>('')
  const [base64, setBase64] = useState<string>('')
  const [headers, setHeaders] = useState<string[]>([])
  const [sample, setSample] = useState<Array<Record<string, any>>>([])
  const [sampleRowNumbers, setSampleRowNumbers] = useState<number[]>([])
  const [allRowNumbers, setAllRowNumbers] = useState<number[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({
    date: null,
    type: null,
    description: null,
    paymentMethod: null,
    netAmount: null,
    vatRate: null,
    grossAmount: null,
    inGross: null,
    outGross: null,
    earmarkCode: null,
    category: null,
    bankIn: null,
    bankOut: null,
    cashIn: null,
    cashOut: null
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<null | {
    imported: number
    skipped: number
    errors: Array<{ row: number; message: string }>
    rowStatuses?: Array<{ row: number; ok: boolean; message?: string }>
    errorFilePath?: string
    createdVoucherIds?: number[]
  }>(null)
  const [showErrorsModal, setShowErrorsModal] = useState(false)
  const [missingCats, setMissingCats] = useState<null | { names: Array<{ name: string; count: number }> }>(null)
  const [showMissingCatsModal, setShowMissingCatsModal] = useState(false)
  const [pendingImportOptions, setPendingImportOptions] = useState<{ createMissingCategories?: boolean } | null>(null)
  const [importAnalyze, setImportAnalyze] = useState<ImportAnalyzeResult | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string>('')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set())
  const [duplicateCountsByRow, setDuplicateCountsByRow] = useState<Record<number, number>>({})
  const [duplicateCandidatesByRow, setDuplicateCandidatesByRow] = useState<Record<number, DuplicateCandidate[]>>({})
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateModalBusy, setDuplicateModalBusy] = useState(false)
  const [duplicateModalError, setDuplicateModalError] = useState('')
  const [duplicateModalData, setDuplicateModalData] = useState<DuplicateModalData | null>(null)
  const [mappingPresets, setMappingPresets] = useState<ImportMappingPreset[]>([])
  const [activePresetId, setActivePresetId] = useState<string>('')
  const [deselectDuplicatesByDefault, setDeselectDuplicatesByDefault] = useState(false)
  const [showPresetFlyout, setShowPresetFlyout] = useState(false)
  const [presetDraftName, setPresetDraftName] = useState('')
  const [presetDeleteArmed, setPresetDeleteArmed] = useState(false)
  const amountFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const presetDateFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }),
    []
  )
  const presetFlyoutRef = useRef<HTMLDivElement | null>(null)

  const activePreset = useMemo(
    () => mappingPresets.find((preset) => preset.id === activePresetId) || null,
    [activePresetId, mappingPresets]
  )

  function normalizeMapping(input?: Record<string, string | null> | null) {
    const next: Record<string, string | null> = {}
    for (const key of IMPORT_MAPPING_KEYS) next[key] = input?.[key] ?? null
    return next
  }

  function normalizePresetOptions(input?: { deselectDuplicatesByDefault?: boolean } | null) {
    return {
      deselectDuplicatesByDefault: Boolean(input?.deselectDuplicatesByDefault)
    }
  }

  async function loadMappingPresets() {
    try {
      const res = await window.api?.settings?.get?.({ key: IMPORT_PRESETS_SETTINGS_KEY })
      const raw = Array.isArray(res?.value) ? res?.value : []
      const presets = raw
        .map((preset: any) => ({
          id: String(preset?.id || ''),
          name: String(preset?.name || '').trim(),
          mapping: normalizeMapping(preset?.mapping || {}),
          options: normalizePresetOptions(preset?.options || {}),
          updatedAt: String(preset?.updatedAt || '')
        }))
        .filter((preset: ImportMappingPreset) => preset.id && preset.name)
        .sort((a: ImportMappingPreset, b: ImportMappingPreset) => a.name.localeCompare(b.name, 'de'))
      setMappingPresets(presets)
      if (activePresetId && !presets.some((preset: ImportMappingPreset) => preset.id === activePresetId)) {
        setActivePresetId('')
      }
    } catch {
      setMappingPresets([])
    }
  }

  async function persistMappingPresets(next: ImportMappingPreset[]) {
    await window.api?.settings?.set?.({ key: IMPORT_PRESETS_SETTINGS_KEY, value: next })
    setMappingPresets(next.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')))
  }

  function getSuggestedPresetName() {
    const normalized = fileName.replace(/\.[^.]+$/, '').trim()
    return normalized || activePreset?.name || 'Import-Zuordnung'
  }

  useEffect(() => {
    void loadMappingPresets()
  }, [])

  useEffect(() => {
    if (!showPresetFlyout) return
    setPresetDeleteArmed(false)
    setPresetDraftName(activePreset?.name || getSuggestedPresetName())
  }, [activePreset?.name, fileName, showPresetFlyout])

  useEffect(() => {
    if (!showPresetFlyout) return

    function handlePointerDown(event: MouseEvent) {
      if (!presetFlyoutRef.current?.contains(event.target as Node)) {
        setShowPresetFlyout(false)
        setPresetDeleteArmed(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowPresetFlyout(false)
        setPresetDeleteArmed(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showPresetFlyout])

  async function savePresetAsNew() {
    const name = presetDraftName.trim()
    if (!name) {
      notify?.('error', 'Bitte einen Namen für die Import-Vorlage eingeben.')
      return
    }
    const existing = mappingPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase())

    const preset: ImportMappingPreset = {
      id: existing?.id || `${Date.now()}`,
      name,
      mapping: normalizeMapping(mapping),
      options: normalizePresetOptions({ deselectDuplicatesByDefault }),
      updatedAt: new Date().toISOString()
    }
    const next = existing
      ? mappingPresets.map((entry) => (entry.id === existing.id ? preset : entry))
      : [...mappingPresets, preset]
    await persistMappingPresets(next)
    setActivePresetId(preset.id)
    setPresetDraftName(name)
    setPresetDeleteArmed(false)
    setShowPresetFlyout(false)
    notify?.('success', existing ? `Import-Vorlage überschrieben: ${name}` : `Import-Vorlage gespeichert: ${name}`)
  }

  async function overwriteActivePreset() {
    if (!activePresetId) return
    const current = mappingPresets.find((preset) => preset.id === activePresetId)
    if (!current) return
    const nextPreset: ImportMappingPreset = {
      ...current,
      mapping: normalizeMapping(mapping),
      options: normalizePresetOptions({ deselectDuplicatesByDefault }),
      updatedAt: new Date().toISOString()
    }
    const next = mappingPresets.map((preset) => (preset.id === current.id ? nextPreset : preset))
    await persistMappingPresets(next)
    setPresetDraftName(nextPreset.name)
    setPresetDeleteArmed(false)
    setShowPresetFlyout(false)
    notify?.('success', `Import-Vorlage aktualisiert: ${current.name}`)
  }

  async function deleteActivePreset() {
    if (!activePresetId) return
    const current = mappingPresets.find((preset) => preset.id === activePresetId)
    if (!current) return
    if (!presetDeleteArmed) {
      setPresetDeleteArmed(true)
      return
    }
    const next = mappingPresets.filter((preset) => preset.id !== current.id)
    await persistMappingPresets(next)
    setActivePresetId('')
    setPresetDraftName(getSuggestedPresetName())
    setPresetDeleteArmed(false)
    setShowPresetFlyout(false)
    notify?.('info', `Import-Vorlage gelöscht: ${current.name}`)
  }

  function applyPreset(presetId: string) {
    setActivePresetId(presetId)
    setPresetDeleteArmed(false)
    const preset = mappingPresets.find((entry) => entry.id === presetId)
    if (!preset) return
    setMapping(normalizeMapping(preset.mapping))
    setDeselectDuplicatesByDefault(Boolean(preset.options?.deselectDuplicatesByDefault))
    setPresetDraftName(preset.name)
    notify?.('success', `Import-Vorlage geladen: ${preset.name}`)
  }

  const effectiveHeaderRowIndex = headerRowIndex || 1
  const rowNumberForSampleIndex = useMemo(() => {
    return (i: number) => sampleRowNumbers[i] ?? (effectiveHeaderRowIndex + 1 + i)
  }, [effectiveHeaderRowIndex, sampleRowNumbers])

  useEffect(() => {
    if (!allRowNumbers.length) {
      setSelectedRows(new Set())
      return
    }

    const nextRows = deselectDuplicatesByDefault
      ? allRowNumbers.filter((rowNumber) => !(duplicateCountsByRow[rowNumber] > 0))
      : allRowNumbers

    setSelectedRows(new Set(nextRows))
  }, [allRowNumbers, deselectDuplicatesByDefault, duplicateCountsByRow])

  function parseNumber(v: any): number | null {
    if (v == null || v === '') return null
    if (typeof v === 'number' && isFinite(v)) return v
    const s = String(v)
      .replace(/\u00A0/g, ' ')
      .replace(/[€\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const n = Number(s)
    return isFinite(n) ? n : null
  }

  function toISODate(v: any): string | null {
    if (v == null) return null
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    if (typeof v === 'number' && isFinite(v)) {
      const ms = (v - 25569) * 24 * 60 * 60 * 1000
      return new Date(ms).toISOString().slice(0, 10)
    }
    const s = String(v).trim()
    const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
    if (dm) {
      const d = new Date(Date.UTC(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])))
      return d.toISOString().slice(0, 10)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const n = Number(s)
    if (isFinite(n) && n > 25569) {
      const ms = (n - 25569) * 24 * 60 * 60 * 1000
      return new Date(ms).toISOString().slice(0, 10)
    }
    return null
  }

  function duplicateKey(date: string, grossAmount: number): string {
    const rounded = Math.round((grossAmount + Number.EPSILON) * 100) / 100
    return `${date}|${rounded.toFixed(2)}`
  }

  function mappedValueForRow(row: Record<string, any>, mappedHeader: string | null | undefined): string | null {
    if (!mappedHeader) return null
    if (mappedHeader.startsWith(CONST_MAPPING_PREFIX)) return mappedHeader.slice(CONST_MAPPING_PREFIX.length)
    const raw = row?.[mappedHeader]
    if (raw == null || raw === '') return null
    return String(raw)
  }

  function buildImportRowSnapshot(row: Record<string, any>) {
    const inferredPaymentMethod = (() => {
      const direct = mappedValueForRow(row, (mapping as any)?.paymentMethod)
      if (direct) return direct
      const hasBank = [(mapping as any)?.bankIn, (mapping as any)?.bankOut].some((header) => {
        if (!header || String(header).startsWith(CONST_MAPPING_PREFIX)) return false
        return parseNumber(row?.[header]) != null
      })
      if (hasBank) return 'BANK'
      const hasCash = [(mapping as any)?.cashIn, (mapping as any)?.cashOut].some((header) => {
        if (!header || String(header).startsWith(CONST_MAPPING_PREFIX)) return false
        return parseNumber(row?.[header]) != null
      })
      if (hasCash) return 'BAR'
      return null
    })()

    const inferredType = (() => {
      const direct = mappedValueForRow(row, (mapping as any)?.type)
      if (direct) return direct
      const inAmount = parseNumber(row?.[(mapping as any)?.inGross])
      if (inAmount != null && Math.abs(inAmount) > 0) return 'IN'
      const outAmount = parseNumber(row?.[(mapping as any)?.outGross])
      if (outAmount != null && Math.abs(outAmount) > 0) return 'OUT'
      return null
    })()

    return {
      date: toISODate(row?.[(mapping as any)?.date]),
      type: inferredType,
      paymentMethod: inferredPaymentMethod,
      description: mappedValueForRow(row, (mapping as any)?.description),
      category: mappedValueForRow(row, (mapping as any)?.category)
    }
  }

  async function openDuplicateComparison(row: Record<string, any>, rowNumber: number) {
    const candidates = duplicateCandidatesByRow[rowNumber] || []
    if (!candidates.length) return

    setDuplicateModalBusy(true)
    setDuplicateModalError('')
    setShowDuplicateModal(true)
    setDuplicateModalData({
      rowNumber,
      importRow: buildImportRowSnapshot(row),
      candidates,
      matchesByKey: {}
    })

    try {
      const res = await window.api?.imports?.duplicateDetails?.({
        pairs: candidates.map((candidate) => ({ date: candidate.date, grossAmount: candidate.grossAmount }))
      })
      setDuplicateModalData({
        rowNumber,
        importRow: buildImportRowSnapshot(row),
        candidates,
        matchesByKey: res?.matchesByKey || {}
      })
    } catch (e: any) {
      setDuplicateModalError(e?.message || String(e))
    } finally {
      setDuplicateModalBusy(false)
    }
  }

  function formatShortDate(v: any): string {
    const iso = toISODate(v)
    if (!iso) return String(v ?? '')
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    if (!m) return iso
    return `${m[3]}.${m[2]}.${m[1]}`
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!sample.length) {
        setDuplicateCountsByRow({})
        setDuplicateCandidatesByRow({})
        return
      }

      const dateHeader = (mapping as any)?.date as string | null
      if (!dateHeader) {
        setDuplicateCountsByRow({})
        setDuplicateCandidatesByRow({})
        return
      }

      const amountHeaders: Array<string | null> = [
        (mapping as any)?.grossAmount,
        (mapping as any)?.inGross,
        (mapping as any)?.outGross,
        (mapping as any)?.bankIn,
        (mapping as any)?.bankOut,
        (mapping as any)?.cashIn,
        (mapping as any)?.cashOut
      ]

      const activeAmountHeaders = amountHeaders.filter(Boolean) as string[]
      if (!activeAmountHeaders.length) {
        setDuplicateCountsByRow({})
        setDuplicateCandidatesByRow({})
        return
      }

      const pairs: Array<{ date: string; grossAmount: number }> = []
      const candidatesByRow: Record<number, string[]> = {}
      const candidateDetailsByRow: Record<number, DuplicateCandidate[]> = {}

      for (let i = 0; i < sample.length; i++) {
        const row = sample[i]
        const rowNumber = rowNumberForSampleIndex(i)
        const date = toISODate(row?.[dateHeader])
        if (!date) continue

        const keys: string[] = []
        for (const h of activeAmountHeaders) {
          const n = parseNumber(row?.[h])
          if (n == null) continue
          const amt = Math.abs(n)
          if (!amt) continue
          const key = duplicateKey(date, amt)
          keys.push(key)
          pairs.push({ date, grossAmount: amt })
          if (!candidateDetailsByRow[rowNumber]) candidateDetailsByRow[rowNumber] = []
          if (!candidateDetailsByRow[rowNumber].some((candidate) => duplicateKey(candidate.date, candidate.grossAmount) === key)) {
            candidateDetailsByRow[rowNumber].push({ date, grossAmount: amt, source: h })
          }
        }

        if (keys.length) candidatesByRow[rowNumber] = keys
      }

      if (!pairs.length) {
        setDuplicateCountsByRow({})
        setDuplicateCandidatesByRow({})
        return
      }

      try {
        const res = await window.api?.imports?.duplicates?.({ pairs })
        const countsByKey = (res?.countsByKey || {}) as Record<string, number>
        if (cancelled) return

        const next: Record<number, number> = {}
        for (const [rowNumberStr, keys] of Object.entries(candidatesByRow)) {
          const rowNumber = Number(rowNumberStr)
          let best = 0
          for (const k of keys) best = Math.max(best, Number(countsByKey[k] || 0))
          if (best > 0) next[rowNumber] = best
        }
        setDuplicateCountsByRow(next)
        setDuplicateCandidatesByRow(candidateDetailsByRow)
      } catch {
        if (!cancelled) {
          setDuplicateCountsByRow({})
          setDuplicateCandidatesByRow({})
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sample, mapping, rowNumberForSampleIndex])

  function bufferToBase64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
    }
    return btoa(binary)
  }

  async function processFile(f: File) {
    setError('')
    setResult(null)
    setImportAnalyze(null)
    setShowConfirmModal(false)
    setPendingImportOptions(null)
    setFileName(f.name)
    try {
      const buf = await f.arrayBuffer()
      const b64 = bufferToBase64(buf)
      setBase64(b64)
      setBusy(true)
      try {
        const prev = await window.api?.imports.preview?.({ fileBase64: b64 })
        if (prev) {
          setHeaders(prev.headers)
          setSample(prev.sample as any)
          setSampleRowNumbers(prev.sampleRowNumbers || [])
          setAllRowNumbers(prev.allRowNumbers || [])
          setTotalRows(prev.totalRows || 0)
          setMapping(prev.suggestedMapping)
          setHeaderRowIndex((prev as any).headerRowIndex ?? null)
        }
      } finally {
        setBusy(false)
      }
    } catch (e: any) {
      setError('Datei konnte nicht gelesen werden: ' + (e?.message || String(e)))
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    await processFile(f)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer?.files?.[0]
    if (f) processFile(f)
  }

  async function openImportConfirmation(options?: { createMissingCategories?: boolean }) {
    if (!base64) return
    setBusy(true)
    setError('')
    try {
      const analyze = await window.api?.imports.analyze?.({
        fileBase64: base64,
        mapping,
        options: {
          ...options,
          selectedRows: Array.from(selectedRows).sort((a, b) => a - b)
        }
      })
      if (analyze) {
        setImportAnalyze(analyze)
        setPendingImportOptions(options || {})
        setShowConfirmModal(true)
      }
    } catch (e: any) {
      setImportAnalyze(null)
      setError('Import-Vorschau fehlgeschlagen: ' + (e?.message || String(e)))
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!base64) return
    setShowConfirmModal(false)
    setBusy(true)
    try {
      const res = await window.api?.imports.execute?.({
        fileBase64: base64,
        mapping,
        options: {
          ...(pendingImportOptions || {}),
          selectedRows: Array.from(selectedRows).sort((a, b) => a - b)
        }
      })
      if (res) {
        setResult(res)
        window.dispatchEvent(new Event('data-changed'))
        if ((res.errors?.length || 0) > 0) {
          setShowErrorsModal(true)
          if (res.errorFilePath) {
            notify?.('info', `Fehler-Excel gespeichert: ${res.errorFilePath}`)
          }
        } else {
          notify?.('success', `Import abgeschlossen: ${res.imported} importiert, ${res.skipped} übersprungen`)
        }
      }
    } catch (e: any) {
      setResult(null)
      setError('Import fehlgeschlagen: ' + (e?.message || String(e)))
    } finally {
      setBusy(false)
      setPendingImportOptions(null)
    }
  }

  async function onImport() {
    setError('')
    if (!base64) {
      setError('Bitte zuerst eine XLSX-Datei auswählen.')
      return
    }

    try {
      if ((mapping as any)?.category && !(String((mapping as any)?.category || '').startsWith(CONST_MAPPING_PREFIX))) {
        const check = await window.api?.imports?.missingCategories?.({ fileBase64: base64, mapping })
        const missingNames = (check?.missingNames || []) as string[]
        const missingIds = (check?.missingIds || []) as number[]
        const nameCounts = (check?.missingNameCounts || {}) as Record<string, number>

        if (missingIds.length > 0) {
          setError(
            `Kategorie-ID(s) nicht gefunden: ${missingIds.join(', ')}. Bitte Datei/Zuordnung korrigieren oder Kategorie-ID entfernen.`
          )
          return
        }

        if (missingNames.length > 0) {
          setMissingCats({
            names: missingNames.map((n) => ({ name: n, count: Number(nameCounts[n] || 0) || 0 }))
          })
          setShowMissingCatsModal(true)
          return
        }
      }
    } catch (e: any) {
      console.warn('missingCategories check failed', e)
    }

    await openImportConfirmation()
  }

  async function runImportWithAutoCreateCategories() {
    setShowMissingCatsModal(false)
    await openImportConfirmation({ createMissingCategories: true })
    setMissingCats(null)
  }

  const allPreviewRows = useMemo(() => {
    if (sampleRowNumbers.length) return sampleRowNumbers
    const rows: number[] = []
    for (let i = 0; i < sample.length; i++) rows.push(rowNumberForSampleIndex(i))
    return rows
  }, [sample.length, rowNumberForSampleIndex, sampleRowNumbers])

  const allSelected = allPreviewRows.length > 0 && allPreviewRows.every((r) => selectedRows.has(r))
  const anySelected = allPreviewRows.some((r) => selectedRows.has(r))

  const fieldKeys: Array<{ key: string; label: string; required?: boolean; enumValues?: string[] }> = [
    { key: 'date', label: 'Datum', required: true },
    { key: 'type', label: 'Art (IN/OUT/TRANSFER)' },
    { key: 'description', label: 'Beschreibung' },
    { key: 'paymentMethod', label: 'Zahlweg (BAR/BANK)' },
    { key: 'netAmount', label: 'Netto' },
    { key: 'vatRate', label: 'Umsatzsteuersatz in Prozent' },
    { key: 'grossAmount', label: 'Brutto' },
    { key: 'inGross', label: 'Einnahmen (Brutto)' },
    { key: 'outGross', label: 'Ausgaben (Brutto)' },
    { key: 'earmarkCode', label: 'Zweckbindung-Code' },
    { key: 'category', label: 'Kategorie (Name oder ID)' },
    { key: 'bankIn', label: 'Bankkonto + (Einnahmen)' },
    { key: 'bankOut', label: 'Bankkonto - (Ausgaben)' },
    { key: 'cashIn', label: 'Barkonto + (Einnahmen)' },
    { key: 'cashOut', label: 'Barkonto - (Ausgaben)' }
  ]

  const fixedValueOptions: Record<string, Array<{ label: string; value: string }>> = {
    type: [
      { label: 'Fester Wert: IN', value: `${CONST_MAPPING_PREFIX}IN` },
      { label: 'Fester Wert: OUT', value: `${CONST_MAPPING_PREFIX}OUT` },
      { label: 'Fester Wert: TRANSFER', value: `${CONST_MAPPING_PREFIX}TRANSFER` }
    ],
    paymentMethod: [
      { label: 'Fester Wert: BANK', value: `${CONST_MAPPING_PREFIX}BANK` },
      { label: 'Fester Wert: BAR', value: `${CONST_MAPPING_PREFIX}BAR` }
    ]
  }

  function setHeaderMapping(fieldKey: string, nextValue: string | null) {
    setMapping((prev) => {
      const next = { ...prev }

      if (nextValue) {
        for (const key of IMPORT_MAPPING_KEYS) {
          if (next[key] === nextValue) next[key] = null
        }
      }

      next[fieldKey] = nextValue
      return next
    })
  }

  function setMappingByHeader(header: string, fieldKey: string) {
    setMapping((prev) => {
      const next = { ...prev }

      for (const key of IMPORT_MAPPING_KEYS) {
        if (next[key] === header) next[key] = null
      }

      if (fieldKey) next[fieldKey] = header
      return next
    })
  }

  function getMappedFieldForHeader(header: string) {
    return fieldKeys.find((field) => mapping[field.key] === header) || null
  }

  // Helper to render a single mapping field with label and select
  const Field = ({ keyName, tooltip }: { keyName: string; tooltip?: string }) => {
    const f = fieldKeys.find((k) => k.key === keyName)!
    const current = mapping[f.key] || ''
    const requiredMark = f.required ? ' *' : ''
    const fixedOptions = fixedValueOptions[f.key] || []
    return (
      <label key={f.key} title={tooltip} className="field-row">
        <span className="field-label">
          {f.label}
          {requiredMark}
        </span>
        <select
          className="input"
          value={current}
          onChange={(e) => setHeaderMapping(f.key, e.target.value || null)}
        >
          <option value="">— nicht zuordnen —</option>
          {fixedOptions.length > 0 && (
            <optgroup label="Fester Wert">
              {fixedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Spalte aus Datei">
            {headers.map((h) => (
              <option key={h} value={h}>
                {h || '(leer)'}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    )
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xml" hidden onChange={onPickFile} />
      <div
        className="input import-dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={onDrop}
        style={{
          marginTop: 4,
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderRadius: 12
        }}
        title="Datei hier ablegen oder auswählen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>
            Datei auswählen
          </button>
          <span className="helper">{fileName || 'Keine ausgewählt'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={async () => {
              try {
                const res = await window.api?.imports.template?.()
                if (res?.filePath) {
                  setError('')
                  setResult(null)
                  if (notify) {
                    notify('success', `Vorlage gespeichert: ${res.filePath}`, 5000, {
                      label: 'Ordner öffnen',
                      onClick: () => window.api?.shell?.showItemInFolder?.(res.filePath)
                    })
                  }
                }
              } catch (e: any) {
                const msg = e?.message || String(e)
                if (msg && /abbruch/i.test(msg)) return
                setError('Vorlage konnte nicht erstellt werden: ' + msg)
                notify?.('error', 'Vorlage konnte nicht erstellt werden: ' + msg)
              }
            }}
          >
            Vorlage herunterladen
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                const res = await window.api?.imports.testdata?.()
                if (res?.filePath) {
                  setError('')
                  setResult(null)
                  if (notify) {
                    notify('success', `Testdatei gespeichert: ${res.filePath}`, 5000, {
                      label: 'Ordner öffnen',
                      onClick: () => window.api?.shell?.showItemInFolder?.(res.filePath)
                    })
                  }
                }
              } catch (e: any) {
                const msg = e?.message || String(e)
                if (msg && /abbruch/i.test(msg)) return
                setError('Testdatei konnte nicht erstellt werden: ' + msg)
                notify?.('error', 'Testdatei konnte nicht erstellt werden: ' + msg)
              }
            }}
          >
            Testdatei erzeugen
          </button>
          {/* Import-Button wandert nach unten, erscheint erst nach geladener Vorschau */}
        </div>
      </div>
      {busy && <div style={{ marginTop: 8 }}>Lade …</div>}
      {error && <div style={{ marginTop: 8, color: 'var(--danger)' }}>{error}</div>}
      {headers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="import-mapping-header">
            <strong>Zuordnung</strong>
            <div className="import-preset-flyout" ref={presetFlyoutRef}>
              <button
                type="button"
                className={`btn import-preset-flyout__trigger${showPresetFlyout ? ' is-open' : ''}`}
                onClick={() => {
                  setShowPresetFlyout((open) => !open)
                  setPresetDeleteArmed(false)
                }}
                aria-haspopup="dialog"
                aria-expanded={showPresetFlyout}
              >
                <span>Vorlagen</span>
                <span className="import-preset-flyout__trigger-meta">
                  {activePreset?.name || (mappingPresets.length ? `${mappingPresets.length} gespeichert` : 'noch leer')}
                </span>
              </button>
              {showPresetFlyout && (
                <div className="import-preset-flyout__panel flyout-popover" role="dialog" aria-modal="false">
                  <div className="flyout-arrow import-preset-flyout__arrow" />
                  <div className="import-preset-flyout__header">
                    <div>
                      <div className="import-preset-flyout__title">Import-Vorlagen</div>
                      <div className="import-preset-flyout__subtitle">
                        Speichert die aktuelle Zuordnung inklusive fixer Werte wie OUT oder BANK.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn import-preset-flyout__close"
                      onClick={() => {
                        setShowPresetFlyout(false)
                        setPresetDeleteArmed(false)
                      }}
                      aria-label="Vorlagen-Flyout schließen"
                    >
                      Schließen
                    </button>
                  </div>

                  <div className="import-preset-flyout__section">
                    <div className="import-preset-flyout__section-label">Gespeicherte Vorlagen</div>
                    {mappingPresets.length > 0 ? (
                      <div className="import-preset-flyout__list">
                        {mappingPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={`import-preset-flyout__list-item${preset.id === activePresetId ? ' is-active' : ''}`}
                            onClick={() => applyPreset(preset.id)}
                          >
                            <span className="import-preset-flyout__list-name">{preset.name}</span>
                            <span className="import-preset-flyout__list-meta">
                              {preset.updatedAt ? `Zuletzt: ${presetDateFmt.format(new Date(preset.updatedAt))}` : 'Noch nicht datiert'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="import-preset-flyout__empty">
                        Noch keine Vorlagen gespeichert. Lege rechts unten deine erste Zuordnung an.
                      </div>
                    )}
                  </div>

                  <div className="import-preset-flyout__section">
                    <label className="field-row import-preset-flyout__field">
                      <span className="field-label">Name der aktuellen Vorlage</span>
                      <input
                        className="input"
                        value={presetDraftName}
                        onChange={(e) => setPresetDraftName(e.target.value)}
                        placeholder="z. B. Etat 2026 Verwaltung"
                      />
                    </label>
                    <div className="import-preset-flyout__hint">
                      Beim Speichern mit einem vorhandenen Namen wird diese Vorlage direkt aktualisiert.
                    </div>
                    <label className="import-preset-flyout__toggle">
                      <input
                        type="checkbox"
                        checked={deselectDuplicatesByDefault}
                        onChange={(e) => setDeselectDuplicatesByDefault(e.target.checked)}
                      />
                      <span>
                        Dopplungen standardmäßig deselektieren
                        <span className="import-preset-flyout__toggle-meta">
                          Zeilen mit erkanntem Dubletten-Hinweis werden beim Laden der Vorschau automatisch abgewählt.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="import-preset-flyout__actions">
                    <button className="btn primary" type="button" onClick={savePresetAsNew}>
                      Speichern
                    </button>
                    <button className="btn" type="button" onClick={overwriteActivePreset} disabled={!activePresetId}>
                      Aktive aktualisieren
                    </button>
                    <button
                      className={`btn import-preset-flyout__delete${presetDeleteArmed ? ' is-armed' : ''}`}
                      type="button"
                      onClick={deleteActivePreset}
                      disabled={!activePresetId}
                    >
                      {presetDeleteArmed ? 'Löschen bestätigen' : 'Aktive löschen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="helper" style={{ marginTop: 6 }}>
            Öffne rechts die Vorlagenverwaltung, um gespeicherte Zuordnungen zu laden oder die aktuelle Konfiguration als Vorlage abzulegen.
          </div>
          <div className="helper" style={{ marginTop: 6 }}>
            Direkt in der Vorschau kannst du jede erkannte Spalte ebenfalls umhängen. Feste Werte wie OUT oder BANK setzt du weiterhin hier oben.
          </div>
          <div className="helper" style={{ marginTop: 6 }}>
            <ul style={{ margin: '4px 0 0 16px' }}>
              <li>Beste Lesbarkeit: Kopfzeile in Zeile 1, Daten ab Zeile 2 (erkannte Kopfzeile: Zeile {headerRowIndex || 1}).</li>
              <li>Keine zusammengeführten Zellen oder Leerzeilen im Kopfbereich.</li>
              <li>Ein Datensatz pro Zeile. Summen-/Saldo-Zeilen werden automatisch ignoriert.</li>
              <li>Mindestens Datum und ein Betrag (Brutto oder Netto+USt). Optional: Art (IN/OUT/TRANSFER), Kategorie, Zweckbindung, Zahlweg.</li>
              <li>Tipp: Nutze "Vorlage herunterladen" bzw. "Testdatei erzeugen" als Referenz.</li>
            </ul>
          </div>
          <div className="helper">Ordne die Felder den Spaltenüberschriften deiner Datei zu.</div>
          <div className="group-grid" style={{ marginTop: 8 }}>
            <div className="field-group fg-meta">
              <div className="group-title">📋 Basisdaten</div>
              <Field keyName="date" tooltip="Datum der Buchung" />
              <Field keyName="description" tooltip="Beschreibung / Verwendungszweck" />
              <Field
                keyName="type"
                tooltip="Art der Buchung: Einnahme (IN), Ausgabe (OUT), Umbuchung (TRANSFER)"
              />
              <Field keyName="earmarkCode" tooltip="Zweckbindung als Code/Abkürzung" />
              <Field keyName="category" tooltip="Kategorie (Name oder ID)" />
            </div>
            <div className="field-group fg-amounts">
              <div className="group-title">💶 Beträge</div>
              <Field keyName="netAmount" tooltip="Netto-Betrag" />
              <Field keyName="vatRate" tooltip="Umsatzsteuersatz in Prozent" />
              <Field keyName="grossAmount" tooltip="Brutto-Betrag" />
              <Field keyName="inGross" tooltip="Einnahmen (Brutto) — alternative Spalte" />
              <Field keyName="outGross" tooltip="Ausgaben (Brutto) — alternative Spalte" />
            </div>
            <div className="field-group fg-payment">
              <div className="group-title">💳 Zahlungsart</div>
              <Field keyName="paymentMethod" tooltip="Zahlweg: BAR oder BANK" />
            </div>
            <div className="field-group fg-accounts">
              <div className="group-title">🏪 Kontenspalten</div>
              <Field keyName="bankIn" tooltip="Bankkonto Einnahmen (+)" />
              <Field keyName="bankOut" tooltip="Bankkonto Ausgaben (-)" />
              <Field keyName="cashIn" tooltip="Barkonto Einnahmen (+)" />
              <Field keyName="cashOut" tooltip="Barkonto Ausgaben (-)" />
            </div>
          </div>
          <details className="mapping-summary" style={{ marginTop: 8 }}>
            <summary>Zuordnungsübersicht</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {fieldKeys.map((f) => (
                <div key={f.key} className="pair">
                  <span className="k">{f.label}</span>
                  <span className="v">{mapping[f.key] || '—'}</span>
                </div>
              ))}
            </div>
          </details>
          <div className="helper" style={{ marginTop: 6 }}>
            Hinweise:
            <ul style={{ margin: '4px 0 0 16px' }}>
              <li>
                Entweder Netto+USt oder Brutto muss zugeordnet sein — oder nutze die vier Spalten
                Bankkonto+/-, Barkonto+/-. Bei letzteren werden automatisch mehrere Buchungen je Zeile
                erzeugt.
              </li>
              <li>
                Summenzeilen wie "Ergebnis/Summe/Saldo" werden automatisch übersprungen.
              </li>
              <li>
                Für Dateien ohne eigene Art-/Zahlweg-Spalte kannst du bei der Zuordnung feste Werte wie OUT oder BANK wählen.
              </li>
            </ul>
          </div>
        </div>
      )}
      {/* Bottom-only Import button, shown once headers/preview are available */}
      {headers.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary" onClick={onImport} disabled={!base64 || busy}>
            Import starten
          </button>
        </div>
      )}
      {sample.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Vorschau (erste 50 Datenzeilen)</strong>
          <div className="helper" style={{ marginTop: 4 }}>
            {totalRows > 0 ? `${Math.min(sample.length, 50)} von ${totalRows} Datenzeilen sichtbar.` : `${sample.length} Datenzeilen sichtbar.`}{' '}
            {deselectDuplicatesByDefault
              ? 'Dubletten sind standardmäßig abgewählt und können pro Zeile wieder aktiviert werden.'
              : `Standardmäßig sind alle ${allRowNumbers.length || sample.length} importierbaren Zeilen ausgewählt.`}
          </div>
          <div className="import-preview-table-wrap" style={{ overflowX: 'auto', marginTop: 6 }}>
            <table className="import-preview-table" cellPadding={0}>
              <thead>
                <tr>
                  <th align="left" style={{ width: 92 }}>
                    <label className="inline-field">
                      <input
                        type="checkbox"
                        aria-label="Alle Zeilen (Vorschau) auswählen"
                        checked={allSelected}
                        ref={(el) => {
                          if (!el) return
                          el.indeterminate = anySelected && !allSelected
                        }}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSelectedRows(() => {
                            if (!checked) return new Set()
                            return new Set(allPreviewRows)
                          })
                        }}
                      />
                      <span className="helper">Import</span>
                    </label>
                  </th>
                  {headers.map((h, headerIndex) => {
                    const mappedField = getMappedFieldForHeader(h)
                    return (
                    <th key={`${h}-${headerIndex}`} align="left" className="import-preview-table__head-cell">
                      <div className="import-preview-table__head-title">{h || '(leer)'}</div>
                      <select
                        className="input import-preview-table__mapping-select"
                        value={mappedField?.key || ''}
                        onChange={(e) => setMappingByHeader(h, e.target.value)}
                        aria-label={`Zuordnung für Spalte ${h || '(leer)'} ändern`}
                      >
                        <option value="">Nicht zugeordnet</option>
                        {fieldKeys.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}{field.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </th>
                  )})}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => {
                  const rowNumber = rowNumberForSampleIndex(i)
                  const isSelected = selectedRows.has(rowNumber)
                  const dupCount = duplicateCountsByRow[rowNumber] || 0
                  const dateHeader = (mapping as any)?.date as string | null

                  // If we have a recent result, color-code by status: green for imported, dim/red for skipped/errors.
                  const st = result?.rowStatuses?.find(
                    (rs) => rs.row === rowNumber
                  )
                  const bg = st
                    ? st.ok
                      ? 'color-mix(in oklab, var(--success) 12%, transparent)'
                      : 'color-mix(in oklab, var(--danger) 10%, transparent)'
                    : isSelected
                      ? 'color-mix(in oklab, var(--success) 8%, transparent)'
                      : 'color-mix(in oklab, var(--danger) 8%, transparent)'
                  const title = st?.message
                  return (
                    <tr key={i} style={{ background: bg }} title={title}>
                      <td>
                        <label className="inline-field">
                          <input
                            type="checkbox"
                            aria-label={`Zeile ${rowNumber} importieren`}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRows((prev) => {
                                const next = new Set(prev)
                                if (next.has(rowNumber)) next.delete(rowNumber)
                                else next.add(rowNumber)
                                return next
                              })
                            }}
                          />
                          <span className="helper">{rowNumber}</span>
                          {dupCount > 0 && (
                            <button
                              type="button"
                              className="import-dup-hint"
                              title={`Mögliche Duplikate prüfen: ${dupCount} bestehende Buchung(en) mit gleichem Datum + Bruttosumme`}
                              aria-label={`Duplikat-Hinweis: ${dupCount} Treffer`}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void openDuplicateComparison(row, rowNumber)
                              }}
                            >
                              ⧉ {dupCount}
                            </button>
                          )}
                        </label>
                      </td>
                      {headers.map((h) => (
                        <td key={h}>
                          {h && dateHeader && h === dateHeader ? formatShortDate(row[h]) : String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {result && (
        <div className="card" style={{ marginTop: 8, padding: 10 }}>
          <strong>Ergebnis</strong>
          <div className="helper">
            Importiert: {result.imported} | Übersprungen: {result.skipped}
          </div>
          {result.errorFilePath && (
            <div style={{ marginTop: 6 }}>
              <div className="helper">Fehler-Datei gespeichert:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <code style={{ userSelect: 'all' }}>{result.errorFilePath}</code>
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(result.errorFilePath || '')
                    notify?.('info', 'Pfad in Zwischenablage kopiert')
                  }}
                >
                  Pfad kopieren
                </button>
              </div>
            </div>
          )}
          {result.errors?.length ? (
            <details style={{ marginTop: 6 }}>
              <summary>Fehlerdetails anzeigen ({result.errors.length})</summary>
              <ul style={{ marginTop: 6 }}>
                {result.errors.slice(0, 20).map((e, idx) => (
                  <li key={idx}>
                    Zeile {e.row}: {e.message}
                  </li>
                ))}
                {result.errors.length > 20 && <li>… weitere {result.errors.length - 20} Fehler</li>}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {showMissingCatsModal &&
        missingCats &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowMissingCatsModal(false)}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 10000 }}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <h2 style={{ margin: 0 }}>Fehlende Kategorien</h2>
                <button className="btn danger" onClick={() => setShowMissingCatsModal(false)}>
                  Schließen
                </button>
              </header>
              <div className="helper">
                In der Importdatei sind Kategorien enthalten, die in BudgetO noch nicht existieren.
                Soll BudgetO diese Kategorien automatisch anlegen und dann importieren?
              </div>
              <div
                style={{
                  marginTop: 10,
                  maxHeight: 260,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 8
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {missingCats.names.map((n) => (
                    <li key={n.name}>
                      {n.name}
                      {n.count > 1 ? ` (x${n.count})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="helper" style={{ marginTop: 10 }}>
                Hinweis: Wenn du nicht automatisch anlegen möchtest, entferne die Kategorie-Zuordnung oder
                lege die Kategorien vorher unter Einstellungen → Kategorien an.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => setShowMissingCatsModal(false)} disabled={busy}>
                  Abbrechen
                </button>
                <button
                  className="btn primary"
                  onClick={runImportWithAutoCreateCategories}
                  disabled={busy}
                >
                  Kategorien anlegen & Import starten
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showDuplicateModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => {
              setShowDuplicateModal(false)
              setDuplicateModalError('')
            }}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 10000 }}
          >
            <div className="modal import-duplicate-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1080 }}>
              <header className="import-duplicate-modal__header">
                <div>
                  <h2 style={{ margin: 0 }}>Dublettenvergleich für Zeile {duplicateModalData?.rowNumber}</h2>
                  <div className="helper" style={{ marginTop: 4 }}>
                    Importzeile und passende Journalbuchungen werden nach Datum und Bruttobetrag direkt nebeneinandergestellt.
                  </div>
                </div>
                <button
                  className="btn danger"
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setDuplicateModalError('')
                  }}
                >
                  Schließen
                </button>
              </header>

              {duplicateModalBusy && <div style={{ marginTop: 8 }}>Lade Vergleich …</div>}
              {duplicateModalError && <div style={{ marginTop: 8, color: 'var(--danger)' }}>{duplicateModalError}</div>}

              {duplicateModalData && (
                <div className="import-duplicate-modal__content">
                  <section className="import-duplicate-modal__import-card">
                    <div className="import-duplicate-modal__section-title">Import-Zeile</div>
                    <div className="import-duplicate-modal__grid">
                      <div className="pair"><span className="k">Datum</span><span className="v">{duplicateModalData.importRow.date ? formatShortDate(duplicateModalData.importRow.date) : '—'}</span></div>
                      <div className="pair"><span className="k">Art</span><span className="v">{duplicateModalData.importRow.type || '—'}</span></div>
                      <div className="pair"><span className="k">Zahlweg</span><span className="v">{duplicateModalData.importRow.paymentMethod || '—'}</span></div>
                      <div className="pair"><span className="k">Kategorie</span><span className="v">{duplicateModalData.importRow.category || '—'}</span></div>
                      <div className="pair pair--wide"><span className="k">Beschreibung</span><span className="v">{duplicateModalData.importRow.description || '—'}</span></div>
                    </div>
                    <div className="import-duplicate-modal__candidate-list">
                      {duplicateModalData.candidates.map((candidate) => (
                        <div key={`${candidate.source}-${candidate.date}-${candidate.grossAmount}`} className="import-duplicate-modal__candidate-chip">
                          <span>{candidate.source}</span>
                          <strong>{formatShortDate(candidate.date)} · {amountFmt.format(candidate.grossAmount)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="import-duplicate-modal__matches">
                    {duplicateModalData.candidates.map((candidate) => {
                      const key = duplicateKey(candidate.date, candidate.grossAmount)
                      const matches = duplicateModalData.matchesByKey[key] || []
                      return (
                        <div key={key} className="import-duplicate-modal__match-group">
                          <div className="import-duplicate-modal__section-title">
                            Journaltreffer für {candidate.source}: {formatShortDate(candidate.date)} · {amountFmt.format(candidate.grossAmount)}
                          </div>
                          {matches.length > 0 ? (
                            <div className="import-duplicate-modal__match-list">
                              {matches.map((match) => (
                                <article key={match.id} className="import-duplicate-modal__match-card">
                                  <div className="import-duplicate-modal__match-topline">
                                    <strong>{match.voucherNo || `#${match.id}`}</strong>
                                    <span>{formatShortDate(match.date)}</span>
                                  </div>
                                  <div className="import-duplicate-modal__grid">
                                    <div className="pair"><span className="k">Art</span><span className="v">{match.type}</span></div>
                                    <div className="pair"><span className="k">Zahlweg</span><span className="v">{match.paymentMethod || '—'}</span></div>
                                    <div className="pair"><span className="k">Brutto</span><span className="v">{amountFmt.format(match.grossAmount)}</span></div>
                                    <div className="pair"><span className="k">Netto</span><span className="v">{match.netAmount != null ? amountFmt.format(match.netAmount) : '—'}</span></div>
                                    <div className="pair"><span className="k">Kategorie</span><span className="v">{match.categoryName || '—'}</span></div>
                                    <div className="pair"><span className="k">Zweckbindung</span><span className="v">{match.earmarkCode || '—'}</span></div>
                                    <div className="pair"><span className="k">Budget</span><span className="v">{match.budgetLabel || '—'}</span></div>
                                    <div className="pair"><span className="k">Gegenpartei</span><span className="v">{match.counterparty || '—'}</span></div>
                                    <div className="pair pair--wide"><span className="k">Beschreibung</span><span className="v">{match.description || '—'}</span></div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="import-duplicate-modal__empty">Keine Journalbuchung mit exakt diesem Datum und Bruttobetrag gefunden.</div>
                          )}
                        </div>
                      )
                    })}
                  </section>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {showConfirmModal &&
        importAnalyze &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowConfirmModal(false)}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 10000 }}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980, width: 'min(980px, 96vw)' }}>
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <h2 style={{ margin: 0 }}>Import bestätigen</h2>
                <button className="btn danger" onClick={() => setShowConfirmModal(false)}>
                  Schließen
                </button>
              </header>

              <div className="helper">
                Bitte prüfe vor dem Import, wie BudgetO die ausgewählten Zeilen verbucht.
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <span className="badge">Zeilen geprüft: {importAnalyze.summary.totalRows}</span>
                <span className="badge">Importierbar: {importAnalyze.summary.readyRows}</span>
                <span className="badge">Geplante Buchungen: {importAnalyze.summary.plannedEntries}</span>
                <span className="badge">Übersprungen: {importAnalyze.summary.skippedRows}</span>
                <span className="badge" style={{ color: importAnalyze.summary.errorRows > 0 ? 'var(--danger)' : undefined }}>Fehler: {importAnalyze.summary.errorRows}</span>
              </div>

              <div style={{ marginTop: 12, maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                <table cellPadding={6} style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th align="left">Excel-Zeile</th>
                      <th align="left">Status</th>
                      <th align="left">Datum</th>
                      <th align="left">Art</th>
                      <th align="left">Zahlweg</th>
                      <th align="left">Beschreibung</th>
                      <th align="right">Betrag</th>
                      <th align="left">Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importAnalyze.rows.flatMap((row) => {
                      if (row.entries.length === 0) {
                        return [
                          <tr key={`${row.row}:empty`}>
                            <td>{row.row}</td>
                            <td>{row.status}</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td align="right">—</td>
                            <td style={{ color: row.status === 'error' ? 'var(--danger)' : 'var(--text-dim)' }}>{row.message || '—'}</td>
                          </tr>
                        ]
                      }

                      return row.entries.map((entry, index) => (
                        <tr key={`${row.row}:${index}`}>
                          <td>{row.row}</td>
                          <td>{row.status}</td>
                          <td>{formatShortDate(entry.date)}</td>
                          <td>{entry.type}</td>
                          <td>{entry.paymentMethod || '—'}</td>
                          <td>{entry.description || '—'}</td>
                          <td align="right" style={{ color: entry.signedGrossAmount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {amountFmt.format(entry.signedGrossAmount)}
                          </td>
                          <td style={{ color: row.status === 'error' ? 'var(--danger)' : 'var(--text-dim)' }}>{index === 0 ? (row.message || '—') : '—'}</td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>

              <div className="helper" style={{ marginTop: 10 }}>
                OUT-Buchungen werden hier mit negativem Vorzeichen dargestellt, damit die spätere Verbuchung klar nachvollziehbar ist.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => setShowConfirmModal(false)} disabled={busy}>
                  Abbrechen
                </button>
                <button
                  className="btn primary"
                  onClick={confirmImport}
                  disabled={busy || importAnalyze.summary.plannedEntries <= 0}
                >
                  Import jetzt ausführen
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showErrorsModal &&
        result &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowErrorsModal(false)}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 10000 }}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <h2 style={{ margin: 0 }}>
                  Import abgeschlossen — einige Zeilen konnten nicht übernommen werden
                </h2>
                <button className="btn danger" onClick={() => setShowErrorsModal(false)}>
                  Schließen
                </button>
              </header>
              <div className="helper">
                Importiert: {result.imported} | Übersprungen: {result.skipped} | Fehler:{' '}
                {result.errors?.length || 0}
              </div>
              {result.errorFilePath && (
                <div style={{ marginTop: 8 }}>
                  <div className="helper">
                    Die fehlgeschlagenen Zeilen wurden als Excel gespeichert unter:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <code style={{ userSelect: 'all' }}>{result.errorFilePath}</code>
                    <button
                      className="btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(result.errorFilePath || '')
                        notify?.('info', 'Pfad in Zwischenablage kopiert')
                      }}
                    >
                      Pfad kopieren
                    </button>
                  </div>
                </div>
              )}
              {(result.errors?.length || 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Fehlerhafte Zeilen</strong>
                  <ul style={{ marginTop: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {result.errors.slice(0, 50).map((e, idx) => (
                      <li key={idx}>
                        Zeile {e.row}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 50 && (
                      <li>
                        … weitere {result.errors.length - 50} Fehler — siehe gespeicherte Excel-Datei
                      </li>
                    )}
                  </ul>
                  <div className="helper" style={{ marginTop: 6 }}>
                    Bitte prüfe die gelisteten Zeilen und trage die Datensätze bei Bedarf manuell nach.
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => setShowErrorsModal(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
