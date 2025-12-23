import React, { useState, useCallback, useRef } from 'react'
import { ToastContext } from './toastContextStore'
import type { ToastAction, ToastType } from './toastTypes'

interface Toast {
  id: number
  type: ToastType
  text: string
  action?: { label: string; onClick: () => void }
  leaving?: boolean
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const lastToastRef = useRef<{ type: ToastType; text: string; at: number } | null>(null)
  const EXIT_MS = 220

  const notify = useCallback(
    (type: ToastType, text: string, ms = 4000, action?: ToastAction) => {
      const now = Date.now()
      const last = lastToastRef.current
      if (last && last.type === type && last.text === text && now - last.at < 800) {
        return
      }
      lastToastRef.current = { type, text, at: now }

      const id = ++nextId.current
      setToasts(prev => [...prev, { id, type, text, action, leaving: false }])

      const leaveAt = Math.max(0, ms - EXIT_MS)
      window.setTimeout(() => {
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
      }, leaveAt)

      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, ms)
    },
    []
  )

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast ${t.type}${t.leaving ? ' leaving' : ''}`}
            role={t.type === 'error' || t.type === 'warn' ? 'alert' : 'status'}
          >
            <span>{t.text}</span>
            {t.action && (
              <button className="btn ghost sm" onClick={t.action.onClick}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
