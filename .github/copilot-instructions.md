- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	- Current focus: Tag filter in Buchungen, filtered totals, and Transfer (BAR ↔ BANK) flows incl. UI and payload.
	- Ensure vouchers can be created/edited incl. optional earmark/budget without schema errors.

- [x] Scaffold the Project
	- Existing Electron + React + Vite scaffold is complete. No re-scaffold required.

- [x] Customize the Project
	- Added .vscode/tasks.json (dev/build/package/rebuild), .vscode/launch.json (attach configs), .vscode/extensions.json (recommendations).

- [x] Install Required Extensions
	- Added workspace recommendations: ESLint, Prettier, Playwright, TS Next, Jest Runner.

- [x] Compile the Project
	- Ran build task (electron-vite build): success.

- [x] Create and Run Task
	- Added task "Start Dev (Electron)" that runs `npm run dev`.

- [x] Launch the Project
	- Use the task above or `npm run dev`. Attach debug via provided launch configs if Electron is started with inspect flags.

- [x] Ensure Documentation is Complete
	- README updated with VS Code tasks and debugging notes.
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
