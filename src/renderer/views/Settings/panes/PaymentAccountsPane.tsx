import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PaymentAccountModal, { PaymentAccountValue } from '../../../components/modals/PaymentAccountModal'
import { IconEdit, IconTrash } from '../../../utils/icons'

type Account = PaymentAccountValue & { id: number; sortOrder: number; isActive: number }
const labels = { CASH: 'Bar', BANK: 'Bankkonto', PAYPAL: 'PayPal', CARD: 'Karte', OTHER: 'Sonstiges' }

export function PaymentAccountsPane({ notify, bumpDataVersion }: { notify: (type: 'success' | 'error' | 'info', text: string) => void; bumpDataVersion: () => void }) {
  const [rows, setRows] = useState<Account[]>([])
  const [edit, setEdit] = useState<PaymentAccountValue | null>(null)
  const [remove, setRemove] = useState<Account | null>(null)
  const load = async () => setRows(await window.api!.paymentAccounts.list() as Account[])
  useEffect(() => { void load() }, [])
  const changed = async () => { setEdit(null); await load(); bumpDataVersion(); notify('success', 'Zahlungskonto gespeichert.') }
  return <section style={{ display: 'grid', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}><div><h2 style={{ margin: '0 0 4px' }}>💳 Zahlungskonten <span className="chip">{rows.length}</span></h2><div className="helper">Konten für Buchungen, Transfers, Filter, Diagramme und Exporte.</div></div><button className="btn primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setEdit({ name: '', kind: 'BANK', color: '#2962FF', isActive: 1, sortOrder: rows.length + 1 })}>+ Neues Konto</button></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>{rows.map(row => { const color = row.color || '#2962FF'; return <article key={row.id} className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', background: `${color}18`, borderLeft: `4px solid ${color}`, opacity: row.isActive ? 1 : .65 }}><div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: color, color: '#fff', fontWeight: 700 }}>{row.name[0]?.toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><strong>{row.name}</strong><div className="helper">{labels[row.kind]}{row.iban ? ` · ${row.iban}` : ''}{!row.isActive ? ' · inaktiv' : ''}</div></div><div style={{ display: 'flex', gap: 4, color }}><button className="btn ghost icon-btn" style={{ color }} onClick={() => setEdit(row)} title="Bearbeiten" aria-label={`${row.name} bearbeiten`}><IconEdit /></button><button className="btn danger icon-btn" onClick={() => setRemove(row)} title="Löschen" aria-label={`${row.name} löschen`}><IconTrash /></button></div></article> })}</div>
    {!rows.length && <div className="card" style={{ padding: 32, textAlign: 'center' }}><div style={{ fontSize: 32 }}>💳</div><div className="helper">Noch keine Zahlungskonten vorhanden.</div></div>}
    {edit && <PaymentAccountModal value={edit} onClose={() => setEdit(null)} onSaved={changed} notify={notify} />}
    {remove && createPortal(<div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setRemove(null)}><div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 460 }}><h2>Zahlungskonto löschen</h2><p>Möchtest du <strong style={{ color: remove.color || undefined }}>{remove.name}</strong> wirklich löschen?</p><div className="helper">Bereits verwendete Konten können nicht gelöscht, aber deaktiviert werden.</div><div className="modal-actions"><button className="btn" onClick={() => setRemove(null)}>Abbrechen</button><button className="btn danger" onClick={async () => { try { await window.api!.paymentAccounts.delete({ id: remove.id }); setRemove(null); await load(); bumpDataVersion(); notify('success', 'Zahlungskonto gelöscht.') } catch (error: any) { notify('error', error?.message || 'Löschen fehlgeschlagen.'); setRemove(null) } }}>Löschen</button></div></div></div>, document.body)}
  </section>
}
