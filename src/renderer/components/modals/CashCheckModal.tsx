import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type BudgetRow = {
  id: number
  year: number
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  name?: string | null
  categoryName?: string | null
  projectName?: string | null
  startDate?: string | null
  endDate?: string | null
  isArchived?: number | null
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function parseMoney(text: string): number {
  const raw = String(text || '').trim().replace(/\s/g, '')
  let cleaned = raw
  // If both separators are used, assume German format: '.' thousands and ',' decimals.
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function budgetLabel(b: BudgetRow): string {
  const parts: string[] = []
  parts.push(String(b.year))
  parts.push(b.sphere)
  const name = (b.name || b.categoryName || b.projectName || '').trim()
  if (name) parts.push(name)
  return parts.join(' · ')
}

export default function CashCheckModal(props: {
  year: number
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number, action?: { label: string; onClick: () => void }) => void
  onCreated: () => void
  onClose: () => void
}) {
  const eurFmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  const todayISO = new Date().toISOString().slice(0, 10)
  const initialDate = todayISO.startsWith(String(props.year)) ? todayISO : `${props.year}-12-31`

  const [date, setDate] = useState<string>(initialDate)
  const [loadingSoll, setLoadingSoll] = useState(false)
  const [soll, setSoll] = useState<number>(0)
  const [istText, setIstText] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [budgetId, setBudgetId] = useState<number | null>(null)
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [saving, setSaving] = useState(false)

  const ist = useMemo(() => {
    if (!istText.trim()) return NaN
    return parseMoney(istText)
  }, [istText])

  const diff = useMemo(() => {
    if (!Number.isFinite(ist)) return NaN
    return round2(ist - soll)
  }, [ist, soll])

  useEffect(() => {
    let cancelled = false
    setLoadingBudgets(true)
    ;(async () => {
      try {
        const res = await window.api.budgets.list({ year: props.year, includeArchived: false })
        if (cancelled) return
        const rows = ((res as any)?.rows || []) as BudgetRow[]
        setBudgets(rows.filter((b) => (b as any)?.isArchived ? false : true))
      } catch {
        if (!cancelled) setBudgets([])
      } finally {
        if (!cancelled) setLoadingBudgets(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.year])

  useEffect(() => {
    let cancelled = false
    setLoadingSoll(true)
    ;(async () => {
      try {
        const res = await window.api.reports.cashBalance({ to: date })
        if (cancelled) return
        const bar = Number((res as any)?.BAR || 0)
        setSoll(round2(bar))
      } catch {
        if (!cancelled) setSoll(0)
      } finally {
        if (!cancelled) setLoadingSoll(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') props.onClose()
  }

  async function save() {
    if (!date) {
      props.notify('error', 'Bitte ein Datum auswählen.')
      return
    }
    if (!Number.isFinite(ist)) {
      props.notify('error', 'Bitte einen gültigen Ist-Bestand eingeben.')
      return
    }

    const diffVal = round2(ist - soll)

    setSaving(true)
    try {
      let voucherId: number | null = null

      if (diffVal !== 0) {
        const type = diffVal > 0 ? 'IN' : 'OUT'
        const gross = Math.abs(diffVal)
        const desc = `Kassenprüfung ${date} – Ausgleich`

        const v = await window.api.vouchers.create({
          date,
          type,
          sphere: 'VERMOEGEN',
          description: desc,
          grossAmount: gross,
          vatRate: 0,
          paymentMethod: 'BAR',
          budgetId: budgetId ?? undefined
        })
        voucherId = Number((v as any)?.id)
      }

      await window.api.cashChecks.create({
        year: props.year,
        date,
        soll,
        ist,
        diff: diffVal,
        voucherId,
        budgetId,
        note: note.trim() ? note.trim() : null
      })

      props.notify('success', 'Kassenprüfung gespeichert')
      props.onCreated()
      props.onClose()
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      props.notify('error', String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-check-modal-title"
        style={{ maxWidth: 720 }}
      >
        <header className="flex justify-between items-center mb-12">
          <h2 id="cash-check-modal-title" style={{ margin: 0 }}>
            + Neue Kassenprüfung
          </h2>
          <button className="btn icon-btn" onClick={props.onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 160 }}>
              <label>Stichtag</label>
              <input
                className="input"
                type="date"
                value={date}
                min={`${props.year}-01-01`}
                max={`${props.year}-12-31`}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label>Soll-Bestand (BAR)</label>
              <input className="input" value={loadingSoll ? 'Laden…' : eurFmt.format(soll)} readOnly />
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label>Ist-Bestand (gezählt)</label>
              <input
                className="input"
                value={istText}
                onChange={(e) => setIstText(e.target.value)}
                inputMode="decimal"
                placeholder="z. B. 123,45"
                autoFocus
              />
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label>Differenz</label>
              <input
                className="input"
                value={!Number.isFinite(diff) ? '—' : eurFmt.format(diff)}
                readOnly
                style={{
                  color: Number.isFinite(diff) ? (diff === 0 ? 'var(--text)' : diff > 0 ? 'var(--success)' : 'var(--danger)') : undefined,
                  fontWeight: 600
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div className="field">
              <label>Budget (optional)</label>
              <select
                className="input"
                value={(budgetId ?? '') as any}
                onChange={(e) => setBudgetId(e.target.value ? Number(e.target.value) : null)}
                aria-label="Budget auswählen"
              >
                <option value="">—</option>
                {loadingBudgets ? <option value="" disabled>Laden…</option> : null}
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {budgetLabel(b)}
                  </option>
                ))}
              </select>
              <div className="helper">Wird bei der Ausgleichsbuchung mitgeführt (falls Differenz ≠ 0).</div>
            </div>

            <div className="field">
              <label>Notiz (optional)</label>
              <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Bemerkungen zur Kassenprüfung" />
            </div>

            <div className="helper">
              Bei einer Differenz wird automatisch eine Ausgleichsbuchung (BAR) erstellt.
            </div>
          </div>

          <div className="flex justify-end gap-8">
            <button className="btn" onClick={props.onClose} disabled={saving}>
              Abbrechen
            </button>
            <button className="btn primary" onClick={save} disabled={saving || loadingSoll}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
