import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function CashCheckAuditorsModal(props: {
  cashCheckId: number
  initialInspector1Name?: string | null
  initialInspector2Name?: string | null
  notify: (type: 'success' | 'error' | 'info', text: string, ms?: number, action?: { label: string; onClick: () => void }) => void
  onSaved: (names: { inspector1Name: string | null; inspector2Name: string | null }) => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [name1, setName1] = useState<string>(props.initialInspector1Name || '')
  const [name2, setName2] = useState<string>(props.initialInspector2Name || '')

  useEffect(() => {
    setName1(props.initialInspector1Name || '')
    setName2(props.initialInspector2Name || '')
  }, [props.initialInspector1Name, props.initialInspector2Name])

  async function save() {
    const inspector1Name = name1.trim() ? name1.trim() : null
    const inspector2Name = name2.trim() ? name2.trim() : null

    if (!inspector1Name && !inspector2Name) {
      props.notify('error', 'Bitte mindestens einen Kassenprüfer angeben.')
      return
    }

    setSaving(true)
    try {
      await window.api.cashChecks.setInspectors({
        id: props.cashCheckId,
        inspector1Name,
        inspector2Name
      })
      props.notify('success', 'Kassenprüfer gespeichert')
      props.onSaved({ inspector1Name, inspector2Name })
    } catch (e: any) {
      props.notify('error', String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') props.onClose()
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div
        className="modal modal-sm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-check-auditors-title"
      >
        <header className="flex justify-between items-center mb-12">
          <h2 id="cash-check-auditors-title" style={{ margin: 0 }}>
            Kassenprüfer
          </h2>
          <button className="btn icon-btn" onClick={props.onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div className="helper" style={{ marginBottom: 12 }}>
          Für den PDF-Export wird mindestens ein Kassenprüfer benötigt.
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div className="field">
            <label>Kassenprüfer 1</label>
            <input className="input" value={name1} onChange={(e) => setName1(e.target.value)} placeholder="Name" autoFocus />
          </div>
          <div className="field">
            <label>Kassenprüfer 2</label>
            <input className="input" value={name2} onChange={(e) => setName2(e.target.value)} placeholder="Name" />
          </div>
        </div>

        <div className="flex justify-end gap-8" style={{ marginTop: 14 }}>
          <button className="btn" onClick={props.onClose} disabled={saving}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            Speichern
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
