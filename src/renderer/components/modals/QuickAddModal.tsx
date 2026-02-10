import React, { useEffect, useRef, useState } from 'react'
import TagsEditor from '../TagsEditor'
import type { QA, BudgetAssignment, EarmarkAssignment } from '../../hooks/useQuickAdd'

interface QuickAddModalProps {
    title?: string
    hideAttachments?: boolean
    qa: QA
    setQa: (qa: QA) => void
    onSave: () => void
    onClose: () => void
    files: File[]
    setFiles: (files: File[]) => void
    openFilePicker: () => void
    onDropFiles: (files: FileList | null) => void
    fileInputRef: React.RefObject<HTMLInputElement>
    fmtDate: (d: string) => string
    eurFmt: Intl.NumberFormat
    budgetsForEdit: Array<{ id: number; label: string }>
    earmarks: Array<{ id: number; code: string; name: string; color?: string | null }>
    tagDefs: Array<{ id: number; name: string; color?: string | null }>
    descSuggest: string[]
    customCategories?: Array<{ id: number; name: string; color?: string | null }>
    useCategoriesModule?: boolean
}

/**
 * QuickAddModal - Buchung schnell erfassen
 * 
 * Modal für das schnelle Erfassen von Buchungen mit allen Details
 * Extrahiert aus App.tsx für bessere Wartbarkeit
 */
export default function QuickAddModal({
    title = '+ Buchung',
    hideAttachments = false,
    qa,
    setQa,
    onSave,
    onClose,
    files,
    setFiles,
    openFilePicker,
    onDropFiles,
    fileInputRef,
    fmtDate,
    eurFmt,
    budgetsForEdit,
    earmarks,
    tagDefs,
    descSuggest,
    customCategories = [],
    useCategoriesModule = false
}: QuickAddModalProps) {
    const [taxonomiesForCreate, setTaxonomiesForCreate] = useState<Array<{ id: number; name: string }>>([])
    const [taxonomyTermsById, setTaxonomyTermsById] = useState<Record<number, Array<{ id: number; name: string }>>>({})
    const [loadingTaxonomiesForCreate, setLoadingTaxonomiesForCreate] = useState(false)

    // Load active taxonomies + active terms on open; only show taxonomies that have at least one term.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoadingTaxonomiesForCreate(true)
            try {
                const resTx = await (window as any).api?.taxonomies?.list?.({ includeInactive: false })
                const txs = ((resTx?.taxonomies || []) as Array<{ id: number; name: string }>).map((t) => ({ id: Number(t.id), name: t.name }))
                if (cancelled) return
                if (!txs.length) {
                    setTaxonomiesForCreate([])
                    setTaxonomyTermsById({})
                    return
                }

                const termsBy: Record<number, Array<{ id: number; name: string }>> = {}
                for (const tx of txs) {
                    const resTerms = await (window as any).api?.taxonomies?.terms?.list?.({ taxonomyId: tx.id, includeInactive: false })
                    const terms = (resTerms?.terms || []) as Array<{ id: number; name: string }>
                    termsBy[tx.id] = terms.map((t) => ({ id: Number(t.id), name: t.name }))
                }
                if (cancelled) return

                const txsWithTerms = txs.filter((tx) => (termsBy[tx.id] || []).length > 0)
                setTaxonomiesForCreate(txsWithTerms)
                setTaxonomyTermsById(termsBy)

                // Ensure selection map exists
                const existing = ((qa as any).taxonomySelectionById || {}) as Record<number, number | ''>
                const nextSel: Record<number, number | ''> = { ...existing }
                for (const tx of txsWithTerms) {
                    if (!(tx.id in nextSel)) nextSel[tx.id] = ''
                }
                if (Object.keys(nextSel).length !== Object.keys(existing).length) {
                    setQa({ ...(qa as any), taxonomySelectionById: nextSel } as any)
                }
            } catch {
                if (cancelled) return
                setTaxonomiesForCreate([])
                setTaxonomyTermsById({})
            } finally {
                if (!cancelled) setLoadingTaxonomiesForCreate(false)
            }
        })()
        return () => {
            cancelled = true
        }
        // Intentionally run only on mount/open
    }, [])

    return (
        <div className="modal-overlay">
            <div className="modal booking-modal" onClick={(e) => e.stopPropagation()}>
                {/* Sticky Header with Summary + Actions */}
                <header className="modal-header-flex" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    {/* Title row with action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <h2 style={{ margin: 0, flex: 1 }}>{title}</h2>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="helper" style={{ fontSize: 11, opacity: 0.7 }}>Ctrl+S</span>
                            <button type="submit" form="quick-add-form" className="btn primary" style={{ padding: '6px 12px', fontSize: 13 }}>Speichern</button>
                            <button className="btn ghost" onClick={() => { onClose(); setFiles([]) }} title="Schließen (ESC)" style={{ padding: 6 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    {/* Compact Summary Line */}
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '6px 12px', 
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))',
                        borderRadius: 8,
                        borderLeft: `4px solid ${qa.type === 'IN' ? 'var(--success)' : qa.type === 'OUT' ? 'var(--danger)' : 'var(--accent)'}`,
                        fontSize: 13
                    }}>
                        <span style={{ fontWeight: 600 }}>{fmtDate(qa.date)}</span>
                        <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 4, 
                            fontSize: 11,
                            fontWeight: 700,
                            background: qa.type === 'IN' ? 'var(--success)' : qa.type === 'OUT' ? 'var(--danger)' : 'var(--accent)',
                            color: 'white'
                        }}>
                            {qa.type}
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>
                            {qa.type === 'TRANSFER' 
                                ? `${(qa as any).transferFrom || '—'} → ${(qa as any).transferTo || '—'}`
                                : (qa as any).paymentMethod || '—'}
                        </span>
                        <span style={{ 
                            color: qa.type === 'IN' ? 'var(--success)' : qa.type === 'OUT' ? 'var(--danger)' : 'inherit',
                            fontWeight: 700
                        }}>
                            {(() => {
                                if (qa.type === 'TRANSFER') return eurFmt.format(Number((qa as any).grossAmount || 0))
                                if ((qa as any).mode === 'GROSS') return eurFmt.format(Number((qa as any).grossAmount || 0))
                                const n = Number(qa.netAmount || 0)
                                const v = Number(qa.vatRate || 0)
                                const g = Math.round((n * (1 + v / 100)) * 100) / 100
                                return eurFmt.format(g)
                            })()}
                        </span>
                        {/* Category badge */}
                        {useCategoriesModule && (qa as any).categoryId && customCategories.length > 0 && (() => {
                            const cat = customCategories.find(c => c.id === (qa as any).categoryId)
                            return cat ? (
                                <span style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: 4, 
                                    fontSize: 11,
                                    background: cat.color ? `${cat.color}30` : 'var(--muted)',
                                    border: `1px solid ${cat.color || 'var(--border)'}`,
                                    color: cat.color || 'var(--text)'
                                }}>
                                    {cat.name}
                                </span>
                            ) : null
                        })()}
                        {/* Description snippet */}
                        {qa.description && (
                            <span style={{ color: 'var(--text)', opacity: 0.85 }}>
                                📝 {qa.description.length > 40 ? qa.description.slice(0, 40) + '…' : qa.description}
                            </span>
                        )}
                        {/* Tags count */}
                        {qa.tags && qa.tags.length > 0 && (
                            <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 999, 
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'var(--muted)',
                                border: '1px solid var(--border)'
                            }}>
                                🏷️ {qa.tags.length}
                            </span>
                        )}
                    </div>
                </header>
                
                <form id="quick-add-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
                    {/* Blocks A+B in a side-by-side grid on wide screens */}
                    <div className="block-grid block-grid-mb">
                        {/* Block A – Basisinfos */}
                        <div className="card form-card">
                            <div className="helper helper-mb">Basis</div>
                            <div className="row">
                                <div className="field">
                                    <label>Datum <span className="req-asterisk" aria-hidden="true">*</span></label>
                                    <input className="input" type="date" value={qa.date} onChange={(e) => setQa({ ...qa, date: e.target.value })} aria-label="Datum der Buchung" required />
                                </div>
                                <div className="field">
                                    <label>Art</label>
                                    <div className="btn-group" role="group" aria-label="Art wählen">
                                        {(['IN','OUT','TRANSFER'] as const).map(t => (
                                            <button key={t} type="button" 
                                                className={`btn ${qa.type === t ? 'btn-toggle-active' : ''} ${t === 'IN' ? 'btn-type-in' : t === 'OUT' ? 'btn-type-out' : ''}`}
                                                onClick={() => {
                                                    const newQa = { ...qa, type: t }
                                                    if (t === 'TRANSFER' && (!(newQa as any).transferFrom || !(newQa as any).transferTo)) {
                                                        (newQa as any).transferFrom = 'BAR';
                                                        (newQa as any).transferTo = 'BANK'
                                                    }
                                                    setQa(newQa)
                                                }}>{t}</button>
                                        ))}
                                    </div>
                                </div>
                                {/* Kategorie - gleiche Position wie im Edit-Modal */}
                                {useCategoriesModule && customCategories.length > 0 && (
                                    <div className="field">
                                        <label>Kategorie</label>
                                        <select 
                                            value={(qa as any).categoryId ?? ''} 
                                            disabled={qa.type === 'TRANSFER'}
                                            onChange={(e) => setQa({ ...qa, categoryId: e.target.value ? Number(e.target.value) : null } as any)} 
                                            aria-label="Kategorie auswählen"
                                        >
                                            <option value="">— Keine Kategorie —</option>
                                            {customCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {qa.type === 'TRANSFER' ? (
                                    <div className="field">
                                        <label>Richtung <span className="req-asterisk" aria-hidden="true">*</span></label>
                                        <select value={`${(qa as any).transferFrom ?? ''}->${(qa as any).transferTo ?? ''}`}
                                            onChange={(e) => {
                                                const v = e.target.value
                                                if (v === 'BAR->BANK') setQa({ ...(qa as any), transferFrom: 'BAR', transferTo: 'BANK', paymentMethod: undefined } as any)
                                                else if (v === 'BANK->BAR') setQa({ ...(qa as any), transferFrom: 'BANK', transferTo: 'BAR', paymentMethod: undefined } as any)
                                            }}
                                            aria-label="Transfer-Richtung">
                                            <option value="BAR->BANK">BAR → BANK</option>
                                            <option value="BANK->BAR">BANK → BAR</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="field">
                                        <label>Zahlweg</label>
                                        <div className="btn-group" role="group" aria-label="Zahlweg wählen">
                                            {(['BAR','BANK'] as const).map(pm => (
                                                <button key={pm} type="button" 
                                                    className={`btn ${(qa as any).paymentMethod === pm ? 'btn-toggle-active' : ''}`}
                                                    onClick={() => setQa({ ...qa, paymentMethod: pm })}>{pm === 'BAR' ? 'Bar' : 'Bank'}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Block B – Finanzdetails */}
                        <div className="card form-card">
                            <div className="helper helper-mb">Finanzen</div>
                            <div className="row">
                                {qa.type === 'TRANSFER' ? (
                                    <div className="field field-full-width">
                                        <label>Betrag (Transfer) <span className="req-asterisk" aria-hidden="true">*</span></label>
                                        <span className="adorn-wrap">
                                            <input className="input input-transfer" type="number" step="0.01" value={(qa as any).grossAmount ?? ''}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value)
                                                    setQa({ ...qa, grossAmount: v })
                                                }}
                                                aria-label="Transfer-Betrag" />
                                            <span className="adorn-suffix">€</span>
                                        </span>
                                        <div className="helper">Transfers sind umsatzsteuerneutral.</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="field">
                                            <label>{(qa as any).mode === 'GROSS' ? 'Brutto' : 'Netto'} <span className="req-asterisk" aria-hidden="true">*</span></label>
                                            <div className="flex-gap-8">
                                                <select
                                                    className="input"
                                                    value={(qa as any).mode ?? 'NET'}
                                                    onChange={(e) => {
                                                        const newMode = e.target.value as 'NET' | 'GROSS'
                                                        const next = { ...qa, mode: newMode } as any
                                                        if (newMode === 'NET') {
                                                            // Falls kein Netto gesetzt ist, aus Brutto übernehmen
                                                            if (next.netAmount == null || isNaN(next.netAmount)) {
                                                                if (typeof next.grossAmount === 'number') next.netAmount = next.grossAmount
                                                                else next.netAmount = 0
                                                            }
                                                            // Wenn bisher vatRate=0 (vom Brutto-Modus), setze Standard auf 19%
                                                            if (Number(next.vatRate) === 0) next.vatRate = 19
                                                        } else if (newMode === 'GROSS') {
                                                            // Wechsel zu Brutto: vatRate immer 0, Brutto ggf. aus Netto berechnen
                                                            if (typeof next.netAmount === 'number' && (next.grossAmount == null || isNaN(next.grossAmount))) {
                                                                const rate = Number(next.vatRate) || 0
                                                                next.grossAmount = Math.round((next.netAmount * (1 + rate / 100)) * 100) / 100
                                                            }
                                                            next.vatRate = 0
                                                        }
                                                        setQa(next)
                                                    }}
                                                    aria-label="Netto oder Brutto Modus"
                                                >
                                                    <option value="NET">Netto</option>
                                                    <option value="GROSS">Brutto</option>
                                                </select>
                                                <span className="adorn-wrap flex-1">
                                                    <input className="input" type="number" step="0.01" value={(qa as any).mode === 'GROSS' ? (qa as any).grossAmount ?? '' : qa.netAmount}
                                                        onChange={(e) => {
                                                            const v = Number(e.target.value)
                                                            if ((qa as any).mode === 'GROSS') setQa({ ...qa, grossAmount: v })
                                                            else setQa({ ...qa, netAmount: v })
                                                        }}
                                                        aria-label={(qa as any).mode === 'GROSS' ? 'Brutto-Betrag' : 'Netto-Betrag'} />
                                                    <span className="adorn-suffix">€</span>
                                                </span>
                                            </div>
                                            <div className="helper">{(qa as any).mode === 'GROSS' ? 'Bei Brutto wird USt/Netto nicht berechnet' : 'USt wird automatisch berechnet'}</div>
                                        </div>
                                        {(qa as any).mode === 'NET' && (
                                            <div className="field">
                                                <label>USt %</label>
                                                <select
                                                    className="input"
                                                    value={String(qa.vatRate)}
                                                    onChange={(e) => setQa({ ...qa, vatRate: Number(e.target.value) })}
                                                    aria-label="Umsatzsteuer Prozentsatz"
                                                >
                                                    <option value="0">0% (steuerfrei)</option>
                                                    <option value="7">7%</option>
                                                    <option value="19">19%</option>
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="row">
                                {/* Budget Zuordnungen (mehrfach möglich) */}
                                <div className="field" style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Budget
                                        <button
                                            type="button"
                                            className="btn ghost"
                                            style={{ padding: '2px 6px', fontSize: '0.85rem' }}
                                            onClick={() => {
                                                const currentBudgets = qa.budgets || []
                                                setQa({ ...qa, budgets: [...currentBudgets, { budgetId: 0, amount: (qa as any).grossAmount || 0 }] })
                                            }}
                                            title="Weiteres Budget hinzufügen"
                                        >+</button>
                                    </label>
                                    {(() => {
                                        const budgetsList = qa.budgets || []
                                        const budgetIds = budgetsList.filter((b: BudgetAssignment) => b.budgetId).map((b: BudgetAssignment) => b.budgetId)
                                        const hasDuplicateBudgets = new Set(budgetIds).size !== budgetIds.length
                                        const totalBudgetAmount = budgetsList.reduce((sum: number, b: BudgetAssignment) => sum + (b.amount || 0), 0)
                                        const grossAmt = Number((qa as any).grossAmount) || 0
                                        const exceedsTotal = totalBudgetAmount > grossAmt * 1.001
                                        return budgetsList.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {budgetsList.map((ba: BudgetAssignment, idx: number) => {
                                                    const isDuplicate = budgetIds.filter((id: number) => id === ba.budgetId).length > 1
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            <select
                                                                style={{ flex: 1, borderColor: isDuplicate ? 'var(--danger)' : undefined }}
                                                                value={ba.budgetId || ''}
                                                                onChange={(e) => {
                                                                    const newBudgets = [...budgetsList]
                                                                    newBudgets[idx] = { ...newBudgets[idx], budgetId: e.target.value ? Number(e.target.value) : 0 }
                                                                    setQa({ ...qa, budgets: newBudgets })
                                                                }}
                                                            >
                                                                <option value="">— Budget wählen —</option>
                                                                {budgetsForEdit.map(b => (
                                                                    <option key={b.id} value={b.id}>{b.label}</option>
                                                                ))}
                                                            </select>
                                                            <span className="adorn-wrap" style={{ width: 110 }}>
                                                                <input
                                                                    className="input"
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={ba.amount ?? ''}
                                                                    onChange={(e) => {
                                                                        const newBudgets = [...budgetsList]
                                                                        newBudgets[idx] = { ...newBudgets[idx], amount: e.target.value ? Number(e.target.value) : 0 }
                                                                        setQa({ ...qa, budgets: newBudgets })
                                                                    }}
                                                                    title="Betrag für dieses Budget"
                                                                />
                                                                <span className="adorn-suffix">€</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn ghost"
                                                                style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                                                onClick={() => {
                                                                    const newBudgets = budgetsList.filter((_: any, i: number) => i !== idx)
                                                                    setQa({ ...qa, budgets: newBudgets })
                                                                }}
                                                                title="Entfernen"
                                                            >✕</button>
                                                        </div>
                                                    )
                                                })}
                                                {hasDuplicateBudgets && (
                                                    <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Ein Budget kann nur einmal zugeordnet werden</div>
                                                )}
                                                {exceedsTotal && (
                                                    <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Summe ({totalBudgetAmount.toFixed(2)} €) übersteigt Buchungsbetrag ({grossAmt.toFixed(2)} €)</div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="helper" style={{ fontStyle: 'italic', opacity: 0.7 }}>Kein Budget zugeordnet. Klicke + zum Hinzufügen.</div>
                                        )
                                    })()}
                                </div>
                            </div>
                            <div className="row">
                                {/* Zweckbindung Zuordnungen (mehrfach möglich) */}
                                <div className="field" style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Zweckbindung
                                        <button
                                            type="button"
                                            className="btn ghost"
                                            style={{ padding: '2px 6px', fontSize: '0.85rem' }}
                                            onClick={() => {
                                                const currentEarmarks = qa.earmarksAssigned || []
                                                setQa({ ...qa, earmarksAssigned: [...currentEarmarks, { earmarkId: 0, amount: (qa as any).grossAmount || 0 }] })
                                            }}
                                            title="Weitere Zweckbindung hinzufügen"
                                        >+</button>
                                    </label>
                                    {(() => {
                                        const earmarksList = qa.earmarksAssigned || []
                                        const earmarkIds = earmarksList.filter((e: EarmarkAssignment) => e.earmarkId).map((e: EarmarkAssignment) => e.earmarkId)
                                        const hasDuplicateEarmarks = new Set(earmarkIds).size !== earmarkIds.length
                                        const totalEarmarkAmount = earmarksList.reduce((sum: number, e: EarmarkAssignment) => sum + (e.amount || 0), 0)
                                        const grossAmt = Number((qa as any).grossAmount) || 0
                                        const exceedsTotal = totalEarmarkAmount > grossAmt * 1.001
                                        return earmarksList.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {earmarksList.map((ea: EarmarkAssignment, idx: number) => {
                                                    const isDuplicate = earmarkIds.filter((id: number) => id === ea.earmarkId).length > 1
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            <select
                                                                style={{ flex: 1, borderColor: isDuplicate ? 'var(--danger)' : undefined }}
                                                                value={ea.earmarkId || ''}
                                                                onChange={(e) => {
                                                                    const newEarmarks = [...earmarksList]
                                                                    newEarmarks[idx] = { ...newEarmarks[idx], earmarkId: e.target.value ? Number(e.target.value) : 0 }
                                                                    setQa({ ...qa, earmarksAssigned: newEarmarks })
                                                                }}
                                                            >
                                                                <option value="">— Zweckbindung wählen —</option>
                                                                {earmarks.map(em => (
                                                                    <option key={em.id} value={em.id}>{em.code} – {em.name}</option>
                                                                ))}
                                                            </select>
                                                            <span className="adorn-wrap" style={{ width: 110 }}>
                                                                <input
                                                                    className="input"
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={ea.amount ?? ''}
                                                                    onChange={(e) => {
                                                                        const newEarmarks = [...earmarksList]
                                                                        newEarmarks[idx] = { ...newEarmarks[idx], amount: e.target.value ? Number(e.target.value) : 0 }
                                                                        setQa({ ...qa, earmarksAssigned: newEarmarks })
                                                                    }}
                                                                    title="Betrag für diese Zweckbindung"
                                                                />
                                                                <span className="adorn-suffix">€</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn ghost"
                                                                style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                                                onClick={() => {
                                                                    const newEarmarks = earmarksList.filter((_: any, i: number) => i !== idx)
                                                                    setQa({ ...qa, earmarksAssigned: newEarmarks })
                                                                }}
                                                                title="Entfernen"
                                                            >✕</button>
                                                        </div>
                                                    )
                                                })}
                                                {hasDuplicateEarmarks && (
                                                    <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Eine Zweckbindung kann nur einmal zugeordnet werden</div>
                                                )}
                                                {exceedsTotal && (
                                                    <div className="helper" style={{ color: 'var(--danger)' }}>⚠ Summe ({totalEarmarkAmount.toFixed(2)} €) übersteigt Buchungsbetrag ({grossAmt.toFixed(2)} €)</div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="helper" style={{ fontStyle: 'italic', opacity: 0.7 }}>Keine Zweckbindung zugeordnet. Klicke + zum Hinzufügen.</div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Blocks C+D in a side-by-side grid */}
                    <div className="block-grid block-grid-mb">
                        {/* Block C – Beschreibung & Tags */}
                        <div className="card form-card">
                            <div className="helper helper-mb">Beschreibung & Tags</div>
                            <div className="row">
                                <div className="field field-full-width">
                                    <label>Beschreibung</label>
                                    <input className="input" list="desc-suggestions" value={qa.description} onChange={(e) => setQa({ ...qa, description: e.target.value })} placeholder="z. B. Mitgliedsbeitrag, Spende …" />
                                    <datalist id="desc-suggestions">
                                        {descSuggest.map((d, i) => (<option key={i} value={d} />))}
                                    </datalist>
                                </div>
                                <TagsEditor
                                    label="Tags"
                                    value={(qa as any).tags || []}
                                    onChange={(tags) => setQa({ ...(qa as any), tags } as any)}
                                    tagDefs={tagDefs}
                                />

                                {taxonomiesForCreate.length > 0 && (
                                    <div className="field field-full-width" style={{ marginTop: 8 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>🏷️</span> Klassifizierung
                                        </label>
                                        {loadingTaxonomiesForCreate ? (
                                            <div className="helper">Lade Taxonomien…</div>
                                        ) : (
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: `repeat(auto-fit, minmax(${taxonomiesForCreate.length === 1 ? '200px' : '140px'}, 1fr))`,
                                                gap: 12,
                                                padding: '10px 12px',
                                                background: 'color-mix(in oklab, var(--accent) 5%, transparent)',
                                                borderRadius: 8,
                                                border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)'
                                            }}>
                                                {taxonomiesForCreate.map((tx) => {
                                                    const terms = taxonomyTermsById[tx.id] || []
                                                    const sel = (((qa as any).taxonomySelectionById || {}) as Record<number, number | ''>)[tx.id] ?? ''
                                                    return (
                                                        <div key={tx.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>{tx.name}</label>
                                                            <select
                                                                className="input"
                                                                style={{ fontSize: 13, padding: '6px 8px' }}
                                                                value={sel as any}
                                                                onChange={(e) => {
                                                                    const next = e.target.value ? Number(e.target.value) : ''
                                                                    const prev = (((qa as any).taxonomySelectionById || {}) as Record<number, number | ''>)
                                                                    setQa({
                                                                        ...(qa as any),
                                                                        taxonomySelectionById: { ...prev, [tx.id]: next }
                                                                    } as any)
                                                                }}
                                                            >
                                                                <option value="">— keine —</option>
                                                                {terms.map((t) => (
                                                                    <option key={t.id} value={t.id}>
                                                                        {t.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Block D – Anhänge */}
                        {!hideAttachments && (
                            <div
                                className="card attachment-card"
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropFiles(e.dataTransfer?.files) }}
                            >
                                <div className="attachment-header">
                                    <div className="attachment-title">
                                        <strong>Anhänge</strong>
                                        {files.length > 0 && <div className="helper">Dateien hierher ziehen</div>}
                                    </div>
                                    <div className="flex-gap-8">
                                        <input ref={fileInputRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={(e) => onDropFiles(e.target.files)} />
                                        <button type="button" className="btn" onClick={openFilePicker}>+ Datei(en)</button>
                                        {files.length > 0 && (
                                            <button type="button" className="btn" onClick={() => setFiles([])}>Leeren</button>
                                        )}
                                    </div>
                                </div>
                                {files.length > 0 ? (
                                    <ul className="file-list">
                                        {files.map((f, i) => (
                                            <li key={i} className="file-list-item">
                                                <span className="file-name">{f.name}</span>
                                                <button type="button" className="btn" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>Entfernen</button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div
                                        style={{
                                            marginTop: 8,
                                            padding: 20,
                                            border: '2px dashed var(--border)',
                                            borderRadius: 8,
                                            textAlign: 'center',
                                            cursor: 'pointer'
                                        }}
                                        onClick={openFilePicker}
                                    >
                                        <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
                                        <div className="helper">Dateien hierher ziehen oder klicken</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
