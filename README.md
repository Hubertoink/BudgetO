# VereinO (Electron + React + TypeScript)

Offline-first Desktop-App für gemeinnützige Vereine. Cross-Platform (Windows/macOS/Linux).

## Entwicklung

1) Abhängigkeiten installieren

```powershell
npm install
```

2) Entwicklung starten (Electron + Vite Dev-Server)

```powershell
npm run dev
```

3) Lint & Format

```powershell
npm run lint
npm run format
```

4) Tests

```powershell
npm test
npm run test:e2e
```

5) Build/Package

```powershell
npm run build
npm run package
```

### VS Code Tasks & Debugging

- Tasks (Terminal → Run Task):
  - Build project (quick check): npm run build
  - Start Dev (Electron): npm run dev (background)
  - Package App: npm run package
  - Rebuild Native Modules: npm run rebuild:native

- Debug: Attach to Electron Main or Renderer via Run and Debug using the provided launch configurations. Ensure Electron is started with inspect flags if needed.

## Datenbank sichern/wiederherstellen

- Export (Backup): In der App unter `Einstellungen → Allgemein → Datenbank` auf `Exportieren` klicken und Speicherort wählen. Es wird eine SQLite-Datei der aktuellen Datenbank geschrieben.
- Import (Wiederherstellung): Unter `Einstellungen → Allgemein → Datenbank` auf `Importieren…` klicken und eine bestehende SQLite-/DB-Datei wählen. Achtung: Die aktuelle Datenbank wird überschrieben. Nach dem Import wird die App automatisch neu geladen.

### Alle Buchungen löschen

Unter `Einstellungen → Allgemein → Gefährliche Aktion` kann man alle Buchungen inkl. Anhänge dauerhaft löschen. Diese Aktion erfordert eine doppelte Bestätigung und kann nicht rückgängig gemacht werden. Nutzen Sie vorher die Export-Funktion zur Sicherung.

## Struktur

- `electron/main` – Electron Main-Prozess
- `electron/preload` – Preload/IPC-Brücke (sicher)
- `src` – React-Renderer (Vite)
- `shared` – gemeinsame Typen

Weitere Module (DB, IPC, Services, Reports, Import/Export) folgen iterativ.

### Entry-Setup (vereinheitlicht)

- Der Renderer-Einstiegspunkt `src/renderer/main.tsx` importiert `../App`.
- `src/App.tsx` ist der schlanke Root-Orchestrator und lädt die eigentliche App lazy:
  - Vorteil: kleiner Root, schnelle Initialisierung, klarer zentraler Einstieg.
  - Die „schwere“ UI liegt in `src/renderer/App.tsx` und wird per `React.lazy` geladen.

## Lizenz

MIT
