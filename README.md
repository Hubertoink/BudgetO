# 🎯 BudgetO – Budget- und Finanzmanagement für die Jugendförderung

> Outputorientierte Finanzplanung • Electron + React + TypeScript • MIT License

---

## 📋 Inhaltsverzeichnis

- [Über das Projekt](#-über-das-projekt)
- [Features](#-features)
- [Installation & Start](#-installation--start)
- [NPM-Befehle](#-npm-befehle)
- [Technologie-Stack](#️-technologie-stack)
- [Projektstruktur](#-projektstruktur)
- [Module](#-module)
- [Mitwirken](#-mitwirken)
- [Lizenz](#-lizenz)

---

## 🎯 Über das Projekt

**BudgetO** ist eine speziell für die Jugendförderung entwickelte Budget- und Finanzverwaltungssoftware. Die App ermöglicht eine einfache und übersichtliche Budgetplanung nach dem Grundsatz der **outputorientierten Finanzierung**.

### Kernfunktionen:

- 📊 **Jahresbudget-Planung** mit Soll-Ist-Vergleich
- 👥 **Übungsleiter-Verwaltung** mit Verträgen, Rechnungen und Jahresobergrenzen
- 💵 **Barvorschuss-Management** mit Anordnungsnummern und Teil-Vorschüssen
- 📁 **Excel-Import** für Buchungen
- 🔐 **Multi-User-Zugriff** (Kassier + Leserechte)
- 🏢 **Kostenstellen** für verschiedene Sachgebiete

### Basiert auf:

[VereinO](https://github.com/Hubertoink/VereinO) – Finanzmanagement für gemeinnützige Vereine

---

## ✨ Features

### 📊 Dashboard

- KPI-Karten: Kassenstand, Einnahmen/Ausgaben, Budgetauslastung
- Charts: Visualisierung von Budget vs. Ist
- Widgets: Offene Barvorschüsse, ÜL-Rechnungen

### 💰 Buchungsverwaltung

- Sach- und Honorarbuchungen
- Kategorisierung via Tag-System
- Belegverwaltung mit Datei-Upload (Drag & Drop)

### 👨‍🏫 Übungsleiter-Modul

- Stammdaten mit Status (Aktiv/Inaktiv/Ausstehend)
- Jahresobergrenze (z.B. 3.000€ ÜL-Pauschale) mit Restbudget-Anzeige
- Vertragsupload (PDF, Scans) direkt beim Anlegen
- Rechnungserfassung mit Datei-Anhang

### 💵 Barvorschuss-Modul

- Barvorschüsse mit Anordnungsnummer
- Teil-Vorschüsse an Mitarbeiter
- Abrechnungen mit Beleg-Upload
- Deckungsberechnung (Abrechnung − Auszahlung)

### 📥 Excel-Import

- Import von Buchungen via .xlsx
- Flexibles Spalten-Mapping
- Vorschau und Validierung

### 🔒 Datensicherheit

- Lokale SQLite-Datenbank
- Automatische Backups
- Backup & Restore mit Wahl des Speicherorts

---

## 🚀 Installation & Start

### Voraussetzungen

- [Node.js](https://nodejs.org/) **20 oder höher**
- npm (wird mit Node.js installiert)
- Git

### Schritt 1: Repository klonen

```bash
git clone https://github.com/[DEIN-USERNAME]/BudgetO.git
cd BudgetO
```

### Schritt 2: Abhängigkeiten installieren

```bash
npm install
```

### Schritt 3: Native Module für Electron bauen

```bash
npm run rebuild:native
```

### Schritt 4: Entwicklung starten

```bash
npm run dev
```

Die App öffnet sich automatisch im Entwicklungsmodus mit Hot-Reload.

---

## 📦 NPM-Befehle

| Befehl                   | Beschreibung                                           |
| ------------------------ | ------------------------------------------------------ |
| `npm run dev`            | Startet die App im Entwicklungsmodus (Hot-Reload)      |
| `npm run start`          | Alias für `npm run dev`                                |
| `npm run build`          | Baut die App für Produktion (ohne Packaging)           |
| `npm run preview`        | Startet die gebaute App zur Vorschau                   |
| `npm run package`        | Erstellt ausführbare Installer (.exe, .dmg, .AppImage) |
| `npm run rebuild:native` | Baut native Module (better-sqlite3) für Electron       |
| `npm run lint`           | Prüft Code mit ESLint                                  |
| `npm run format`         | Formatiert Code mit Prettier                           |
| `npm run test`           | Führt Jest Unit-Tests aus                              |
| `npm run test:e2e`       | Führt Playwright E2E-Tests aus                         |

### Produktions-Build erstellen

```bash
# 1. Build für Produktion
npm run build

# 2. Installer erstellen (Windows .exe, macOS .dmg, Linux .AppImage)
npm run package
```

Die erstellten Dateien findest du im `release/` Ordner:

| Plattform | Datei                     |
| --------- | ------------------------- |
| Windows   | `BudgetO-Setup-1.0.0.exe` |
| macOS     | `BudgetO-1.0.0.dmg`       |
| Linux     | `BudgetO-1.0.0.AppImage`  |

---

## 🏃 Schnellstart

1. **App starten:** `npm run dev` oder installierte Anwendung öffnen
2. **Setup-Wizard:** Beim ersten Start führt ein Assistent durch die Grundkonfiguration
3. **Organisation anlegen:** Sachgebiet/Kostenstelle definieren
4. **Module aktivieren:** In Einstellungen → Module die gewünschten Features aktivieren
5. **Budget planen:** Jahresbudget nach Kategorien erstellen
6. **Buchungen erfassen:** Ausgaben und Einnahmen buchen

---

## 🛠️ Technologie-Stack

### Desktop-App

| Technologie                 | Verwendung                       |
| --------------------------- | -------------------------------- |
| **Electron**                | Cross-Platform Desktop Framework |
| **React 18**                | UI-Bibliothek                    |
| **TypeScript**              | Typsichere Entwicklung           |
| **Vite**                    | Build-Tool & Dev-Server          |
| **electron-vite**           | Electron + Vite Integration      |
| **SQLite** (better-sqlite3) | Lokale Datenbank                 |
| **Zod**                     | Schema-Validierung               |
| **ExcelJS**                 | Excel-Import/Export              |

### Entwicklungstools

| Tool                 | Verwendung        |
| -------------------- | ----------------- |
| **ESLint**           | Code-Linting      |
| **Prettier**         | Code-Formatierung |
| **Jest**             | Unit-Tests        |
| **Playwright**       | E2E-Tests         |
| **electron-builder** | App-Packaging     |

---

## 📁 Projektstruktur

```
BudgetO/
├── electron/
│   ├── main/                 # Electron Main-Prozess
│   │   ├── db/               # Datenbank & Migrationen
│   │   │   ├── database.ts   # DB-Verbindung
│   │   │   └── migrations.ts # Schema-Migrationen
│   │   ├── ipc/              # IPC-Handler & Schemas
│   │   ├── repositories/     # Datenzugriffsschicht
│   │   │   ├── vouchers.ts   # Buchungen
│   │   │   ├── instructors.ts # Übungsleiter
│   │   │   └── cashAdvances.ts # Barvorschüsse
│   │   └── services/         # Business-Logik
│   └── preload/              # Preload/IPC-Brücke
│       └── index.ts          # window.api Definition
├── src/
│   └── renderer/             # React-Anwendung
│       ├── assets/           # Bilder, Icons
│       ├── components/       # Wiederverwendbare UI-Komponenten
│       │   ├── layout/       # Navigation, Sidebar
│       │   └── modals/       # Modal-Dialoge
│       ├── context/          # React Context (Auth, UI, Module)
│       ├── hooks/            # Custom React Hooks
│       ├── views/            # Seiten/Views
│       │   ├── Dashboard/
│       │   ├── Journal/      # Buchungen
│       │   ├── Instructors/  # Übungsleiter
│       │   ├── CashAdvances/ # Barvorschüsse
│       │   ├── Budgets/
│       │   └── Settings/
│       ├── utils/            # Hilfsfunktionen
│       ├── App.tsx           # Haupt-App-Komponente
│       ├── main.tsx          # React Entry Point
│       └── styles.css        # Globale Styles
├── shared/                   # Gemeinsame Typen
├── build/                    # App-Icons & Ressourcen
├── package.json
├── electron-builder.yml      # Packaging-Konfiguration
├── electron.vite.config.ts   # Vite-Konfiguration
└── tsconfig.json
```

---

## 🔧 Module

BudgetO ist modular aufgebaut. Module können in den **Einstellungen → Module** aktiviert/deaktiviert werden:

| Modul                | Key            | Beschreibung                                |
| -------------------- | -------------- | ------------------------------------------- |
| 📊 Budgets           | `budgets`      | Jahresbudget-Planung mit Soll-Ist           |
| 👨‍🏫 Übungsleiter      | `instructors`  | ÜL-Verwaltung, Verträge, Rechnungen         |
| 💵 Barvorschüsse     | `cash-advance` | Anordnungsnummern, Teil-Vorschüsse, Deckung |
| 📥 Excel-Import      | `excel-import` | Buchungsimport aus .xlsx                    |
| 👥 Mitglieder        | `members`      | Mitgliederverwaltung                        |
| 🎯 Zweckbindungen    | `earmarks`     | Zweckgebundene Mittel                       |
| 📄 Verbindlichkeiten | `invoices`     | Rechnungsverwaltung                         |

---

## 🤝 Mitwirken

Beiträge sind willkommen! So kannst du helfen:

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/NeuesFeature`)
3. Committe deine Änderungen (`git commit -m 'feat: Neues Feature'`)
4. Push zum Branch (`git push origin feature/NeuesFeature`)
5. Öffne einen Pull Request

### Commit-Konventionen

```
<type>(<scope>): <description>

Types: feat, fix, docs, refactor, test, chore
Scopes: instructors, cash-advance, budgets, excel-import, core, ui

Beispiele:
feat(instructors): Add contract upload
fix(cash-advance): Fix calculation of coverage
docs(readme): Update installation guide
```

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert.

---

## 📞 Kontakt & Support

- **GitHub Issues:** [Probleme melden](../../issues)
- **Basiert auf:** [VereinO](https://github.com/Hubertoink/VereinO)

---

_Made with ❤️ für die Jugendförderung_
