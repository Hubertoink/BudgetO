import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TagsEditor from '../TagsEditor'
import { IconDraft, IconPause, IconPlay, IconSkip } from '../../utils/icons'
import { ICONS } from '../../utils/icons.constants'

type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type RecurringBooking = {
  id: number
  name: string
  frequency: Frequency
  intervalCount: number
  nextDueDate: string
  endDate: string | null
  isActive: boolean
  isDue: boolean
  template: {
    type: 'IN' | 'OUT'
    sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    description: string
    grossAmount: number
    vatRate: number
    paymentMethod: 'BAR' | 'BANK'
    categoryId?: number | null
    budgetId?: number | null
    earmarkId?: number | null
    tags?: string[]
    taxonomySelectionById?: Record<string, number>
  }
  createdAt: string
}

type FormState = {
  id?: number
  name: string
  frequency: Frequency
  intervalCount: number
  nextDueDate: string
  endDate: string
  isActive: boolean
  type: 'IN' | 'OUT'
  sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
  description: string
  grossAmount: number
  paymentMethod: 'BAR' | 'BANK'
  categoryId: number | null
  tags: string[]
  taxonomySelectionById: Record<string, number>
}

type Props = {
  onUseDue: (booking: RecurringBooking) => void
  onChanged?: () => void
  notify: (type: 'success' | 'error' | 'info', text: string) => void
  canWrite: boolean
  tagDefs: Array<{ id: number; name: string; color?: string | null }>
  customCategories: Array<{ id: number; name: string; color?: string | null }>
}

const frequencyLabels: Record<Frequency, string> = {
  WEEKLY: 'Wöchentlich',
  MONTHLY: 'Monatlich',
  QUARTERLY: 'Vierteljährlich',
  YEARLY: 'Jährlich'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(): FormState {
  return {
    name: '',
    frequency: 'MONTHLY',
    intervalCount: 1,
    nextDueDate: todayIso(),
    endDate: '',
    isActive: true,
    type: 'OUT',
    sphere: 'IDEELL',
    description: '',
    grossAmount: 0,
    paymentMethod: 'BANK',
    categoryId: null,
    tags: [],
    taxonomySelectionById: {}
  }
}

function formFromBooking(booking: RecurringBooking): FormState {
  return {
    id: booking.id,
    name: booking.name,
    frequency: booking.frequency,
    intervalCount: booking.intervalCount,
    nextDueDate: booking.nextDueDate,
    endDate: booking.endDate || '',
    isActive: booking.isActive,
    type: booking.template.type,
    sphere: booking.template.sphere,
    description: booking.template.description,
    grossAmount: booking.template.grossAmount,
    paymentMethod: booking.template.paymentMethod,
    categoryId: booking.template.categoryId ?? null,
    tags: booking.template.tags || [],
    taxonomySelectionById: booking.template.taxonomySelectionById || {}
  }
}

export default function RecurringBookingsModal({ onUseDue, onChanged, notify, canWrite, tagDefs, customCategories }: Props) {
  const [rows, setRows] = useState<RecurringBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [taxonomies, setTaxonomies] = useState<Array<{ id: number; name: string }>>([])
  const [taxonomyTermsById, setTaxonomyTermsById] = useState<Record<number, Array<{ id: number; name: string }>>>({})
  const [loadingTaxonomies, setLoadingTaxonomies] = useState(true)
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api?.recurringBookings.list({ includeInactive: true, today: todayIso() })
      setRows(result?.rows || [])
    } catch (error: any) {
      notify('error', 'Wiederkehrende Buchungen konnten nicht geladen werden: ' + String(error?.message || error))
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingTaxonomies(true)
      try {
        const taxonomyResult = await window.api?.taxonomies?.list?.({ includeInactive: false })
        const activeTaxonomies = ((taxonomyResult?.taxonomies || []) as Array<{ id: number; name: string }>)
          .map((taxonomy) => ({ id: Number(taxonomy.id), name: taxonomy.name }))
        const termResults = await Promise.all(activeTaxonomies.map(async (taxonomy) => {
          const result = await window.api?.taxonomies?.terms?.list?.({ taxonomyId: taxonomy.id, includeInactive: false })
          return [taxonomy.id, ((result?.terms || []) as Array<{ id: number; name: string }>).map((term) => ({ id: Number(term.id), name: term.name }))] as const
        }))
        if (cancelled) return
        const termsById = Object.fromEntries(termResults) as Record<number, Array<{ id: number; name: string }>>
        setTaxonomyTermsById(termsById)
        setTaxonomies(activeTaxonomies.filter((taxonomy) => (termsById[taxonomy.id] || []).length > 0))
      } catch {
        if (!cancelled) {
          setTaxonomies([])
          setTaxonomyTermsById({})
        }
      } finally {
        if (!cancelled) setLoadingTaxonomies(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (form) setForm(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [form])

  const dueRows = rows.filter((row) => row.isDue)
  const upcomingRows = rows.filter((row) => !row.isDue)

  const save = useCallback(async () => {
    if (!form || saving) return
    if (!form.name.trim() || !form.description.trim() || !form.nextDueDate || !(form.grossAmount > 0)) {
      notify('error', 'Bitte Name, Fälligkeit, Buchungstext und einen Betrag größer als 0 ausfüllen.')
      return
    }
    setSaving(true)
    try {
      await window.api?.recurringBookings.upsert({
        id: form.id,
        name: form.name.trim(),
        frequency: form.frequency,
        intervalCount: form.intervalCount,
        nextDueDate: form.nextDueDate,
        endDate: form.endDate || null,
        isActive: form.isActive,
        template: {
          type: form.type,
          sphere: form.sphere,
          description: form.description.trim(),
          grossAmount: Number(form.grossAmount),
          vatRate: 0,
          paymentMethod: form.paymentMethod,
          categoryId: form.categoryId,
          tags: form.tags,
          taxonomySelectionById: form.taxonomySelectionById
        }
      })
      notify('success', form.id ? 'Wiederholung aktualisiert.' : 'Wiederholung angelegt.')
      setForm(null)
      await load()
      onChanged?.()
    } catch (error: any) {
      notify('error', String(error?.message || error))
    } finally {
      setSaving(false)
    }
  }, [form, load, notify, onChanged, saving])

  useEffect(() => {
    if (!form) return
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void save()
    }
    window.addEventListener('keydown', onSaveShortcut)
    return () => window.removeEventListener('keydown', onSaveShortcut)
  }, [form, save])

  const toggleActive = async (booking: RecurringBooking) => {
    try {
      await window.api?.recurringBookings.setActive({ id: booking.id, isActive: !booking.isActive })
      await load()
      onChanged?.()
    } catch (error: any) {
      notify('error', String(error?.message || error))
    }
  }

  const skip = async (booking: RecurringBooking) => {
    if (!window.confirm(`Fälligkeit „${booking.name}“ am ${booking.nextDueDate} wirklich überspringen?`)) return
    try {
      await window.api?.recurringBookings.skip({ id: booking.id, dueDate: booking.nextDueDate })
      notify('info', 'Fälligkeit übersprungen.')
      await load()
      onChanged?.()
    } catch (error: any) {
      notify('error', String(error?.message || error))
    }
  }

  const remove = async (booking: RecurringBooking) => {
    if (booking.isActive) return
    if (!window.confirm(`Die pausierte Wiederholung „${booking.name}“ dauerhaft löschen? Bereits erzeugte Buchungen bleiben erhalten.`)) return
    try {
      await window.api?.recurringBookings.delete({ id: booking.id })
      notify('success', 'Wiederholung gelöscht.')
      await load()
      onChanged?.()
    } catch (error: any) {
      notify('error', String(error?.message || error))
    }
  }

  const renderRow = (booking: RecurringBooking) => (
    <article className={`recurring-row ${booking.isDue ? 'is-due' : ''} ${!booking.isActive ? 'is-paused' : ''}`} key={booking.id}>
      <div className="recurring-row-date">
        <span>{booking.isDue ? 'Fällig' : booking.isActive ? 'Nächste' : 'Pausiert'}</span>
        <strong>{booking.nextDueDate}</strong>
      </div>
      <div className="recurring-row-main">
        <strong>{booking.name}</strong>
        <span>{booking.template.description}</span>
        <small>{frequencyLabels[booking.frequency]}{booking.intervalCount > 1 ? ` · alle ${booking.intervalCount} Intervalle` : ''} · {booking.template.paymentMethod === 'BANK' ? 'Bank' : 'Bar'}</small>
      </div>
      <strong className={booking.template.type === 'OUT' ? 'amount-out' : 'amount-in'}>
        {booking.template.type === 'OUT' ? '−' : '+'}{eur.format(booking.template.grossAmount)}
      </strong>
      <div className="recurring-row-actions">
        {booking.isDue && canWrite ? (
          <button className="btn primary icon-btn has-tooltip" data-tooltip="Entwurf öffnen" aria-label="Entwurf öffnen" onClick={() => onUseDue(booking)}><IconDraft /></button>
        ) : null}
        {booking.isDue && canWrite ? <button className="btn ghost icon-btn has-tooltip" data-tooltip="Fälligkeit überspringen" aria-label="Fälligkeit überspringen" onClick={() => { void skip(booking) }}><IconSkip /></button> : null}
        {canWrite ? <button className="btn btn-edit has-tooltip" data-tooltip="Bearbeiten" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => setForm(formFromBooking(booking))}>✎</button> : null}
        {canWrite ? <button className="btn ghost icon-btn has-tooltip" data-tooltip={booking.isActive ? 'Pausieren' : 'Aktivieren'} aria-label={booking.isActive ? 'Pausieren' : 'Aktivieren'} onClick={() => { void toggleActive(booking) }}>{booking.isActive ? <IconPause /> : <IconPlay />}</button> : null}
        {canWrite && !booking.isActive ? <button className="btn danger icon-btn has-tooltip" data-tooltip="Löschen" aria-label="Löschen" onClick={() => { void remove(booking) }}>{ICONS.DELETE}</button> : null}
      </div>
    </article>
  )

  const activeCount = rows.filter((row) => row.isActive).length
  const pausedCount = rows.length - activeCount

  return (
    <>
      <section className="recurring-view">
        <header className="recurring-page-header">
          <div>
            <div className="helper">Planbare Ausgaben und Einnahmen</div>
            <h2>Wiederkehrende Buchungen</h2>
          </div>
          {canWrite ? <button className="btn primary" onClick={() => setForm(emptyForm())}>+ Wiederholung</button> : null}
        </header>

        <div className="recurring-summary" aria-label="Zusammenfassung wiederkehrender Buchungen">
          <div className="recurring-summary-item is-due"><span>Fällig</span><strong>{dueRows.length}</strong><small>Entwürfe zu prüfen</small></div>
          <div className="recurring-summary-item is-active"><span>Aktiv</span><strong>{activeCount}</strong><small>laufende Vorlagen</small></div>
          <div className="recurring-summary-item is-paused"><span>Pausiert</span><strong>{pausedCount}</strong><small>zurzeit ausgesetzt</small></div>
        </div>

        {loading ? (
          <div className="card recurring-empty">Wiederholungen werden geladen …</div>
        ) : (
          <div className="card recurring-list-card">
            <div className="recurring-list">
              {dueRows.length ? <><h3>Jetzt fällig <span className="badge">{dueRows.length}</span></h3>{dueRows.map(renderRow)}</> : <div className="recurring-all-done"><strong>Alles im Takt.</strong><span>Aktuell ist keine wiederkehrende Buchung fällig.</span></div>}
              {upcomingRows.length ? <><h3>Geplant</h3>{upcomingRows.map(renderRow)}</> : null}
              {!rows.length ? <div className="recurring-empty">Noch keine Wiederholungen angelegt.</div> : null}
            </div>
          </div>
        )}
      </section>

      {form && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal booking-modal recurring-editor-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header-flex recurring-editor-header">
              <div className="recurring-editor-title-row">
                <h2>{form.id ? 'Wiederholung bearbeiten' : '+ Wiederholung'}</h2>
                <div className="recurring-editor-actions inline-flex items-center gap-8">
                  <span className="helper">Ctrl+S</span>
                  <button type="button" className="btn primary" disabled={saving} onClick={() => { void save() }}>{saving ? 'Speichert …' : 'Speichern'}</button>
                  <button type="button" className="btn ghost icon-btn" onClick={() => setForm(null)} aria-label="Schließen">✕</button>
                </div>
              </div>
              <div className={`recurring-editor-summary ${form.type === 'IN' ? 'is-in' : 'is-out'}`}>
                <strong>{form.nextDueDate || 'Kein Datum'}</strong>
                <span className={`badge ${form.type.toLowerCase()}`}>{form.type}</span>
                <span>{form.paymentMethod === 'BANK' ? 'BANK' : 'BAR'}</span>
                <strong>{form.grossAmount > 0 ? eur.format(form.grossAmount) : '—'}</strong>
                <span className="helper">{frequencyLabels[form.frequency]}</span>
              </div>
            </header>

            <form className="recurring-editor-grid" onSubmit={(event) => { event.preventDefault(); void save() }}>
              <section className="card recurring-editor-section">
                <div className="helper">Basis</div>
                <label className="field"><span className="recurring-field-label">Name <span className="req-asterisk">*</span></span><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="z. B. Adobe-Abo" autoFocus /></label>
                <div className="recurring-editor-two-cols">
                  <label className="field"><span className="recurring-field-label">Nächste Fälligkeit <span className="req-asterisk">*</span></span><input className="input" type="date" value={form.nextDueDate} onChange={(event) => setForm({ ...form, nextDueDate: event.target.value })} /></label>
                  <label className="field">Kategorie<select className="input" value={form.categoryId ?? ''} onChange={(event) => setForm({ ...form, categoryId: event.target.value ? Number(event.target.value) : null })}><option value="">— Keine Kategorie —</option>{customCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                </div>
                <div className="recurring-editor-two-cols">
                  <div className="field"><label>Art</label><div className="btn-group"><button type="button" className={`btn ${form.type === 'IN' ? 'active in' : ''}`} onClick={() => setForm({ ...form, type: 'IN' })}>IN</button><button type="button" className={`btn ${form.type === 'OUT' ? 'active out' : ''}`} onClick={() => setForm({ ...form, type: 'OUT' })}>OUT</button></div></div>
                  <div className="field"><label>Zahlweg</label><div className="btn-group"><button type="button" className={`btn ${form.paymentMethod === 'BAR' ? 'active' : ''}`} onClick={() => setForm({ ...form, paymentMethod: 'BAR' })}>Bar</button><button type="button" className={`btn ${form.paymentMethod === 'BANK' ? 'active' : ''}`} onClick={() => setForm({ ...form, paymentMethod: 'BANK' })}>Bank</button></div></div>
                </div>
              </section>

              <section className="card recurring-editor-section">
                <div className="helper">Finanzen & Rhythmus</div>
                <label className="field"><span className="recurring-field-label">Brutto <span className="req-asterisk">*</span></span><div className="recurring-amount-input"><input className="input" type="number" min="0.01" step="0.01" value={form.grossAmount || ''} onChange={(event) => setForm({ ...form, grossAmount: Number(event.target.value) })} /><span>€</span></div></label>
                <div className="recurring-editor-two-cols">
                  <label className="field">Rhythmus<select className="input" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as Frequency })}>{Object.entries(frequencyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label className="field">Intervall<input className="input" type="number" min="1" max="99" value={form.intervalCount} onChange={(event) => setForm({ ...form, intervalCount: Math.max(1, Number(event.target.value)) })} /></label>
                </div>
                <div className="recurring-editor-two-cols">
                  <label className="field">Ende (optional)<input className="input" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
                  <label className="field">Sphäre<select className="input" value={form.sphere} onChange={(event) => setForm({ ...form, sphere: event.target.value as FormState['sphere'] })}><option value="IDEELL">Ideeller Bereich</option><option value="ZWECK">Zweckbetrieb</option><option value="VERMOEGEN">Vermögensverwaltung</option><option value="WGB">Wirtschaftlicher Geschäftsbetrieb</option></select></label>
                </div>
              </section>

              <section className="card recurring-editor-section recurring-editor-description">
                <div className="helper">Beschreibung & Tags</div>
                <label className="field"><span className="recurring-field-label">Beschreibung <span className="req-asterisk">*</span></span><input className="input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="z. B. Creative Cloud Monatsabo" /></label>
                <TagsEditor label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} tagDefs={tagDefs} className="tags-editor" />
                {loadingTaxonomies ? <div className="helper">Lade Taxonomien …</div> : null}
                {taxonomies.length > 0 ? (
                  <div className="recurring-taxonomy-fields">
                    <div className="helper recurring-taxonomy-heading">Eigene Taxonomie</div>
                    <div className="recurring-taxonomy-grid">
                      {taxonomies.map((taxonomy) => (
                        <label className="field" key={taxonomy.id}>
                          <span>{taxonomy.name}</span>
                          <select
                            className="input"
                            value={form.taxonomySelectionById[String(taxonomy.id)] ?? ''}
                            onChange={(event) => {
                              const nextSelections = { ...form.taxonomySelectionById }
                              if (event.target.value) nextSelections[String(taxonomy.id)] = Number(event.target.value)
                              else delete nextSelections[String(taxonomy.id)]
                              setForm({ ...form, taxonomySelectionById: nextSelections })
                            }}
                          >
                            <option value="">— keine —</option>
                            {(taxonomyTermsById[taxonomy.id] || []).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
