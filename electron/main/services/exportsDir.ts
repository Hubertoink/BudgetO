import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BUDGETO_EXPORTS_DIR_NAME = 'Budgeto_Export'
const LEGACY_EXPORTS_DIR_NAMES = [
    // Old BudgetO/VereinPlanner naming variants seen in the wild
    'VereinPlannerExports',
    'VereinPlannerExport',
    'vereinplannerexport',
    'vereinplannerexports'
]

/**
 * Returns a user-facing export directory under Documents.
 * - Prefers the new BudgetO folder.
 * - Falls back to the legacy folder if it already exists (for continuity).
 */
export function ensureExportsBaseDir(): string {
    const docsDir = path.join(os.homedir(), 'Documents')
    const budgetoDir = path.join(docsDir, BUDGETO_EXPORTS_DIR_NAME)
    const legacyDirs = LEGACY_EXPORTS_DIR_NAMES.map((n) => path.join(docsDir, n))

    try {
        if (fs.existsSync(budgetoDir)) {
            try { fs.mkdirSync(budgetoDir, { recursive: true }) } catch { }
            return budgetoDir
        }

        const existingLegacy = legacyDirs.find((d) => {
            try { return fs.existsSync(d) } catch { return false }
        })

        // If a legacy folder exists and the new one doesn't, migrate it to the new name.
        if (existingLegacy) {
            try {
                fs.renameSync(existingLegacy, budgetoDir)
                try { fs.mkdirSync(budgetoDir, { recursive: true }) } catch { }
                return budgetoDir
            } catch {
                // If renaming fails (permissions, cross-device, etc.), fall back to legacy.
                try { fs.mkdirSync(existingLegacy, { recursive: true }) } catch { }
                return existingLegacy
            }
        }
    } catch {
        // ignore and fall back to default
    }

    try { fs.mkdirSync(budgetoDir, { recursive: true }) } catch { }
    return budgetoDir
}
