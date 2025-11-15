import React from 'react'

export default function SmartRestoreModal({ preview, onClose, onApply }: {
  preview: {
    current: { root: string; dbPath: string; exists: boolean; mtime?: number | null; counts?: Record<string, number>; last?: Record<string, string | null> }
    default: { root: string; dbPath: string; exists: boolean; mtime?: number | null; counts?: Record<string, number>; last?: Record<string, string | null> }
    recommendation?: 'useDefault' | 'migrateToDefault' | 'manual'
  }
  onClose: () => void
  onApply: (action: 'useDefault' | 'migrateToDefault') => void
}) {
  const { current, default: def, recommendation } = preview as any
  const fmtDateTime = (ms?: number | null) => ms ? new Date(ms).toLocaleString() : '—'
  const Item = ({ label, cur, defv }: { label: string; cur: React.ReactNode; defv: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <div className="helper">{label}</div>
      <div>{cur as any}</div>
      <div>{defv as any}</div>
    </div>
  )
  const recLabel = recommendation === 'useDefault' ? 'Empfehlung: Standard verwenden' : recommendation === 'migrateToDefault' ? 'Empfehlung: Aktuelle migrieren' : 'Empfehlung: —'
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Standard wiederherstellen (Smart)</h2>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontWeight: 600 }}>
            <div></div>
            <div>Aktuell</div>
            <div>Standardordner</div>
          </div>
          <Item label="Ordner" cur={<div style={{ wordBreak: 'break-all' }}>{current.root}</div>} defv={<div style={{ wordBreak: 'break-all' }}>{def.root}</div>} />
          <Item label="Datenbank" cur={<div style={{ wordBreak: 'break-all' }}>{current.dbPath}</div>} defv={<div style={{ wordBreak: 'break-all' }}>{def.dbPath}</div>} />
          <Item label="Vorhanden" cur={current.exists ? 'Ja' : 'Nein'} defv={def.exists ? 'Ja' : 'Nein'} />
          <Item label="Geändert" cur={fmtDateTime(current.mtime)} defv={fmtDateTime(def.mtime)} />
          <div style={{ height: 6 }} />
          <div className="helper">Tabellenstände</div>
          <Item label="Buchungen" cur={String(current.counts?.vouchers ?? 0)} defv={String(def.counts?.vouchers ?? 0)} />
          <Item label="Verbindlichkeiten" cur={String(current.counts?.invoices ?? 0)} defv={String(def.counts?.invoices ?? 0)} />
          <Item label="Mitglieder" cur={String(current.counts?.members ?? 0)} defv={String(def.counts?.members ?? 0)} />
          <Item label="Tags" cur={String(current.counts?.tags ?? 0)} defv={String(def.counts?.tags ?? 0)} />
          <div style={{ height: 6 }} />
          <div className="helper">Letzte Aktivität</div>
          <Item label="Buchung" cur={current.last?.voucher ?? '—'} defv={def.last?.voucher ?? '—'} />
          <Item label="Verbindlichkeit" cur={current.last?.invoice ?? '—'} defv={def.last?.invoice ?? '—'} />
          <Item label="Mitglied" cur={current.last?.member ?? '—'} defv={def.last?.member ?? '—'} />
          <Item label="Audit" cur={current.last?.audit ?? '—'} defv={def.last?.audit ?? '—'} />
        </div>
        <div className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="helper">{recLabel}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => onApply('useDefault')} disabled={!def.exists}>Standard verwenden</button>
            <button className="btn primary" onClick={() => onApply('migrateToDefault')}>Aktuelle migrieren (Standard)</button>
          </div>
        </div>
      </div>
    </div>
  )
}
