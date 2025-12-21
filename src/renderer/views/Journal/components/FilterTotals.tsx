import React, { useState, useEffect, useMemo } from 'react'

interface FilterTotalsProps {
    refreshKey?: number
    from?: string
    to?: string
    paymentMethod?: 'BAR' | 'BANK'
    sphere?: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    type?: 'IN' | 'OUT' | 'TRANSFER'
    earmarkId?: number
    budgetId?: number | null
    q?: string
    tag?: string
}

export default function FilterTotals({ refreshKey, from, to, paymentMethod, sphere, type, earmarkId, budgetId, q, tag }: FilterTotalsProps) {
    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState<{ inGross: number; outGross: number; diff: number } | null>(null)

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
                    const res = await window.api?.reports.summary?.({ from, to, paymentMethod, sphere, type, earmarkId, q, tag })
                    if (alive && res) {
                        const t = res.byType || []
                        const inGross = t.find((x: any) => x.key === 'IN')?.gross || 0
                        const outGrossRaw = t.find((x: any) => x.key === 'OUT')?.gross || 0
                        const outGross = Math.abs(outGrossRaw)
                        const diff = Math.round((inGross - outGross) * 100) / 100
                        setValues({ inGross, outGross, diff })
                    }
                }
            } finally {
                if (alive) setLoading(false)
            }
        }
        run()
        return () => { alive = false }
    }, [from, to, paymentMethod, sphere, type, earmarkId, budgetId, q, tag, refreshKey])

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
    return (
        <div className="card" style={{ padding: 8, marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Summe der Filterung:</strong>
                <span style={{ color: 'var(--success)' }}>IN: {fmt.format(values?.inGross ?? 0)}</span>
                <span style={{ color: 'var(--danger)' }}>OUT: {fmt.format(values?.outGross ?? 0)}</span>
                <span style={{ color: ((values?.diff ?? 0) >= 0) ? 'var(--success)' : 'var(--danger)' }}>Differenz: {fmt.format(values?.diff ?? 0)}</span>
            </div>

            {(annual || annualLoading) && (
                <div style={{ textAlign: 'right', display: 'grid', gap: 2, minWidth: 180 }}>
                    <div className="helper" style={{ margin: 0 }}>
                        Jahresbudget {annual?.year ?? annualYear}
                    </div>
                    <div style={{ fontWeight: 600, color: (annual?.remaining ?? 0) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {fmt.format(annual?.remaining ?? 0)} verbleibend
                    </div>
                </div>
            )}
        </div>
    )
}
