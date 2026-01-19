import React, { useEffect, useMemo, useState } from 'react'
import FilterDropdown from './FilterDropdown'

interface InviteEmailDropdownProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  status: 'ALL' | 'ACTIVE' | 'NEW' | 'PAUSED' | 'LEFT'
  query: string

  inviteBusy: boolean
  inviteEmails: string[]

  inviteActiveOnly: boolean
  onInviteActiveOnlyChange: (v: boolean) => void

  subject: string
  onSubjectChange: (v: string) => void

  body: string
  onBodyChange: (v: string) => void
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

export default function InviteEmailDropdown({
  open,
  onOpenChange,
  status,
  query,
  inviteBusy,
  inviteEmails,
  inviteActiveOnly,
  onInviteActiveOnlyChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange
}: InviteEmailDropdownProps) {
  const [orgName, setOrgName] = useState<string>('')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await (window as any).api?.organizations?.active?.()
        const name = String(res?.organization?.name || '')
        if (!cancelled) setOrgName(name)
      } catch {
        if (!cancelled) setOrgName('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const inviteCount = inviteEmails.length

  const bccSemicolon = useMemo(() => inviteEmails.join('; '), [inviteEmails])
  const bccComma = useMemo(() => inviteEmails.join(','), [inviteEmails])

  const mailto = useMemo(() => {
    const s = encodeURIComponent(subject || '')
    const b = encodeURIComponent(body || '')
    const bcc = encodeURIComponent(bccComma)
    return `mailto:?bcc=${bcc}&subject=${s}&body=${b}`
  }, [subject, body, bccComma])

  const canOpenMailClient = mailto.length <= 1800 && inviteCount <= 50

  const today = useMemo(() => {
    try {
      return new Date().toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch {
      return ''
    }
  }, [])

  async function copyBcc() {
    try {
      await navigator.clipboard.writeText(bccSemicolon)
      setCopyMsg(inviteCount ? `${inviteCount} E-Mail-Adresse${inviteCount > 1 ? 'n' : ''} kopiert (BCC).` : 'Keine E-Mail-Adressen vorhanden.')
    } catch {
      setCopyMsg('Kopieren nicht möglich')
    }
  }

  function openMailClient() {
    if (!inviteCount) return
    if (canOpenMailClient) {
      try {
        window.location.href = mailto
      } catch {
        // ignore
      }
      return
    }
    void copyBcc()
  }

  return (
    <FilterDropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <span className="invite-dropdown__trigger">
          <MailIcon />
          <span className="invite-dropdown__trigger-label">Einladen</span>
        </span>
      }
      title="Einladung per E-Mail"
      hasActiveFilters={false}
      alignRight
      width="min(980px, 92vw)"
      ariaLabel="Einladung per E-Mail"
      buttonTitle="Alle gefilterten Mitglieder per E-Mail einladen"
      colorVariant="action"
    >
      <div className="invite-dropdown">
        <div className="invite-dropdown__top">
          <div className="helper invite-dropdown__summary">Aktuelle Filter: Status = {status}, Suche = {query ? `"${query}"` : '—'}</div>
          <label className="helper invite-dropdown__toggle">
            <input
              type="checkbox"
              checked={inviteActiveOnly}
              onChange={(e) => onInviteActiveOnlyChange(e.target.checked)}
            />
            Nur aktive einladen
          </label>
        </div>

        <div className="invite-dropdown__grid">
          <section className="card invite-dropdown__edit">
            <div className="invite-dropdown__fields">
              <div className="field">
                <label>Betreff</label>
                <input className="input" value={subject} onChange={(e) => onSubjectChange(e.target.value)} />
              </div>

              <div className="field">
                <label>Nachricht</label>
                <textarea
                  className="input invite-dropdown__textarea"
                  rows={10}
                  value={body}
                  onChange={(e) => onBodyChange(e.target.value)}
                />
              </div>
            </div>

            <div className="invite-dropdown__actions">
              <div className="helper">{inviteBusy ? 'Sammle E-Mail-Adressen…' : `${inviteCount} Empfänger gefunden`}</div>
              <div className="invite-dropdown__actions-right">
                <button
                  className="btn ghost has-tooltip invite-dropdown__icon-btn"
                  data-tooltip="BCC kopieren"
                  aria-label="BCC kopieren"
                  onClick={copyBcc}
                  disabled={!inviteCount}
                >
                  <CopyIcon />
                </button>
                <button
                  className="btn primary has-tooltip invite-dropdown__icon-btn"
                  data-tooltip="Absenden"
                  aria-label="Im Mail-Programm öffnen"
                  onClick={openMailClient}
                  disabled={!inviteCount}
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            {!canOpenMailClient && inviteCount > 0 && (
              <div className="helper invite-dropdown__hint">
                Hinweis: Der Mail-Link wäre zu lang oder es sind zu viele Empfänger. Kopiere die BCC-Liste und füge sie im Mail-Programm ein.
              </div>
            )}
          </section>

          <section className="invite-letter">
            <div className="invite-letter__paper">
              <div className="invite-letter__stamp">
                <span className="invite-letter__stamp-count">{inviteCount}</span>
                <span className="invite-letter__stamp-label">BCC</span>
              </div>
              <div className="invite-letter__letterhead">
                <div className="invite-letter__org">{orgName || 'Absender'}</div>
                <div className="invite-letter__date">{today}</div>
              </div>
              <div className="invite-letter__subject">{subject || 'Kein Betreff'}</div>
              <div className="invite-letter__rule" />
              <div className="invite-letter__body">{body || '—'}</div>
              <div className="invite-letter__signature">— {orgName || 'Absender'}</div>
            </div>

            <details className="invite-letter__recipients">
              <summary>Empfänger anzeigen (BCC)</summary>
              <div className="invite-letter__recipients-body">
                <textarea className="input invite-letter__recipients-text" rows={5} readOnly value={bccSemicolon} />
                <button
                  className="btn ghost has-tooltip invite-dropdown__icon-btn"
                  data-tooltip="BCC kopieren"
                  aria-label="BCC kopieren"
                  onClick={copyBcc}
                  disabled={!inviteCount}
                >
                  <CopyIcon />
                </button>
              </div>
              <div className="helper">Die Liste basiert auf der aktuellen Ansicht (Filter & Suche) und enthält nur Kontakte mit E-Mail.</div>
            </details>
          </section>
        </div>

        {/* Copy confirmation toast */}
        {copyMsg && (
          <div className="invite-copy-toast" role="alert">
            <div className="invite-copy-toast__content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
              <span>{copyMsg}</span>
            </div>
            <button className="btn ghost invite-copy-toast__close" onClick={() => setCopyMsg(null)} aria-label="Schließen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </FilterDropdown>
  )
}
