// Storage selection helpers for Settings UI
// Provides a two-step flow: pick folder first, then migrate or use existing.

export type PickResult = { root: string; hasDb: boolean; dbPath: string; filesDir: string }
export type MigrateUseResult = { ok: true; root: string; dbPath: string; filesDir: string }

export async function pickFolder(): Promise<PickResult | null> {
    try {
        const res = await (window as any).api?.db?.location?.pick?.()
        return res ?? null
    } catch (e: any) {
        const msg = e?.message || String(e)
        if (/Abbruch/i.test(msg)) return null
        throw e
    }
}

export async function migrateTo(root: string): Promise<MigrateUseResult> {
    const res = await (window as any).api?.db?.location?.migrateTo?.({ root })
    return res
}

export async function useFolder(root: string): Promise<MigrateUseResult> {
    const res = await (window as any).api?.db?.location?.useFolder?.({ root })
    return res
}
