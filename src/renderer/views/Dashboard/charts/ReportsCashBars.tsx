import React, { useEffect, useMemo, useState } from 'react'

type Account = { id: number; name: string; kind: string; color?: string | null; balance: number }
export default function ReportsCashBars(props: { refreshKey?: number; from?: string; to?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  useEffect(() => { let active = true; (window as any).api?.reports.cashBalance?.({ from: props.from, to: props.to }).then((r: any) => { if (active) setAccounts(r?.accounts || []) }); return () => { active = false } }, [props.from, props.to, props.refreshKey])
  const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const max = Math.max(1, ...accounts.map(a => Math.abs(a.balance)))
  return <div className="card" style={{ padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><strong>Kassenstand nach Zahlungskonto</strong><strong>{eur.format(total)}</strong></div>
    <div style={{ display: 'grid', gap: 8 }}>{accounts.map(a => <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span><div style={{ flex: 1, height: 24, background: 'var(--muted)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}><div style={{ width: `${Math.max(2, Math.abs(a.balance) / max * 100)}%`, height: '100%', background: a.color || 'var(--accent)' }} /><span style={{ position: 'absolute', right: 8, top: 3 }}>{eur.format(a.balance)}</span></div></div>)}</div>
  </div>
}
