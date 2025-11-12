import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Safe ArrayBuffer -> base64 converter (chunked to avoid call stack overflow)
function bufferToBase64Safe(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
    }
    return btoa(binary)
}

export default function AttachmentsModal({ voucher, onClose }: { voucher: { voucherId: number; voucherNo: string; date: string; description: string }; onClose: () => void }) {
    const [files, setFiles] = useState<Array<{ id: number; fileName: string; mimeType?: string | null }>>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<null | { id: number; fileName: string }>(null)
    const [previewUrl, setPreviewUrl] = useState<string>('')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        let alive = true
        setLoading(true); setError('')
        ;(window as any).api?.attachments.list?.({ voucherId: voucher.voucherId })
            .then((res: any) => {
                if (!alive) return
                const rows = res?.files || []
                setFiles(rows)
                setSelectedId(rows[0]?.id ?? null)
            })
            .catch((e: any) => setError(e?.message || String(e)))
            .finally(() => { if (alive) setLoading(false) })
        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => { alive = false; window.removeEventListener('keydown', onKey) }
    }, [voucher.voucherId])

    async function refreshPreview(id: number | null) {
        setPreviewUrl('')
        if (id == null) return
        const f = files.find(x => x.id === id)
        if (!f) return
        const name = f.fileName || ''
        const mt = (f.mimeType || '').toLowerCase()
        const isImg = mt.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(name)
        if (!isImg) return
        try {
            const res = await (window as any).api?.attachments.read?.({ fileId: id })
            if (res) setPreviewUrl(`data:${res.mimeType || 'image/*'};base64,${res.dataBase64}`)
        } catch (e: any) {
            setError('Vorschau nicht möglich: ' + (e?.message || String(e)))
        }
    }

    useEffect(() => { refreshPreview(selectedId) }, [selectedId])

    const selected = files.find(f => f.id === selectedId) || null

    return createPortal(
        <div
            className="modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                background: 'color-mix(in oklab, var(--surface) 65%, transparent)',
                padding: '24px 16px', zIndex: 9999, overflowY: 'auto'
            }}
        >
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ width: 'min(980px, 96vw)', maxHeight: '92vh', overflow: 'hidden', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', background: 'var(--surface)' }}
            >
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ overflow: 'hidden' }}>
                        <h2 style={{ margin: 0, fontSize: 16 }}>Belege zu #{voucher.voucherNo} – {voucher.date}</h2>
                        <div className="helper" title={voucher.description} style={{ maxWidth: '75ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voucher.description || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn danger" onClick={onClose}>Schließen</button>
                        <button className="btn" disabled={!selected} onClick={() => selected && (window as any).api?.attachments.open?.({ fileId: selected.id })}>Extern öffnen</button>
                        <button
                            className="btn"
                            disabled={!selected}
                            onClick={async () => {
                                if (!selected) return
                                try {
                                    const r = await (window as any).api?.attachments.saveAs?.({ fileId: selected.id })
                                    if (r) alert('Gespeichert: ' + r.filePath)
                                } catch (e: any) {
                                    const m = e?.message || String(e)
                                    if (/Abbruch/i.test(m)) return
                                    alert('Speichern fehlgeschlagen: ' + m)
                                }
                            }}
                        >Herunterladen</button>
                        <input ref={fileInputRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={async (e) => {
                            const list = e.target.files
                            if (!list || !list.length) return
                            try {
                                for (const f of Array.from(list)) {
                                    const buf = await f.arrayBuffer()
                                    const dataBase64 = bufferToBase64Safe(buf)
                                    await (window as any).api?.attachments.add?.({ voucherId: voucher.voucherId, fileName: f.name, dataBase64, mimeType: f.type || undefined })
                                }
                                const res = await (window as any).api?.attachments.list?.({ voucherId: voucher.voucherId })
                                setFiles(res?.files || [])
                                setSelectedId((res?.files || [])[0]?.id ?? null)
                            } catch (e: any) {
                                alert('Upload fehlgeschlagen: ' + (e?.message || String(e)))
                            } finally {
                                if (fileInputRef.current) fileInputRef.current.value = ''
                            }
                        }} />
                        <button className="btn" onClick={() => fileInputRef.current?.click?.()}>+ Datei(en)</button>
                        <button 
                            className="btn danger" 
                            disabled={!selected} 
                            onClick={(e) => {
                                e.stopPropagation()
                                if (selected) setConfirmDelete({ id: selected.id, fileName: selected.fileName })
                            }}
                        >🗑 Löschen</button>
                    </div>
                </header>
                {error && <div style={{ color: 'var(--danger)', margin: '0 8px 8px' }}>{error}</div>}
                {loading && <div style={{ margin: '0 8px 8px' }}>Lade …</div>}
                {!loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: 12, minHeight: 320, padding: 8, boxSizing: 'border-box' }}>
                        <div className="card" style={{ padding: 8, overflow: 'auto', maxHeight: 'calc(92vh - 120px)' }}>
                            {files.length === 0 && <div className="helper">Keine Dateien vorhanden</div>}
                            {files.map(f => (
                                <button key={f.id} className="btn" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, background: selectedId === f.id ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : undefined }} onClick={() => setSelectedId(f.id)}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                                </button>
                            ))}
                        </div>
                        <div className="card" style={{ padding: 8, display: 'grid', placeItems: 'center', background: 'var(--muted)', maxHeight: 'calc(92vh - 120px)', overflow: 'auto' }}>
                            {selected && previewUrl && (
                                <img src={previewUrl} alt={selected.fileName} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }} />
                            )}
                            {selected && !previewUrl && (
                                <div className="helper">Keine Vorschau verfügbar. Nutze „Extern öffnen“ oder „Herunterladen“.</div>
                            )}
                            {!selected && <div className="helper">Wähle eine Datei links aus.</div>}
                        </div>
                    </div>
                )}
                {confirmDelete && (
                    <div className="modal-overlay" onClick={() => setConfirmDelete(null)} role="dialog" aria-modal="true">
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Datei löschen</h3>
                                <button className="btn ghost" onClick={() => setConfirmDelete(null)} aria-label="Schließen">✕</button>
                            </div>
                            <div>
                                Möchtest du die Datei <strong>{confirmDelete.fileName}</strong> wirklich löschen?
                            </div>
                            <div className="helper">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn" onClick={() => setConfirmDelete(null)}>Abbrechen</button>
                                <button className="btn danger" onClick={async () => {
                                    try {
                                        await (window as any).api?.attachments.delete?.({ fileId: confirmDelete.id })
                                        const res = await (window as any).api?.attachments.list?.({ voucherId: voucher.voucherId })
                                        setFiles(res?.files || [])
                                        setSelectedId((res?.files || [])[0]?.id ?? null)
                                        setPreviewUrl('')
                                        setConfirmDelete(null)
                                    } catch (e: any) {
                                        alert('Löschen fehlgeschlagen: ' + (e?.message || String(e)))
                                    }
                                }}>Ja, löschen</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
