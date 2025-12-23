import { useState, useEffect, useCallback } from 'react'

type BudgetAssignment = { budgetId: number; amount: number }
type EarmarkAssignment = { earmarkId: number; amount: number }

type QA = {
    date: string
    type: 'IN' | 'OUT' | 'TRANSFER'
    sphere: 'IDEELL' | 'ZWECK' | 'VERMOEGEN' | 'WGB'
    grossAmount?: number
    netAmount?: number
    vatRate: number
    description: string
    paymentMethod?: 'BAR' | 'BANK'
    mode?: 'NET' | 'GROSS'
    transferFrom?: 'BAR' | 'BANK'
    transferTo?: 'BAR' | 'BANK'
    budgetId?: number | null
    earmarkId?: number | null
    tags?: string[]
    categoryId?: number | null
    // Extended: multiple budgets/earmarks with amounts
    budgets?: BudgetAssignment[]
    earmarksAssigned?: EarmarkAssignment[]
    // Taxonomy term selections (taxonomyId -> termId)
    taxonomySelectionById?: Record<number, number | ''>
}

const initialQa = (today: string): QA => ({
    date: today, 
    type: 'OUT', 
    sphere: 'IDEELL', 
    mode: 'GROSS',
    grossAmount: 100,
    vatRate: 0, 
    description: '', 
    paymentMethod: 'BAR',
    budgets: [],
    earmarksAssigned: [],
    taxonomySelectionById: {}
})

/**
 * useQuickAdd Hook
 * 
 * Manages state and logic for the Quick Add booking modal
 * Extracted from App.tsx for better maintainability
 */
export function useQuickAdd(
    today: string, 
    create: (p: any) => Promise<any>, 
    onOpenFilePicker?: () => void,
    notify?: (type: 'success' | 'error' | 'info', text: string) => void
) {
    const [quickAdd, setQuickAdd] = useState(false)
    const [qa, setQa] = useState<QA>(initialQa(today))
    const [files, setFiles] = useState<File[]>([])

    // Reset function to clear the form
    const resetForm = useCallback(() => {
        setQa(initialQa(today))
        setFiles([])
    }, [today])

    // Close modal and reset form
    const closeModal = useCallback(() => {
        setQuickAdd(false)
        resetForm()
    }, [resetForm])

    function onDropFiles(fileList: FileList | null) {
        if (!fileList) return
        const arr = Array.from(fileList)
        setFiles((prev) => [...prev, ...arr])
    }

    async function onQuickSave() {
        // Validate transfer direction
        if (qa.type === 'TRANSFER' && (!(qa as any).transferFrom || !(qa as any).transferTo)) {
            notify?.('error', 'Bitte wähle eine Richtung für den Transfer aus.')
            return
        }
        
        const payload: any = {
            date: qa.date,
            type: qa.type,
            sphere: qa.sphere,
            description: qa.description || undefined,
            vatRate: qa.vatRate
        }
        
        if (qa.type === 'TRANSFER') {
            delete payload.paymentMethod
            payload.transferFrom = (qa as any).transferFrom
            payload.transferTo = (qa as any).transferTo
            payload.vatRate = 0
            payload.grossAmount = (qa as any).grossAmount ?? 0
            delete payload.netAmount
        } else {
            payload.paymentMethod = qa.paymentMethod
            payload.transferFrom = undefined
            payload.transferTo = undefined
        }
        
        if (qa.mode === 'GROSS') {
            payload.grossAmount = qa.grossAmount ?? 0
            payload.vatRate = 0 // Brutto immer ohne Aufteilung
            delete payload.netAmount
        } else {
            payload.netAmount = qa.netAmount ?? 0
            // vatRate bleibt (0/7/19)
            delete payload.grossAmount
        }
        
        // Category (custom categories module)
        if (typeof qa.categoryId === 'number') {
            payload.categoryId = qa.categoryId
        }
        
        if (Array.isArray(qa.tags)) payload.tags = qa.tags
        
        // Multiple budgets support
        if (qa.budgets && qa.budgets.length > 0) {
            payload.budgets = qa.budgets.filter(b => b.budgetId > 0)
        }
        // Multiple earmarks support
        if (qa.earmarksAssigned && qa.earmarksAssigned.length > 0) {
            payload.earmarksAssigned = qa.earmarksAssigned.filter(e => e.earmarkId > 0)
        }

        // Convert attachments to Base64
        if (files.length) {
            const enc = async (f: File) => {
                const buf = await f.arrayBuffer()
                let binary = ''
                const bytes = new Uint8Array(buf)
                const chunk = 0x8000
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
                }
                const dataBase64 = btoa(binary)
                return { name: f.name, dataBase64, mime: f.type || undefined }
            }
            payload.files = await Promise.all(files.map(enc))
        }

        const res = await create(payload)
        if (res) {
            // Persist taxonomy assignments after creation (non-blocking best-effort)
            try {
                const voucherId = Number((res as any)?.id)
                const sel = (qa as any)?.taxonomySelectionById as Record<number, number | ''> | undefined
                if (voucherId && sel && typeof (window as any)?.api?.vouchers?.taxonomyAssignments?.set === 'function') {
                    const ops = Object.entries(sel)
                        .map(([taxonomyIdStr, termId]) => ({ taxonomyId: Number(taxonomyIdStr), termId }))
                        .filter((x) => x.taxonomyId && typeof x.termId === 'number')
                        .map((x) => (window as any).api.vouchers.taxonomyAssignments.set({ voucherId, taxonomyId: x.taxonomyId, termId: x.termId }))
                    await Promise.allSettled(ops)
                }
            } catch {
                // ignore
            }
            closeModal()
        }
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null
            const tag = (target?.tagName || '').toLowerCase()
            const inEditable = !!(target && ((target as any).isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'))

            // Search focus (Ctrl+K) only when on Buchungen and not in another input
            if (!inEditable && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                try { 
                    const page = localStorage.getItem('activePage') || 'Buchungen'
                    if (page === 'Buchungen') { 
                        (document.querySelector('input[placeholder^="Suche Buchungen"]') as HTMLInputElement | null)?.focus()
                        e.preventDefault()
                        return 
                    } 
                } catch { }
            }

            // Open Quick-Add robustly via Ctrl+Shift+N (no bare 'n')
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
                setQuickAdd(true)
                e.preventDefault()
                return
            }

            // Save and Upload hotkeys only when Quick-Add is open
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { 
                if (quickAdd) { 
                    onQuickSave()
                    e.preventDefault() 
                } 
                return 
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { 
                if (quickAdd) { 
                    onOpenFilePicker?.()
                    e.preventDefault() 
                } 
                return 
            }
            if (e.key === 'Escape') { 
                if (quickAdd) { 
                    closeModal()
                    e.preventDefault() 
                } 
                return 
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [qa, files, quickAdd, onQuickSave, onOpenFilePicker, closeModal])

    const openFilePicker = () => onOpenFilePicker?.()

    return { quickAdd, setQuickAdd, qa, setQa, onQuickSave, files, setFiles, openFilePicker, onDropFiles, closeModal }
}

export type { QA, BudgetAssignment, EarmarkAssignment }
