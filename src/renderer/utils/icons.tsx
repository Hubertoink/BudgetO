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

export const IconEdit = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconTrash = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconPause = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
)

export const IconPlay = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 4v16l13-8L7 4z" />
    </svg>
)

export const IconSkip = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 5l10 7L5 19V5zM19 5v14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconDraft = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
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
