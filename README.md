# 🎯 BudgetO – Budget- und Finanzmanagement für die Jugendförderung

> Outputorientierte Finanzplanung • Electron + React + TypeScript • MIT License

---

## 📋 Inhaltsverzeichnis

- [Über das Projekt](#-über-das-projekt)
- [Features](#-features)
- [Installation](#-installation)
- [Schnellstart](#-schnellstart)
- [Technologie-Stack](#️-technologie-stack)
- [Projektstruktur](#-projektstruktur)
- [Mitwirken](#-mitwirken)
- [Lizenz](#-lizenz)

---

## 🎯 Über das Projekt

**BudgetO** ist eine speziell für die Jugendförderung entwickelte Budget- und Finanzverwaltungssoftware. Die App ermöglicht eine einfache und übersichtliche Budgetplanung nach dem Grundsatz der **outputorientierten Finanzierung**.

### Kernfunktionen:
- 📊 **Jahresbudget-Planung** mit Soll-Ist-Vergleich
- 👥 **Übungsleiter-Verwaltung** mit Verträgen und Rechnungen
- 💵 **Barvorschuss-Management** mit Anordnungsnummern
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
- Kategorisierung via Tag-System (mit Beschreibung)
- Belegverwaltung mit Datei-Upload

### 👨‍🏫 Übungsleiter-Modul
- Stammdaten: Name, Kontakt, Stundensatz
- Jahresobergrenze und Restbudget-Anzeige
- Vertragsupload (PDF) mit Verknüpfung
- Rechnungserfassung und Auszahlungsstatus

### 💵 Barvorschuss-Modul
- Haupt-Barvorschuss von Stadtkasse
- Teil-Barvorschüsse an Mitarbeiter
- Anordnungsnummer als Pflichtfeld
- Ausgabe-/Auflösungsdatum mit Über-/Unterdeckung

### 📥 Excel-Import
- Import von Buchungen via .xlsx
- Flexibles Spalten-Mapping
- Vorschau und Validierung

### 👥 Benutzer & Rechte
| Rolle | Beschreibung |
|-------|-------------|
| **Kassier (Admin)** | Vollzugriff: Lesen, Schreiben, Einstellungen |
| **Leserechte-User** | Nur Lesen: Dashboards, Reports, Buchungen |

### 🏢 Kostenstellen / Organisationen
- Mehrere Sachgebiete verwalten
- Unabhängige Budgets pro Kostenstelle

### 🔒 Datensicherheit
- Lokale SQLite-Datenbank
- Optionale Cloud-Synchronisation (PostgreSQL)
- Backup & Restore mit Wahl des Speicherorts

---

## 🚀 Installation

### Voraussetzungen
- [Node.js](https://nodejs.org/) 20 oder höher
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

### Schritt 3: Entwicklung starten
```bash
npm run dev
```

### Schritt 4: Ausführbare Datei erstellen
```bash
npm run build
npm run package
```

Die erstellten Dateien findest du im `release/` Ordner:
| Plattform | Datei |
|-----------|-------|
| Windows | `.exe` (Installer) |
| macOS | `.dmg` |
| Linux | `.AppImage` |

---

## 🏃 Schnellstart

1. **App starten:** Öffne die installierte Anwendung
2. **Setup-Wizard:** Beim ersten Start führt ein Assistent durch die Grundkonfiguration
3. **Kostenstelle anlegen:** Sachgebiet/Organisation definieren
4. **Budget planen:** Jahresbudget nach Kategorien erstellen
5. **Buchungen erfassen:** Ausgaben und Einnahmen buchen

---

## 🛠️ Technologie-Stack

### Desktop-App
- **Electron** – Cross-Platform Desktop Framework
- **React** – UI-Bibliothek
- **TypeScript** – Typsichere Entwicklung
- **Vite** – Build-Tool & Dev-Server
- **SQLite** (better-sqlite3) – Lokale Datenbank

### Backend (Multi-User)
- **Fastify** – Web-Framework
- **PostgreSQL** – Relationale Datenbank
- **Docker** – Container-Deployment

### Entwicklungstools
- **ESLint & Prettier** – Code-Qualität
- **Playwright** – E2E-Tests
- **Jest** – Unit-Tests

---

## 📁 Projektstruktur

```
BudgetO/
├── electron/
│   ├── main/           # Electron Main-Prozess
│   │   ├── db/         # Datenbank-Logik & Migrationen
│   │   ├── ipc/        # IPC-Handler
│   │   ├── repositories/  # Datenzugriffsschicht
│   │   └── services/   # Business-Logik
│   └── preload/        # Preload/IPC-Brücke
├── src/
│   └── renderer/       # React-Anwendung
│       ├── components/ # UI-Komponenten
│       ├── views/      # Seiten (Dashboard, Journal, etc.)
│       ├── hooks/      # Custom React Hooks
│       └── context/    # React Context Provider
├── backend/            # Cloud-API (Fastify)
├── shared/             # Gemeinsame Typen
└── docs/               # Dokumentation
```

---

## 🔧 Module (Ein-/Ausschaltbar)

BudgetO ist modular aufgebaut. Module können in den Einstellungen aktiviert/deaktiviert werden:

| Modul | Beschreibung |
|-------|-------------|
| `budgets` | Jahresbudget-Planung |
| `instructors` | Übungsleiter-Verwaltung |
| `cash-advance` | Barvorschuss-Management |
| `excel-import` | Excel-Import von Buchungen |

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

*Made with ❤️ für die Jugendförderung*
