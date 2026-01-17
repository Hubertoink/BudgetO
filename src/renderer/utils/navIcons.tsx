import React from 'react'
import type { NavKey } from './navItems'

export function getNavIcon(key: NavKey): React.ReactNode {
  switch (key) {
    case 'Dashboard':
      // Home icon
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      )
    case 'Buchungen':
      // List with checkmarks - journal/ledger look
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z"/>
        </svg>
      )
    case 'Verbindlichkeiten':
      // Invoice/Bill with euro symbol
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      )
    case 'Barvorschüsse':
      // Wallet/Cash icon
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 7H3c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 11H3V9h18v9z"/>
          <path d="M3 4h18v2H3V4z"/>
          <circle cx="16" cy="13.5" r="2"/>
        </svg>
      )
    case 'Mitglieder':
      // Two people - kept similar but refined
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      )
    case 'Budgets':
      // Pie chart - centered and balanced
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 2v9H2c0 4.97 4.03 9 9 9s9-4.03 9-9-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7h7V4c3.87 0 7 3.13 7 7s-3.13 7-7 7z"/>
          <path d="M13 2.05v8.95h8.95c-.47-4.72-4.23-8.48-8.95-8.95z"/>
        </svg>
      )
    case 'Zweckbindungen':
      // Target/Bullseye icon
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      )
    case 'Übungsleiter':
      // Person with star/badge - coach/trainer
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          <path d="M20 8l-1.5 1.5L20 11l-2 .5.5 2-1.5-1.5L15.5 13.5l.5-2-2-.5 1.5-1.5L14 8l2 .5-.5-2 1.5 1.5L18.5 6.5l-.5 2 2 .5z"/>
        </svg>
      )
    case 'Einreichungen':
      // Upload/Inbox arrow
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
        </svg>
      )
    case 'Belege':
      // Receipt/Ticket - refined
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16l4-2 4 2 4-2 4 2V4c0-1.1-.9-2-2-2zm0 15.5l-2-1-4 2-4-2-2 1V4h12v13.5z"/>
          <path d="M8 8h8v2H8V8zm0 4h5v2H8v-2z"/>
        </svg>
      )
    case 'Reports':
      // Bar chart icon
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M5 9.2h3v9.8H5V9.2zm5.5-4.2H14v14h-3.5V5zM16 13h3v6h-3v-6z"/>
        </svg>
      )
    case 'Einstellungen':
      // Gear/Cog - refined
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>
        </svg>
      )
    default:
      return null
  }
}

export const navIconPalette: Record<NavKey, string> = {
  Dashboard: '#7C4DFF',
  Buchungen: '#2962FF',
  Verbindlichkeiten: '#00B8D4',
  Barvorschüsse: '#00C853',
  Mitglieder: '#26A69A',
  Budgets: '#00C853',
  Zweckbindungen: '#FFD600',
  Übungsleiter: '#FF5722',
  Einreichungen: '#FF7043',
  Belege: '#FF9100',
  Reports: '#F50057',
  Einstellungen: '#9C27B0'
}
