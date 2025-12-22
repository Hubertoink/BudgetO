import React from 'react'

// Resolve app icon for titlebar (works with Vite bundling)
const appLogo: string = new URL('../../../../assets/Budget_Logo.ico', import.meta.url).href

export default function TopHeaderOrg() {
    return (
        <div className="top-header-org">
            <img className="top-header-org__logo" src={appLogo} alt="BudgetO" width={24} height={24} />
        </div>
    )
}
