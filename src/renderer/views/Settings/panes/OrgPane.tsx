import React from 'react'
import { OrgPaneProps } from '../types'
import TaxExemptionModal from '../../../components/modals/TaxExemptionModal'
import type { TaxExemptionCertificate } from '../../../../../shared/types'

/**
 * OrgPane - Organization Settings
 * 
 * Handles:
 * - Organization name
 * - Cashier name
 * - Tax Exemption Certificate (Steuerbefreiungsbescheid)
 */
export function OrgPane({ notify }: OrgPaneProps) {
  const [orgName, setOrgName] = React.useState<string>('')
  const [cashier, setCashier] = React.useState<string>('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>('')
  const [showTaxExemptionModal, setShowTaxExemptionModal] = React.useState(false)
  const [taxCertificate, setTaxCertificate] = React.useState<TaxExemptionCertificate | null>(null)

  async function loadTaxCertificate() {
    try {
      const res = await (window as any).api?.taxExemption?.get?.()
      setTaxCertificate(res?.certificate || null)
    } catch (e: any) {
      console.error('Error loading tax certificate:', e)
    }
  }

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
    loadTaxCertificate()
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

      {/* Tax Exemption Certificate Section */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 12 }}>
          <strong>📄 Steuerbefreiungsbescheid</strong>
          <div className="helper">Gemeinnützigkeitsbescheid für Spendenbescheinigungen hinterlegen</div>
        </div>

        {taxCertificate ? (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'color-mix(in oklab, var(--accent) 5%, transparent)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>📎</span>
                <strong>{taxCertificate.fileName}</strong>
              </div>
              <div className="helper">
                Hochgeladen: {new Date(taxCertificate.uploadDate).toLocaleDateString('de-DE')}
                {taxCertificate.validFrom && taxCertificate.validUntil && (
                  <> · Gültig: {new Date(taxCertificate.validFrom).toLocaleDateString('de-DE')} bis{' '}
                    {new Date(taxCertificate.validUntil).toLocaleDateString('de-DE')}</>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                onClick={() => setShowTaxExemptionModal(true)}
              >
                Ansehen
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-dim)'
            }}
          >
            <div style={{ marginBottom: 12 }}>Kein Bescheid hinterlegt</div>
            <button
              className="btn primary"
              onClick={() => setShowTaxExemptionModal(true)}
            >
              + Bescheid hochladen
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showTaxExemptionModal && (
        <TaxExemptionModal
          onClose={() => setShowTaxExemptionModal(false)}
          onSaved={() => {
            loadTaxCertificate()
            notify('success', 'Steuerbefreiungsbescheid aktualisiert')
          }}
        />
      )}
    </div>
  )
}
