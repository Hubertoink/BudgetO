# App.tsx Refactor Plan (Modularization)

Goal: Break down the monolithic `src/renderer/App.tsx` (~9k lines) into cohesive, testable, and maintainable modules without changing behavior.

## Guiding principles

- Keep a stable public surface: IPC calls, window events, and settings keys remain unchanged.
- Extract UI by feature and by layer (view, subcomponents, hooks, utils).
- Favor pure components and small hooks over deeply nested inline functions.
- Co-locate tests and stories in the same folder later.

## Target structure (renderer)

```
src/renderer/
  app/
    App.tsx                  # Slim root shell (routing, global modals, toasts)
    routes.tsx               # Route config + lazy-loading wrappers
    providers.tsx            # Context providers (theme, settings, toasts)
    useAppInit.ts            # Startup effects (auto-backup PROMPT logic)
  components/
    modals/
      AutoBackupPromptModal.tsx
      TimeFilterModal.tsx
      MetaFilterModal.tsx
      ExportOptionsModal.tsx
      TagsManagerModal.tsx
      RestoreBackupModal.tsx
      ConfirmDeleteModal.tsx
    common/
      Toasts.tsx
      Fab.tsx
      Toolbar.tsx
      Table.tsx
      EmptyState.tsx
  views/
    Dashboard/
      DashboardView.tsx
      DashboardEarmarksPeek.tsx
      DashboardRecentActivity.tsx
      charts/
        ReportsMonthlyChart.tsx
        ReportsCashBars.tsx
    Buchungen/
      JournalView.tsx
      filters/
        useJournalFilters.ts
    Mitglieder/
      MembersView.tsx
      MembersForm.tsx
      useMembers.ts
    Einstellungen/
      SettingsView.tsx
      BackupSettings.tsx
  hooks/
    useToasts.ts
    usePersistentState.ts
    useIpcEffect.ts
  utils/
    date.ts
    format.ts
    csv.ts
    pdf.ts
```

## Phased approach

1. Extract global pieces first
   - Move AutoBackupPromptModal + other modals to `components/modals/*`.
   - Move Toast container to `components/common/Toasts.tsx` with `useToasts` hook.
   - Move FAB to `components/common/Fab.tsx`.
   - Create `app/useAppInit.ts` to hold startup logic for auto-backup prompt; `App.tsx` just invokes it.

2. Split views by route
   - Create `views/Dashboard/DashboardView.tsx` and related child components.
   - Create `views/Mitglieder/*` for members list, form, and hooks.
   - Create `views/Buchungen/*` for the journal and filters.
   - Create `views/Einstellungen/*` for settings, especially `BackupSettings.tsx`.

3. Extract shared hooks and utilities
   - `usePersistentState` for localStorage-backed state patterns seen across the app.
   - `useIpcEffect` to wrap IPC calls with cancellation guards and typed responses.
   - `utils/format.ts` for currency/date helpers; `utils/date.ts` for ISO helpers.

4. Introduce route config + lazy loading
   - Create `app/routes.tsx` exporting a map of route → lazy(() => import(view)).
   - In `App.tsx`, render via `Suspense` to improve initial load and reduce bundle size.

5. Tighten types and props
   - Add explicit props interfaces for each component.
   - Replace inline `any` with discriminated unions or `zod`-derived types where feasible.

6. Optional: Tests and stories
   - Add minimal unit tests for hooks and utils.
   - Later add Playwright smoke tests for critical flows.

## Acceptance criteria

- App compiles and behaves as before (no UI changes).
- `App.tsx` shrinks to a small shell (< 400 lines).
- No circular dependencies; folders import upward only via app boundaries.
- New files have clear, typed props and minimal side effects.

## Risks & mitigations

- Hidden coupling in `App.tsx`: Address by creating small interface contracts between views and the shell (callbacks/events).
- IPC shape drift: Avoid by not changing preload/main APIs during refactor.
- Regression risk: Validate via quick manual smoke (startup, backup prompt, members CRUD, voucher add, reports export).

## Work breakdown (tracking)

- [ ] Phase 1: Global modals + toasts + useAppInit
- [ ] Phase 2: Split Dashboard view + charts
- [ ] Phase 3: Split Members view + form
- [ ] Phase 4: Split Journal (Buchungen)
- [ ] Phase 5: Split Settings (Backup)
- [ ] Phase 6: Hooks and utils extraction
- [ ] Phase 7: Routes + lazy loading
- [ ] Phase 8: Cleanup and types tightening
