import React from 'react'
import { OrgPaneProps } from '../types'

/**
 * OrgPane - Organization Settings
 * 
 * Handles:
 * - Organization name
 * - Cashier name
 */
export function OrgPane({ notify }: OrgPaneProps) {
  const [orgName, setOrgName] = React.useState<string>('')
  const [cashier, setCashier] = React.useState<string>('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>('')

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const on = await (window as any).api?.settings?.get?.({ key: 'org.name' })
        const cn = await (window as any).api?.settings?.get?.({ key: 'org.cashier' })
        if (!cancelled) {
          setOrgName((on?.value as any) || '')
          setCashier((cn?.value as any) || '')
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function save() {
    setBusy(true)
    setError('')
    try {
      await (window as any).api?.settings?.set?.({ key: 'org.name', value: orgName })
      await (window as any).api?.settings?.set?.({ key: 'org.cashier', value: cashier })
      notify('success', 'Organisation gespeichert')
      window.dispatchEvent(new Event('data-changed'))
    } catch (e: any) {
      setError(e?.message || String(e))
      notify('error', e?.message || String(e))
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>Organisation</strong>
        <div className="helper">Name der Organisation und der Kassierer:in.</div>
      </div>
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="row">
        <div className="field">
          <label>Name der Organisation</label>
          <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="z. B. Förderverein Muster e.V." />
        </div>
        <div className="field">
          <label>Name (Kassier)</label>
          <input className="input" value={cashier} onChange={(e) => setCashier(e.target.value)} placeholder="z. B. Max Mustermann" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn primary" disabled={busy} onClick={save}>Speichern</button>
      </div>
    </div>
  )
}
