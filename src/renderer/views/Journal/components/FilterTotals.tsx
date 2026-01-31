import React, { useState, useEffect, useMemo } from 'react'
import HoverTooltip from '../../../components/common/HoverTooltip'

interface FilterTotalsProps {
    refreshKey?: number
    from?: string
    to?: string
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    categoryId?: number
    type?: 'IN' | 'OUT' | 'TRANSFER'
    earmarkId?: number
    budgetId?: number | null
    q?: string
    tag?: string
    // Archive mode: when showArchived is false and no explicit date filter, limit to workYear
    workYear?: number
    showArchived?: boolean
}

const SPHERE_LABELS: Record<string, string> = {
    IDEELL: 'Ideeller Bereich',
    ZWECK: 'Zweckbetrieb',
    VERMOEGEN: 'Vermögensverwaltung',
    WGB: 'Wirtschaftlicher Geschäftsbetrieb'
}

const SPHERE_COLORS: Record<string, string> = {
    IDEELL: 'var(--sphere-ideell)',
    ZWECK: 'var(--sphere-zweck)',
    VERMOEGEN: 'var(--sphere-vermoegen)',
    WGB: 'var(--sphere-wgb)'
}

// Tooltip list component for hover cards
function TooltipList({
    title,
    rows,
    hint
}: {
    title: string
    rows: Array<{ key: string; value: string; dotColor?: string }>
    hint?: string
}) {
    return (
        <div>
            <div className="tooltip-modal__title">{title}</div>
            {rows.length > 0 && (
                <div className="tooltip-modal__list">
                    {rows.map((r) => (
                        <div key={r.key} className="tooltip-modal__row">
                            <span className="tooltip-modal__key" style={{ '--tooltip-dot': r.dotColor || 'var(--border)' } as React.CSSProperties}>
                                <span className="tooltip-modal__dot" />
                                {r.key}
                            </span>
                            <span className="tooltip-modal__val">{r.value}</span>
                        </div>
                    ))}
                </div>
            )}
            {hint && <div className="tooltip-modal__hint">{hint}</div>}
        </div>
    )
}


export default function FilterTotals({ refreshKey, from, to, paymentMethod, sphere, categoryId, type, earmarkId, budgetId, q, tag, workYear, showArchived }: FilterTotalsProps) {
    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState<null | {
        inGross: number
        outGross: number
        diff: number
        bySphere?: Array<{ key: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'; gross: number }>
        inByCategory?: Array<{ name: string; gross: number; color?: string | null }>
        outByCategory?: Array<{ name: string; gross: number; color?: string | null }>
    }>(null)

    const annualYear = useMemo(() => {
        const parseYear = (s?: string) => {
            if (!s) return null
            const m = /^\s*(\d{4})-/.exec(String(s))
            if (m) return Number(m[1])
            const d = new Date(String(s))
            return Number.isFinite(d.getTime()) ? d.getFullYear() : null
        }
        const yFrom = parseYear(from)
        const yTo = parseYear(to)
        if (yFrom && yTo && yFrom !== yTo) return null
        return yFrom ?? yTo ?? new Date().getFullYear()
    }, [from, to])

    const [annual, setAnnual] = useState<null | { year: number; budgeted: number; remaining: number }>(null)
    const [annualLoading, setAnnualLoading] = useState(false)

    useEffect(() => {
        let alive = true
        async function run() {
            setLoading(true)
            try {
                if (typeof budgetId === 'number') {
                    const u = await window.api?.budgets.usage?.({ budgetId, from, to })
                    const inflow = Math.max(0, Number(u?.inflow || 0))
                    const spent = Math.max(0, Number(u?.spent || 0))
                    const diff = Math.round((inflow - spent) * 100) / 100
                    if (alive) setValues({ inGross: inflow, outGross: spent, diff })
                } else {
                    const effectiveShowArchived = showArchived ?? false
                    const basePayload = {
                        from,
                        to,
                        paymentMethod,
                        sphere,
                        categoryId,
                        earmarkId,
                        q,
                        tag,
                        workYear: effectiveShowArchived === false ? workYear : undefined,
                        showArchived: effectiveShowArchived
                    }
                    const res = await window.api?.reports.summary?.({ ...basePayload, type })
                    // Fetch type-specific category breakdowns for tooltips
                    let inCat: any = null
                    let outCat: any = null
                    if (!type) {
                        const [inRes, outRes] = await Promise.all([
                            window.api?.reports.byCategory?.({ ...basePayload, type: 'IN' }),
                            window.api?.reports.byCategory?.({ ...basePayload, type: 'OUT' })
                        ])
                        inCat = inRes || null
                        outCat = outRes || null
                    } else if (type === 'IN') {
                        inCat = (await window.api?.reports.byCategory?.({ ...basePayload, type: 'IN' })) || null
                    } else if (type === 'OUT') {
                        outCat = (await window.api?.reports.byCategory?.({ ...basePayload, type: 'OUT' })) || null
                    }
                    
                    if (alive && res) {
                        const t = res.byType || []
                        const inGross = t.find((x: any) => x.key === 'IN')?.gross || 0
                        const outGrossRaw = t.find((x: any) => x.key === 'OUT')?.gross || 0
                        const outGross = Math.abs(outGrossRaw)
                        const diff = Math.round((inGross - outGross) * 100) / 100
                        const bySphereRaw = Array.isArray(res.bySphere) ? res.bySphere : []
                        const bySphere = bySphereRaw
                            .map((s: any) => ({ key: s.key as any, gross: Number(s.gross || 0) }))
                            .filter((s: any) => s.key && Number.isFinite(s.gross))

                        const normalizeCategoryRows = (input: any) => {
                            const rows = Array.isArray(input?.rows) ? input.rows : []
                            return rows
                                .map((r: any) => ({
                                    name: String(r?.categoryName ?? 'Ohne Kategorie'),
                                    gross: Math.abs(Number(r?.gross || 0)),
                                    color: (typeof r?.categoryColor === 'string' ? r.categoryColor : null) as string | null
                                }))
                                .filter((r: any) => r.name && Number.isFinite(r.gross) && r.gross !== 0)
                                .sort((a: any, b: any) => b.gross - a.gross)
                        }

                        const inByCategory = normalizeCategoryRows(inCat)
                        const outByCategory = normalizeCategoryRows(outCat)

                        setValues({ inGross, outGross, diff, bySphere, inByCategory, outByCategory })
                    }
                }
            } finally {
                if (alive) setLoading(false)
            }
        }
        run()
        return () => { alive = false }
    }, [from, to, paymentMethod, sphere, categoryId, type, earmarkId, budgetId, q, tag, workYear, showArchived, refreshKey])

    useEffect(() => {
        let alive = true
        async function loadAnnual() {
            if (!annualYear) {
                setAnnual(null)
                return
            }
            setAnnualLoading(true)
            try {
                const [budget, usageRes] = await Promise.all([
                    (window as any).api?.annualBudgets?.get?.({ year: annualYear, costCenterId: null }),
                    (window as any).api?.annualBudgets?.usage?.({ year: annualYear, costCenterId: null })
                ])
                const budgeted = Number(usageRes?.budgeted ?? budget?.amount ?? 0) || 0
                if (budgeted <= 0) {
                    if (alive) setAnnual(null)
                    return
                }
                const spent = Math.max(0, Number(usageRes?.spent ?? 0))
                const income = Math.max(0, Number(usageRes?.income ?? 0))
                const remaining = Number(usageRes?.remaining ?? (budgeted - Math.max(0, spent - income))) || 0
                if (alive) setAnnual({ year: annualYear, budgeted, remaining })
            } catch {
                if (alive) setAnnual(null)
            } finally {
                if (alive) setAnnualLoading(false)
            }
        }
        loadAnnual()
        return () => { alive = false }
    }, [annualYear, refreshKey])

    const fmt = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
    if (!values && !loading) return null

    const inVal = values?.inGross ?? 0
    const outVal = values?.outGross ?? 0
    const diffVal = values?.diff ?? 0
    const total = inVal + outVal
    const inPercent = total > 0 ? (inVal / total) * 100 : 50

    const spheres = (values?.bySphere || [])
        .filter((s) => Math.abs(Number(s.gross || 0)) > 0.000001)
        .map((s) => ({ key: s.key, gross: Math.abs(Number(s.gross || 0)) }))
        .sort((a, b) => b.gross - a.gross)

    const buildCategoryTooltip = (rows: Array<{ name: string; gross: number; color?: string | null }>) => {
        const max = 8
        const shown = rows.slice(0, max)
        const remaining = Math.max(0, rows.length - shown.length)
        return {
            rows: shown.map((r) => ({
                key: r.name,
                value: fmt.format(r.gross),
                dotColor: r.color || 'var(--border)'
            })),
            hint: remaining > 0 ? `+${remaining} weitere` : undefined
        }
    }

    const inCategory = buildCategoryTooltip(values?.inByCategory || [])
    const outCategory = buildCategoryTooltip(values?.outByCategory || [])

    return (
        <div className="filter-totals-card">
            {/* Visual Flow Bar */}
            <div className="filter-totals-flow" aria-label="Einnahmen vs Ausgaben">
                <div className="filter-totals-flow__in" style={{ width: `${inPercent}%` }} />
                <div className="filter-totals-flow__out" style={{ width: `${100 - inPercent}%` }} />
            </div>

            <div className="filter-totals-row">
                <div className="filter-totals-stats" aria-label="Summen">
                    {/* IN Card with Hover Tooltip */}
                    <HoverTooltip
                        className="tooltip-modal"
                        content={
                            <TooltipList
                                title={inCategory.rows.length > 0 ? 'Einnahmen · Verteilung nach Kategorie' : 'Einnahmen'}
                                rows={inCategory.rows.length > 0 ? inCategory.rows : [{ key: 'Summe', value: fmt.format(inVal), dotColor: 'var(--success)' }]}
                                hint={inCategory.rows.length > 0 ? inCategory.hint : undefined}
                            />
                        }
                    >
                        {({ ref, props }) => (
                            <div ref={ref} {...props} className="filter-totals-stat filter-totals-stat--in" tabIndex={0}>
                                <div className="filter-totals-stat__icon" aria-hidden>↓</div>
                                <div className="filter-totals-stat__content">
                                    <span className="filter-totals-stat__label">Einnahmen</span>
                                    <span className="filter-totals-stat__value">{fmt.format(inVal)}</span>
                                </div>
                            </div>
                        )}
                    </HoverTooltip>

                    {/* OUT Card with Hover Tooltip */}
                    <HoverTooltip
                        className="tooltip-modal"
                        content={
                            <TooltipList
                                title={outCategory.rows.length > 0 ? 'Ausgaben · Verteilung nach Kategorie' : 'Ausgaben'}
                                rows={outCategory.rows.length > 0 ? outCategory.rows : [{ key: 'Summe', value: fmt.format(outVal), dotColor: 'var(--danger)' }]}
                                hint={outCategory.rows.length > 0 ? outCategory.hint : undefined}
                            />
                        }
                    >
                        {({ ref, props }) => (
                            <div ref={ref} {...props} className="filter-totals-stat filter-totals-stat--out" tabIndex={0}>
                                <div className="filter-totals-stat__icon" aria-hidden>↑</div>
                                <div className="filter-totals-stat__content">
                                    <span className="filter-totals-stat__label">Ausgaben</span>
                                    <span className="filter-totals-stat__value">{fmt.format(outVal)}</span>
                                </div>
                            </div>
                        )}
                    </HoverTooltip>

                    {/* Diff Card with Hover Tooltip */}
                    <HoverTooltip
                        className="tooltip-modal"
                        content={
                            <TooltipList
                                title={diffVal >= 0 ? 'Überschuss' : 'Defizit'}
                                rows={[
                                    { key: 'Einnahmen', value: fmt.format(inVal), dotColor: 'var(--success)' },
                                    { key: 'Ausgaben', value: fmt.format(outVal), dotColor: 'var(--danger)' },
                                    { key: diffVal >= 0 ? 'Mehr eingenommen' : 'Mehr ausgegeben', value: fmt.format(Math.abs(diffVal)), dotColor: diffVal >= 0 ? 'var(--success)' : 'var(--danger)' }
                                ]}
                            />
                        }
                    >
                        {({ ref, props }) => (
                            <div ref={ref} {...props} className={`filter-totals-stat filter-totals-stat--diff ${diffVal >= 0 ? 'positive' : 'negative'}`} tabIndex={0}>
                                <div className="filter-totals-stat__icon" aria-hidden>{diffVal >= 0 ? '✓' : '!'}</div>
                                <div className="filter-totals-stat__content">
                                    <span className="filter-totals-stat__label">{diffVal >= 0 ? 'Überschuss' : 'Defizit'}</span>
                                    <span className="filter-totals-stat__value">{fmt.format(Math.abs(diffVal))}</span>
                                </div>
                            </div>
                        )}
                    </HoverTooltip>
                </div>

                {(annual || annualLoading) && (
                    <div className="filter-totals-annual" aria-label="Jahresbudget">
                        <div className="helper" style={{ margin: 0 }}>
                            Jahresbudget {annual?.year ?? annualYear}
                        </div>
                        <div className="filter-totals-annual__value" style={{ color: (annual?.remaining ?? 0) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {fmt.format(annual?.remaining ?? 0)} verbleibend
                        </div>
                    </div>
                )}
            </div>

            {/* Sphere breakdown mini badges */}
            {spheres.length > 1 && (
                <div className="filter-totals-spheres" aria-label="Summen nach Sphäre">
                    {spheres.map((s) => (
                        <HoverTooltip
                            key={s.key}
                            className="tooltip-modal"
                            content={
                                <TooltipList
                                    title={SPHERE_LABELS[s.key] || s.key}
                                    rows={[{ key: 'Betrag', value: fmt.format(s.gross), dotColor: SPHERE_COLORS[s.key] || 'var(--border)' }]}
                                />
                            }
                        >
                            {({ ref, props }) => (
                                <span
                                    ref={ref}
                                    {...props}
                                    className="filter-totals-sphere-badge"
                                    style={{ '--sphere-color': SPHERE_COLORS[s.key] || 'var(--border)' } as React.CSSProperties}
                                >
                                    <span className="filter-totals-sphere-badge__dot" aria-hidden />
                                    <span className="filter-totals-sphere-badge__label">{s.key}</span>
                                    <span className="filter-totals-sphere-badge__value">{fmt.format(s.gross)}</span>
                                </span>
                            )}
                        </HoverTooltip>
                    ))}
                </div>
            )}
        </div>
    )
}
