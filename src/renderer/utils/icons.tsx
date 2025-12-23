import React from 'react'
import { ICONS } from './icons.constants'

// React Icon-Komponenten
export const IconBank = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 6h12M2 6l6-4 6 4M2 6v6a1 1 0 001 1h10a1 1 0 001-1V6M4 8v3M8 8v3M12 8v3M2 14h12" strokeLinecap="round" />
    </svg>
)

export const IconCash = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="12" height="8" rx="1" />
        <circle cx="8" cy="8" r="2" />
    </svg>
)

export const IconTransfer = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 5h10M10 2l3 3-3 3M13 11H3M6 14L3 11l3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconArrow = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

// Helper für Zahlweg-Icons (React)
export function PaymentMethodIcon({ method, size = 14 }: { method: 'BAR' | 'BANK' | null | undefined; size?: number }) {
    if (method === 'BANK') return <IconBank size={size} />
    if (method === 'BAR') return <IconCash size={size} />
    return <span>{ICONS.EMPTY}</span>
}

// Helper für Transfer-Anzeige mit Icons
export function TransferDisplay({ from, to, size = 14 }: { from: 'BAR' | 'BANK' | null | undefined; to: 'BAR' | 'BANK' | null | undefined; size?: number }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {from === 'BAR' ? <IconCash size={size} /> : from === 'BANK' ? <IconBank size={size} /> : ICONS.EMPTY}
            <IconArrow size={size} />
            {to === 'BAR' ? <IconCash size={size} /> : to === 'BANK' ? <IconBank size={size} /> : ICONS.EMPTY}
        </span>
    )
}
