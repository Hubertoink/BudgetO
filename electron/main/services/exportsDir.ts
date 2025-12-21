import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BUDGETO_EXPORTS_DIR_NAME = 'BudgetOExports'
const LEGACY_EXPORTS_DIR_NAME = 'VereinPlannerExports'

/**
 * Returns a user-facing export directory under Documents.
 * - Prefers the new BudgetO folder.
 * - Falls back to the legacy folder if it already exists (for continuity).
 */
export function ensureExportsBaseDir(): string {
    const docsDir = path.join(os.homedir(), 'Documents')
    const budgetoDir = path.join(docsDir, BUDGETO_EXPORTS_DIR_NAME)
    const legacyDir = path.join(docsDir, LEGACY_EXPORTS_DIR_NAME)

    try {
        if (fs.existsSync(budgetoDir)) {
            try { fs.mkdirSync(budgetoDir, { recursive: true }) } catch { }
            return budgetoDir
        }
        if (fs.existsSync(legacyDir)) {
            try { fs.mkdirSync(legacyDir, { recursive: true }) } catch { }
            return legacyDir
        }
    } catch {
        // ignore and fall back to default
    }

    try { fs.mkdirSync(budgetoDir, { recursive: true }) } catch { }
    return budgetoDir
}
