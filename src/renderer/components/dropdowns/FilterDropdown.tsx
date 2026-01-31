import React, { useEffect, useRef, useState } from 'react'

type ColorVariant = 'default' | 'display' | 'time' | 'filter' | 'action'

interface FilterDropdownProps {
  /** The trigger button content (usually an icon) */
  trigger: React.ReactNode
  /** Title shown in the dropdown header */
  title: string
  /** Whether there are active filters (shows indicator dot) */
  hasActiveFilters?: boolean
  /** The dropdown content */
  children: React.ReactNode
  /** Optional: align dropdown to right edge of trigger */
  alignRight?: boolean
  /** Optional: custom width */
  width?: number | string
  /** Optional aria label for trigger button */
  ariaLabel?: string
  /** Optional title/tooltip for trigger button */
  buttonTitle?: string
  /** Optional color variant for visual grouping */
  colorVariant?: ColorVariant
  /** Optional: align tooltip to left (for buttons near right edge) */
  tooltipAlign?: 'center' | 'left'

  /** Optional: controlled open state */
  open?: boolean
  /** Optional: open state change handler (supports controlled/uncontrolled) */
  onOpenChange?: (open: boolean) => void
}

export default function FilterDropdown({
  trigger,
  title,
  hasActiveFilters = false,
  children,
  alignRight = false,
  width = 320,
  ariaLabel,
  buttonTitle,
  colorVariant = 'default',
  tooltipAlign = 'center',
  open: openProp,
  onOpenChange
}: FilterDropdownProps) {
  const [openInternal, setOpenInternal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const open = openProp ?? openInternal

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenInternal(next)
    onOpenChange?.(next)
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Adjust position if panel would overflow viewport
  useEffect(() => {
    if (!open || !panelRef.current) return
    const panel = panelRef.current
    const rect = panel.getBoundingClientRect()
    
    // Check right overflow
    if (rect.right > window.innerWidth - 16) {
      panel.style.left = 'auto'
      panel.style.right = '0'
    }
    // Check bottom overflow
    if (rect.bottom > window.innerHeight - 16) {
      panel.style.maxHeight = `${window.innerHeight - rect.top - 32}px`
    }
  }, [open])

  return (
    <div ref={containerRef} className="filter-dropdown" style={{ position: 'relative' }}>
      <button
        className={`btn ghost filter-dropdown__trigger filter-dropdown__trigger--${colorVariant} ${hasActiveFilters ? 'has-filters' : ''} has-tooltip${tooltipAlign === 'left' ? ' tooltip-left' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
        data-tooltip={buttonTitle}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {trigger}
        {hasActiveFilters && <span className="filter-dropdown__indicator" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="filter-dropdown__panel"
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            ...(alignRight ? { right: 0, left: 'auto' } : { left: 0 })
          }}
          role="dialog"
          aria-modal="false"
          aria-label={title}
        >
          <header className="filter-dropdown__header">
            <h3 className="filter-dropdown__title">{title}</h3>
            <button
              className="btn ghost filter-dropdown__close"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
          <div className="filter-dropdown__content">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
