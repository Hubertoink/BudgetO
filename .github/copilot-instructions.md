# BudgetO Copilot Project Instructions

Diese Anweisungen konfigurieren GitHub Copilot für die BudgetO Electron + React + TypeScript Anwendung – ein Budget- und Finanzmanagement-Tool für die Jugendförderung.

## Projektkontext
- **Basis:** Fork von [VereinO](https://github.com/Hubertoink/VereinO)
- **Zweck:** Outputorientierte Finanzplanung für Jugendförderung
- **Architektur:** Electron (Main) + React (Renderer) + SQLite/PostgreSQL
- **Sprache:** Deutsch (UI), Englisch (Code)

## Kernmodule (BudgetO-spezifisch)
- **Budgets:** Jahresbudget-Planung mit Soll-Ist-Vergleich
- **Übungsleiter (instructors):** Verträge, Rechnungen, Jahresobergrenzen
- **Barvorschüsse (cash-advance):** Anordnungsnummern, Teil-Vorschüsse, Über-/Unterdeckung
- **Excel-Import:** Buchungsimport via .xlsx mit Spalten-Mapping
- **Kostenstellen:** Mehrere Sachgebiete pro Kassier

## Core Principles
- Prefer readability and maintainability over clever shortcuts.
- Extend existing utilities/components before creating new abstractions.
- Keep components focused (single responsibility, minimal side effects).
- Push business logic to services or hooks; keep UI components thin.
- Use explicit types; avoid `any`. Narrow unknown input early.

## React Component Standards
- Use functional components with hooks; avoid legacy class components.
- Separate presentational vs. container concerns: data fetching/state in hooks or container, rendering in presentational components.
- Extract reusable stateful logic into custom hooks under `src/renderer/hooks/`.
- Keep JSX lean: compute derived values above the return, avoid large inline objects.
- Pass primitive or typed props; avoid passing whole objects when only a few fields are needed.

## TypeScript Guidelines
- Target TS 5.x features; prefer native ES2022 APIs (e.g. `Array.prototype.at`).
- Use discriminated unions or enums for domain states (e.g. `InstructorStatus`, `CashAdvanceStatus`).
- Centralize shared shapes in `shared/types.ts` or domain-specific type files.
- Prefer `readonly` and immutability for data structures exposed to multiple layers.
- Provide explicit return types for public functions/services.

## BudgetO Domain Types
When creating new features, use these patterns:
```typescript
// Übungsleiter Status
type InstructorStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

// Barvorschuss Status
type CashAdvanceStatus = 'OPEN' | 'RESOLVED' | 'OVERDUE'

// Teil-Barvorschuss
interface PartialCashAdvance {
  id: number
  cashAdvanceId: number
  employeeName: string
  amount: number
  issuedAt: string
  resolvedAt?: string
  overUnderCoverage?: number
}
```

## Styling & Layout
- Minimize inline styles. Allow them only for truly dynamic values.
- Use existing utility classes in `styles.css` (`flex`, `grid`, `gap-*`, `items-center`, etc.).
- Centralize spacing, colors, radii in CSS variables.
- Prefer component-specific classes with semantic prefixes (e.g. `.instructor-card`, `.cash-advance-row`).

## Accessibility
- Provide `aria-label` on icon-only interactive elements.
- Ensure modals: `role="dialog"` + `aria-modal="true"`.
- All images require descriptive `alt`.
- Maintain sufficient contrast using theme variables.

## Security & Data Handling
- Validate IPC payloads against schemas in `electron/main/ipc/schemas.ts`.
- Never execute dynamic code from user content.
- Sanitize file uploads (contracts, receipts).

## Services & IPC Pattern
For new features, follow this pattern:
1. Add DB migration in `electron/main/db/migrations.ts`
2. Create repository in `electron/main/repositories/`
3. Add IPC handler in `electron/main/ipc/`
4. Expose via preload bridge
5. Create typed renderer hook in `src/renderer/hooks/`

## Module System
BudgetO uses a modular architecture. When adding modules:
- Define module in `src/renderer/modules/` (future)
- Add enable/disable toggle in settings
- Lazy-load module components
- Store module config in `module_config` DB table

## Testing
- Use Jest + React Testing Library.
- Add tests for edge cases (empty states, validation errors).
- Test file upload scenarios for contracts/receipts.

## Commit Conventions
```
<type>(<scope>): <description>

Types: feat, fix, docs, refactor, test, chore
Scopes: instructors, cash-advance, budgets, excel-import, core, ui
```

## Key Files
- `electron/main/db/migrations.ts` – DB schema changes
- `src/renderer/views/` – Main view components
- `shared/types.ts` – Shared TypeScript types
- `electron/main/repositories/` – Data access layer

## German UI Terms
| English | German (UI) |
|---------|-------------|
| Instructor | Übungsleiter |
| Cash Advance | Barvorschuss |
| Order Number | Anordnungsnummer |
| Coverage | Deckung |
| Cost Center | Kostenstelle |
| Invoice | Rechnung |
| Contract | Vertrag |

---
*BudgetO – Budget- und Finanzmanagement für die Jugendförderung*
