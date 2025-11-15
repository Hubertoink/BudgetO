- [x] Verify that the copilot-instructions.md file in the .github directory is created.
instructions

# VereinO Copilot Project Instructions

These instructions tailor GitHub Copilot to our Electron + React + TypeScript application. They paraphrase core standards (React & TypeScript best practices, styling conventions, accessibility, security) and apply specifically to this codebase. Do not reproduce external instruction text verbatim; follow the guidance below when generating or modifying code.

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
- Use discriminated unions or enums for domain states (e.g. voucher types).
- Centralize shared shapes in `shared/types.ts` or domain-specific type files.
- Prefer `readonly` and immutability for data structures exposed to multiple layers.
- Provide explicit return types for public functions/services.

## Styling & Layout
- Minimize inline styles. Allow them only for truly dynamic or data-driven values that cannot be expressed via a CSS class (e.g. width computed from props).
- Use existing utility classes in `styles.css` (`flex`, `grid`, `gap-*`, `items-center`, etc.) and add new semantic classes for recurring patterns (e.g. `.taxex-preview`).
- Centralize spacing, colors, radii in CSS variables; do not duplicate hex codes in components.
- Prefer component-specific classes with a `feature-` or semantic prefix over generic new utilities when a layout is unique.
- Remove inline layout objects like `{ display:'flex', gap:8 }` in favor of utility classes (`flex gap-8`).
- Box shadows, border styling, and backgrounds should reference existing vars (`var(--surface)`, `var(--border)`).

## Accessibility
- Provide `aria-label` on icon-only interactive elements (close buttons, icons).
- Ensure modals: `role="dialog"` + `aria-modal="true"` and focus trapping if necessary.
- Keyboard shortcuts (e.g. ESC, Ctrl+S) must not interfere with native browser shortcuts.
- All images require descriptive `alt`; decorative emojis inside labels can remain.
- Maintain sufficient contrast using theme variables; avoid hard-coded colors.

## Security & Data Handling
- Sanitize or escape external file names or user-provided strings before rendering if they could contain markup (currently filenames are trusted from backend; revisit if backend allows arbitrary input).
- Never execute dynamic code from user content. Avoid `eval`, dynamic `Function` constructors.
- Validate IPC payloads against schemas in `electron/main/ipc/schemas.ts` before using.
- When adding new IPC channels, keep schema + type definitions aligned and avoid duplicating validation logic.

## Services & IPC
- Keep Electron main services side-effect aware: provide `initialize` / `dispose` if complex resources (DB, file watchers) are added.
- Renderer calls must go through the preload `api` bridge; do not access Node APIs directly.
- For new features: add schema → service method → IPC handler → preload exposure → typed renderer hook.

## Testing
- Use Jest + React Testing Library for component behavior, not implementation details.
- Add tests for edge cases (empty states, error messages, file validation failures).
- When refactoring styles, ensure tests reference roles/text rather than class names.

## Performance
- Avoid unnecessary `useEffect` when derived values can be computed inline.
- Memoize expensive derived lists only when profiling shows re-render issues.
- Lazy-load heavy modals or feature panels if they grow large.

## Comments & Documentation
- Comment only to clarify intent or non-obvious trade-offs. Remove stale comments after refactors.
- For intricate helper functions (e.g. chunked base64 conversion) keep a brief rationale comment.

## Inline Style Policy
Allowed inline styles:
- Truly dynamic values based on runtime data (e.g. computed widths/heights, color derived from status).
- One-off transforms or animations that are not reused.
Disallowed inline styles:
- Static layout (flex/grid, gaps, alignment).
- Static spacing, borders, backgrounds using existing variables.
- Font sizing and weights that match existing tokens.
Action: When adding a component, first check for an existing utility class; if missing and pattern will recur, create a semantic class in `styles.css`.

## Migration Approach (Legacy Inline Styles)
- Incrementally replace static inline style objects with classes (`TaxExemptionModal` already started). Avoid massive churn in a single PR.
- Each refactor: introduce semantic classes in CSS, then strip inline style blocks.
- Keep regression risk low by preserving structure and verifying visually.

## Commit & PR Conventions
- Use concise commit messages: `<scope>: <summary>` (e.g. `taxex: extract preview styles`).
- PR description should list: scope, key changes, risk assessment, test updates.

## Session Checklist (Historical)
The previous checklist content was replaced by these standards. If needed, refer to git history for earlier scaffolding tasks.

---
When Copilot suggests code:
- Reject suggestions with large inline style blobs.
- Prefer adding/importing a hook over embedding complex state logic in JSX.
- Ask for type-safe return values and error handling around async IPC calls.

# End of Instructions
