import React, { useEffect, useState } from 'react'

// Resolve app icon for titlebar (works with Vite bundling)
const appLogo: string = new URL('../../../../build/Icon.ico', import.meta.url).href

export default function TopHeaderOrg() {
    const [org, setOrg] = useState<string>('')
    const [cashier, setCashier] = useState<string>('')
    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const on = await (window as any).api?.settings?.get?.({ key: 'org.name' })
                const cn = await (window as any).api?.settings?.get?.({ key: 'org.cashier' })
                if (!cancelled) {
                    setOrg((on?.value as any) || '')
                    setCashier((cn?.value as any) || '')
                }
            } catch { /* noop */ }
        }
        load()
        const onChanged = () => load()
        window.addEventListener('data-changed', onChanged)
        return () => { cancelled = true; window.removeEventListener('data-changed', onChanged) }
    }, [])
    const text = [org || null, cashier || null].filter(Boolean).join(' | ')
    return (
        <div className="top-header-org">
            <img className="top-header-org__logo" src={appLogo} alt="BudgetO" width={20} height={20} />
            {text ? (
                <div className="helper top-header-org__text" title={text}>{text}</div>
            ) : null}
        </div>
    )
}
