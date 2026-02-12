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

function base64ToUint8Array(base64: string) {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

export default function AttachmentsModal({ voucher, onClose }: { voucher: { voucherId: number; voucherNo: string; date: string; description: string }; onClose: () => void }) {
    const [files, setFiles] = useState<Array<{ id: number; fileName: string; mimeType?: string | null }>>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<null | { id: number; fileName: string }>(null)
    const [previewUrl, setPreviewUrl] = useState<string>('')
    const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null)
    const [pdfBase64, setPdfBase64] = useState<string | null>(null)
    const [pdfPage, setPdfPage] = useState<number>(1)
    const [pdfPages, setPdfPages] = useState<number>(0)
    const [pdfCanvasUrl, setPdfCanvasUrl] = useState<string>('')
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
        setPreviewType(null)
        setPdfBase64(null)
        setPdfCanvasUrl('')
        setPdfPages(0)
        setPdfPage(1)
        if (id == null) return
        const f = files.find(x => x.id === id)
        if (!f) return
        const name = f.fileName || ''
        const mt = (f.mimeType || '').toLowerCase()
        const isImg = mt.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(name)
        const isPdf = mt.includes('pdf') || /\.pdf$/i.test(name)
        if (!isImg && !isPdf) return
        try {
            const res = await (window as any).api?.attachments.read?.({ fileId: id })
            if (!res) return
            const mime = (res.mimeType || '').toLowerCase()
            const asPdf = isPdf || mime.includes('pdf')
            if (asPdf) {
                setPreviewType('pdf')
                setPdfBase64(res.dataBase64)
                return
            }
            setPreviewType('image')
            setPreviewUrl(`data:${res.mimeType || 'image/*'};base64,${res.dataBase64}`)
        } catch (e: any) {
            setError('Vorschau nicht möglich: ' + (e?.message || String(e)))
        }
    }

    useEffect(() => { refreshPreview(selectedId) }, [selectedId, files])

    useEffect(() => {
        if (previewType !== 'pdf' || !pdfBase64) return
        let cancelled = false

        ;(async () => {
            try {
                const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
                if (!pdfjs.GlobalWorkerOptions.workerSrc) {
                    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
                }
                const task = pdfjs.getDocument({ data: base64ToUint8Array(pdfBase64) })
                const doc = await task.promise
                if (cancelled) {
                    await doc.destroy()
                    return
                }

                const totalPages = doc.numPages || 1
                setPdfPages(totalPages)
                const safePage = Math.min(Math.max(1, pdfPage), totalPages)
                if (safePage !== pdfPage) setPdfPage(safePage)

                const page = await doc.getPage(safePage)
                const scale = 1
                const viewport = page.getViewport({ scale })
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                if (!context) {
                    await doc.destroy()
                    return
                }
                canvas.width = Math.floor(viewport.width)
                canvas.height = Math.floor(viewport.height)
                context.fillStyle = '#ffffff'
                context.fillRect(0, 0, canvas.width, canvas.height)
                await page.render({ canvasContext: context, viewport }).promise
                if (!cancelled) {
                    setPdfCanvasUrl(canvas.toDataURL('image/png'))
                    setError('')
                }
                await doc.destroy()
            } catch (e: any) {
                if (!cancelled) setError('PDF-Vorschau nicht möglich: ' + (e?.message || String(e)))
            }
        })()

        return () => {
            cancelled = true
        }
    }, [previewType, pdfBase64, pdfPage])

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
                        <button className="btn icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
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
                            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                <button
                                    className="btn danger"
                                    disabled={!selected}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (selected) setConfirmDelete({ id: selected.id, fileName: selected.fileName })
                                    }}
                                    style={{ width: '100%' }}
                                >🗑 Löschen</button>
                            </div>
                        </div>
                        <div className="card" style={{ padding: 8, display: 'grid', placeItems: 'center', background: 'var(--muted)', maxHeight: 'calc(92vh - 120px)', overflow: 'auto' }}>
                            {selected && previewType === 'image' && previewUrl && (
                                <img src={previewUrl} alt={selected.fileName} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }} />
                            )}
                            {selected && previewType === 'pdf' && (
                                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <div className="helper" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selected.fileName}>{selected.fileName}</div>
                                        {pdfPages > 1 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <button type="button" className="btn ghost" onClick={() => setPdfPage((p) => Math.max(1, p - 1))} disabled={pdfPage <= 1} aria-label="Vorherige PDF-Seite">‹</button>
                                                <span className="helper" style={{ minWidth: 56, textAlign: 'center' }}>{pdfPage}/{pdfPages}</span>
                                                <button type="button" className="btn ghost" onClick={() => setPdfPage((p) => Math.min(pdfPages, p + 1))} disabled={pdfPage >= pdfPages} aria-label="Nächste PDF-Seite">›</button>
                                            </div>
                                        )}
                                    </div>
                                    {pdfCanvasUrl ? (
                                        <img
                                            src={pdfCanvasUrl}
                                            alt={`PDF Vorschau ${selected.fileName}, Seite ${pdfPage}`}
                                            style={{ width: '100%', minHeight: '60vh', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
                                        />
                                    ) : (
                                        <div className="helper" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                                            PDF wird gerendert …
                                        </div>
                                    )}
                                </div>
                            )}
                            {selected && previewType !== 'pdf' && !previewUrl && (
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
