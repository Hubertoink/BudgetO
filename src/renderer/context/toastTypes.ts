export type ToastType = 'info' | 'success' | 'warn' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  notify: (type: ToastType, text: string, ms?: number, action?: ToastAction) => void
}
