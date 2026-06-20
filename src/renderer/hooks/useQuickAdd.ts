import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
    budgets?: BudgetAssignment[]
    earmarksAssigned?: EarmarkAssignment[]
    taxonomySelectionById?: Record<number, number | ''>
}

type QuickAddDraft = {
    id: string
    sequence: number
    qa: QA
    files: File[]
    detached?: boolean
}

type OpenQuickAddOptions = { detached?: boolean; showModal?: boolean }

function createDraftId() {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

/** Manages one or more in-memory booking drafts for the quick-add modal. */
export function useQuickAdd(
    today: string,
    create: (p: any) => Promise<any>,
    onOpenFilePicker?: () => void,
    notify?: (type: 'success' | 'error' | 'info', text: string) => void,
    draftTabsEnabled = false,
    onRequestOpen?: () => void
) {
    const [quickAdd, setQuickAdd] = useState(false)
    const [drafts, setDrafts] = useState<QuickAddDraft[]>([])
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
    const nextSequenceRef = useRef(1)

    const makeDefaults = useCallback(() => initialQa(today), [today])
    const activeDraft = useMemo(
        () => drafts.find((draft) => draft.id === activeDraftId) ?? null,
        [activeDraftId, drafts]
    )

    const qa = activeDraft?.qa ?? makeDefaults()
    const files = activeDraft?.files ?? []

    const openQuickAdd = useCallback((initial?: { qa?: QA; files?: File[] }, options?: OpenQuickAddOptions) => {
        const detached = !!options?.detached
        const showModal = options?.showModal ?? !detached
        const draft: QuickAddDraft = {
            id: createDraftId(),
            sequence: nextSequenceRef.current++,
            qa: initial?.qa ?? makeDefaults(),
            files: initial?.files ?? [],
            detached
        }
        setDrafts((previous) => draftTabsEnabled ? [...previous, draft] : [draft])
        setActiveDraftId(showModal ? draft.id : null)
        setQuickAdd(showModal)
        return draft
    }, [draftTabsEnabled, makeDefaults])

    const reopenDraft = useCallback((draftId: string) => {
        if (!drafts.some((draft) => draft.id === draftId)) return
        setActiveDraftId(draftId)
        setQuickAdd(true)
    }, [drafts])

    const parkQuickAdd = useCallback(() => {
        if (!draftTabsEnabled) {
            setDrafts([])
            setActiveDraftId(null)
        }
        setQuickAdd(false)
    }, [draftTabsEnabled])

    const closeDraft = useCallback((draftId: string) => {
        const remaining = drafts.filter((draft) => draft.id !== draftId)
        setDrafts(remaining)
        if (activeDraftId === draftId) {
            setActiveDraftId(remaining.at(-1)?.id ?? null)
            setQuickAdd(false)
        }
    }, [activeDraftId, drafts])

    const markDraftDetached = useCallback((draftId: string) => {
        setDrafts((previous) => previous.map((draft) => draft.id === draftId ? { ...draft, detached: true } : draft))
        if (activeDraftId === draftId) {
            setActiveDraftId(null)
            setQuickAdd(false)
        }
    }, [activeDraftId])

    const markDraftDocked = useCallback((draftId: string) => {
        setDrafts((previous) => previous.map((draft) => draft.id === draftId ? { ...draft, detached: false } : draft))
    }, [])

    const dockAndOpenDraft = useCallback((draftId: string) => {
        setDrafts((previous) => previous.map((draft) => draft.id === draftId ? { ...draft, detached: false } : draft))
        setActiveDraftId(draftId)
        setQuickAdd(true)
    }, [])

    const updateDraft = useCallback((draftId: string, patch: Partial<Pick<QuickAddDraft, 'qa' | 'files' | 'detached'>>) => {
        setDrafts((previous) => previous.map((draft) => draft.id === draftId ? { ...draft, ...patch } : draft))
    }, [])

    const clearDrafts = useCallback(() => {
        setDrafts([])
        setActiveDraftId(null)
        setQuickAdd(false)
    }, [])

    useEffect(() => {
        if (draftTabsEnabled) return
        if (!quickAdd) {
            setDrafts([])
            setActiveDraftId(null)
            return
        }
        if (activeDraft) setDrafts([activeDraft])
    }, [activeDraft, draftTabsEnabled, quickAdd])

    const setQa = useCallback((nextQa: QA) => {
        if (!activeDraftId) return
        setDrafts((previous) => previous.map((draft) => (
            draft.id === activeDraftId ? { ...draft, qa: nextQa } : draft
        )))
    }, [activeDraftId])

    const setFiles = useCallback((nextFiles: File[]) => {
        if (!activeDraftId) return
        setDrafts((previous) => previous.map((draft) => (
            draft.id === activeDraftId ? { ...draft, files: nextFiles } : draft
        )))
    }, [activeDraftId])

    const onDropFiles = useCallback((fileList: FileList | null) => {
        if (!fileList) return
        setFiles([...files, ...Array.from(fileList)])
    }, [files, setFiles])

    const onQuickSave = useCallback(async () => {
        if (!activeDraft) return
        const currentQa = activeDraft.qa

        if (currentQa.type === 'TRANSFER' && (!currentQa.transferFrom || !currentQa.transferTo)) {
            notify?.('error', 'Bitte wähle eine Richtung für den Transfer aus.')
            return
        }

        const payload: any = {
            date: currentQa.date,
            type: currentQa.type,
            sphere: currentQa.sphere,
            description: currentQa.description || undefined,
            vatRate: currentQa.vatRate
        }

        if (currentQa.type === 'TRANSFER') {
            payload.transferFrom = currentQa.transferFrom
            payload.transferTo = currentQa.transferTo
            payload.vatRate = 0
            payload.grossAmount = currentQa.grossAmount ?? 0
        } else {
            payload.paymentMethod = currentQa.paymentMethod
        }

        if (currentQa.mode === 'GROSS') {
            payload.grossAmount = currentQa.grossAmount ?? 0
            payload.vatRate = 0
            delete payload.netAmount
        } else {
            payload.netAmount = currentQa.netAmount ?? 0
            delete payload.grossAmount
        }

        if (typeof currentQa.categoryId === 'number') payload.categoryId = currentQa.categoryId
        if (Array.isArray(currentQa.tags)) payload.tags = currentQa.tags

        const budgets = (currentQa.budgets || []).filter((item) => item.budgetId > 0 && item.amount > 0)
        const earmarks = (currentQa.earmarksAssigned || []).filter((item) => item.earmarkId > 0 && item.amount > 0)
        if (budgets.length) payload.budgets = budgets
        if (earmarks.length) payload.earmarks = earmarks

        if (budgets.length) {
            payload.budgetId = budgets[0].budgetId
            payload.budgetAmount = budgets[0].amount
        } else if (typeof currentQa.budgetId === 'number' && currentQa.budgetId > 0) {
            payload.budgetId = currentQa.budgetId
            payload.budgetAmount = payload.grossAmount ?? payload.netAmount ?? null
        }
        if (earmarks.length) {
            payload.earmarkId = earmarks[0].earmarkId
            payload.earmarkAmount = earmarks[0].amount
        } else if (typeof currentQa.earmarkId === 'number' && currentQa.earmarkId > 0) {
            payload.earmarkId = currentQa.earmarkId
            payload.earmarkAmount = payload.grossAmount ?? payload.netAmount ?? null
        }

        if (activeDraft.files.length) {
            const encode = async (file: File) => {
                const bytes = new Uint8Array(await file.arrayBuffer())
                let binary = ''
                const chunk = 0x8000
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any)
                }
                return { name: file.name, dataBase64: btoa(binary), mime: file.type || undefined }
            }
            payload.files = await Promise.all(activeDraft.files.map(encode))
        }

        const result = await create(payload)
        if (!result) return

        try {
            const voucherId = Number(result.id)
            const selections = currentQa.taxonomySelectionById
            if (voucherId && selections && typeof window.api?.vouchers?.taxonomyAssignments?.set === 'function') {
                const operations = Object.entries(selections)
                    .map(([taxonomyId, termId]) => ({ taxonomyId: Number(taxonomyId), termId }))
                    .filter((item) => item.taxonomyId > 0 && typeof item.termId === 'number')
                    .map((item) => window.api!.vouchers.taxonomyAssignments.set({
                        voucherId,
                        taxonomyId: item.taxonomyId,
                        termId: item.termId as number
                    }))
                await Promise.allSettled(operations)
            }
        } catch {
            // Taxonomy assignments remain best-effort, matching the existing workflow.
        }

        const remaining = drafts.filter((draft) => draft.id !== activeDraft.id)
        setDrafts(remaining)
        setActiveDraftId(remaining.at(-1)?.id ?? null)
        setQuickAdd(false)
    }, [activeDraft, create, drafts, notify])

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null
            const tag = (target?.tagName || '').toLowerCase()
            const inEditable = !!(target && (target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'))

            if (!inEditable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                try {
                    if ((localStorage.getItem('activePage') || 'Buchungen') === 'Buchungen') {
                        (document.querySelector('input[placeholder^="Suche Buchungen"]') as HTMLInputElement | null)?.focus()
                        event.preventDefault()
                        return
                    }
                } catch { }
            }

            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
                if (onRequestOpen) onRequestOpen()
                else openQuickAdd()
                event.preventDefault()
                return
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && quickAdd) {
                void onQuickSave()
                event.preventDefault()
                return
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u' && quickAdd) {
                onOpenFilePicker?.()
                event.preventDefault()
                return
            }
            if (event.key === 'Escape' && quickAdd) {
                parkQuickAdd()
                event.preventDefault()
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onOpenFilePicker, onQuickSave, onRequestOpen, openQuickAdd, parkQuickAdd, quickAdd])

    const openFilePicker = useCallback(() => onOpenFilePicker?.(), [onOpenFilePicker])

    return {
        quickAdd,
        qa,
        setQa,
        onQuickSave,
        files,
        setFiles,
        openFilePicker,
        onDropFiles,
        openQuickAdd,
        parkQuickAdd,
        bookingDrafts: drafts,
        activeDraftId,
        reopenDraft,
        closeDraft,
        markDraftDetached,
        markDraftDocked,
        dockAndOpenDraft,
        updateDraft,
        clearDrafts,
        hasOpenDrafts: draftTabsEnabled && drafts.length > 0
    }
}

export type { QA, BudgetAssignment, EarmarkAssignment, QuickAddDraft }
