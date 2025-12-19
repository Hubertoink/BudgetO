# 🎯 BudgetO – Projektplan

## Budget- und Finanzmanagement für die Jugendförderung

### Basierend auf VereinO (Fork von github.com/Hubertoink/VereinO)

---

## ✅ Abgeschlossene Setup-Schritte

- [x] Repository geklont (VereinO → BudgetO)
- [x] Git Remote umbenannt (origin → upstream)
- [x] Branding angepasst (package.json, electron-builder.yml, index.html, App.tsx)
- [x] README.md für BudgetO erstellt
- [x] Tag-System um Beschreibungsfeld erweitert (Migration 21)
- [x] Copilot Instructions aktualisiert

---

## 📋 Projektübersicht

**Ziel:** Eine modulare Budget-App für die Jugendförderung, die outputorientierte Finanzplanung ermöglicht.

**Basis-Technologie (von VereinO):**

- **Frontend:** Electron + React + TypeScript + Vite
- **Datenbank:** SQLite (lokal) + PostgreSQL (Cloud/Multi-User)
- **Backend:** Fastify (für Cloud-Features)
- **Build:** Electron-Builder (Windows EXE, macOS DMG, Linux AppImage)

---

## 🏗️ Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                      BudgetO App                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MODULE (an/ausschaltbar)                │   │
│  ├──────────────┬──────────────┬──────────────┬─────────┤   │
│  │   Budgets    │ Honorare/ÜL  │ Barvorschuss │ Import  │   │
│  │   Modul      │   Modul      │    Modul     │  Modul  │   │
│  └──────────────┴──────────────┴──────────────┴─────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  KERNFUNKTIONEN                      │   │
│  ├──────────────┬──────────────┬────────────────────────┤   │
│  │  Buchungen   │    Belege    │   Reports/Export       │   │
│  └──────────────┴──────────────┴────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              BENUTZER & RECHTE                       │   │
│  ├──────────────┬──────────────┬────────────────────────┤   │
│  │   Kassier    │  Leserechte  │   Cloud-Sync           │   │
│  │   (Admin)    │    User      │   (Multi-PC)           │   │
│  └──────────────┴──────────────┴────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   DATENBANK                          │   │
│  ├─────────────────────┬────────────────────────────────┤   │
│  │  SQLite (lokal)     │  PostgreSQL (zentral/Cloud)   │   │
│  └─────────────────────┴────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Module (Ein-/Ausschaltbar)

### 1️⃣ Modul: Jahresbudget (outputorientierte Finanzierung)

- [ ] Budgetplanung nach Kostenarten
- [ ] Soll-Ist-Vergleich in Echtzeit
- [ ] Budgetwarnung bei Überschreitung
- [ ] Outputziele definieren und tracken
- [ ] Jahresabschluss-Report

### 2️⃣ Modul: Sach- und Honorarbuchungen

- [ ] Trennung Sachkosten vs. Honorarkosten
- [ ] Kostenstellen-Zuordnung

### 3️⃣ Modul: Übungsleiter (ÜL) Verwaltung

- [ ] Übungsleiterdatenbank (Name, Kontakt, Steuernr.)
- [ ] Jahresobergrenze pro ÜL (z.B. Übungsleiterpauschale)
- [ ] Stundensatz und Abrechnungsmodell
- [ ] Vertragsupload (PDF) und Verknüpfung
- [ ] Rechnungseingang und Auszahlungsstatus
- [ ] Restbudget-Anzeige pro ÜL

### 4️⃣ Modul: Barvorschüsse

- [ ] Anordnungsnummer (Pflichteingabe)
- [ ] Haupt-Barvorschuss von Stadtkasse
- [ ] Teil-Barvorschüsse an Mitarbeiter
- [ ] Status-Tracking:
  - Ausgegeben am: [Datum]
  - Aufgelöst am: [Datum]
  - Über-/Unterdeckung
- [ ] Verknüpfung mit Belegen
- [ ] Offene Barvorschüsse Dashboard-Widget

### 5️⃣ Modul: Excel-Import

- [ ] Import von Buchungen via Excel (.xlsx)
- [ ] Spalten-Mapping (flexibel konfigurierbar)
- [ ] Vorschau vor Import
- [ ] Duplikat-Erkennung
- [ ] Import-Protokoll

### 6️⃣ Modul: Berichtswesen (Reports)

- [ ] Jahresübersicht
- [ ] Monatsberichte
- [ ] ÜL-Abrechnungsübersicht
- [ ] Barvorschuss-Historie
- [ ] Export: Excel, PDF

---

## 👥 Benutzer- und Rechteverwaltung

### Rollen

| Rolle               | Beschreibung           | Rechte                                                |
| ------------------- | ---------------------- | ----------------------------------------------------- |
| **Kassier (Admin)** | Hauptverantwortlicher  | Vollzugriff: Lesen, Schreiben, Löschen, Einstellungen |
| **Leserechte-User** | Prüfer, Vorstand, etc. | Nur Lesen: Buchungen, Reports, Dashboards einsehen    |

### Zentrale Datenbank (Multi-PC-Zugriff)

**Option A: Netzlaufwerk (Einfach)**

```
\\Server\Freigabe\BudgetO\database.sqlite
```

- SQLite-Datei auf Netzlaufwerk
- ⚠️ Nur ein gleichzeitiger Schreibzugriff empfohlen

**Option B: PostgreSQL-Server (Empfohlen für Multi-User)**

```
┌─────────┐     ┌─────────┐     ┌─────────────────┐
│  PC 1   │────▶│         │     │                 │
│ Kassier │     │  Cloud  │────▶│  PostgreSQL DB  │
└─────────┘     │  Server │     │  (Docker)       │
┌─────────┐     │         │     │                 │
│  PC 2   │────▶│         │     └─────────────────┘
│ Leser   │     └─────────┘
└─────────┘
```

- Echter Multi-User-Zugriff
- Rollenverwaltung auf DB-Ebene
- Docker-Compose bereits in VereinO vorhanden

---

## 🗓️ Phasen-Plan

### Phase 0: Setup & Fork (1 Woche)

- [ ] Repository forken
- [ ] Umbenennung zu BudgetO
- [ ] Entwicklungsumgebung einrichten
- [ ] Branding anpassen (Logo, Titel, About)

### Phase 1: Modul-System (2 Wochen)

- [ ] Modul-Registry implementieren
- [ ] Ein-/Ausschalten in Einstellungen
- [ ] Dynamische Navigation
- [ ] Datenbankschema modular erweitern

### Phase 2: Benutzer & Rechte (2-3 Wochen)

- [ ] Login-System
- [ ] Rollen-Verwaltung
- [ ] Lese-/Schreibrechte-Prüfung
- [ ] Cloud-DB-Anbindung (PostgreSQL)
- [ ] Multi-PC-Sync testen

### Phase 3: Übungsleiter-Modul (3 Wochen)

- [ ] DB-Schema: Übungsleiter-Tabelle
- [ ] CRUD-Interface
- [ ] Vertragsupload (Datei-Handling)
- [ ] Rechnungsverknüpfung
- [ ] Jahresobergrenze & Restbudget

### Phase 4: Barvorschuss-Modul (2-3 Wochen)

- [ ] DB-Schema: Barvorschüsse, Teil-Barvorschüsse
- [ ] Anordnungsnummer-System
- [ ] Ausgabe-/Auflösungs-Workflow
- [ ] Über-/Unterdeckung berechnen
- [ ] Dashboard-Widget

### Phase 5: Excel-Import (2 Wochen)

- [ ] Excel-Parser (xlsx-Bibliothek)
- [ ] Spalten-Mapping UI
- [ ] Vorschau & Validierung
- [ ] Import-Logik
- [ ] Fehlerbehandlung

### Phase 6: Budget-Erweiterung (2 Wochen)

- [ ] Outputorientierte Struktur
- [ ] Verknüpfung mit Kostenarten
- [ ] Visualisierung (Charts)
- [ ] Jahresabschluss

### Phase 7: Testing & Dokumentation (2 Wochen)

- [ ] E2E-Tests erweitern
- [ ] Benutzerhandbuch
- [ ] Admin-Dokumentation
- [ ] Release-Build

---

## 📊 Datenbank-Schema (Erweiterungen)

### Neue Tabellen

```sql
-- Übungsleiter
CREATE TABLE instructor (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_id TEXT,
    hourly_rate DECIMAL(10,2),
    annual_limit DECIMAL(10,2),  -- Jahresobergrenze
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Übungsleiter-Verträge
CREATE TABLE instructor_contract (
    id INTEGER PRIMARY KEY,
    instructor_id INTEGER REFERENCES instructor(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    valid_from DATE,
    valid_until DATE,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Übungsleiter-Rechnungen
CREATE TABLE instructor_invoice (
    id INTEGER PRIMARY KEY,
    instructor_id INTEGER REFERENCES instructor(id),
    invoice_number TEXT,
    amount DECIMAL(10,2),
    hours DECIMAL(5,2),
    invoice_date DATE,
    paid_at DATE,
    status TEXT DEFAULT 'pending',  -- pending, approved, paid
    journal_entry_id INTEGER REFERENCES journal_entry(id)
);

-- Barvorschüsse (Hauptvorschuss)
CREATE TABLE cash_advance (
    id INTEGER PRIMARY KEY,
    order_number TEXT NOT NULL,  -- Anordnungsnummer
    amount DECIMAL(10,2) NOT NULL,
    source TEXT DEFAULT 'STADTKASSE',
    received_at DATE NOT NULL,
    resolved_at DATE,
    status TEXT DEFAULT 'open',  -- open, resolved
    over_under_coverage DECIMAL(10,2),
    notes TEXT
);

-- Teil-Barvorschüsse
CREATE TABLE partial_cash_advance (
    id INTEGER PRIMARY KEY,
    cash_advance_id INTEGER REFERENCES cash_advance(id),
    employee_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    issued_at DATE NOT NULL,
    resolved_at DATE,
    returned_amount DECIMAL(10,2),
    status TEXT DEFAULT 'open',  -- open, resolved
    notes TEXT
);

-- Modul-Konfiguration
CREATE TABLE module_config (
    id INTEGER PRIMARY KEY,
    module_key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    config_json TEXT
);

-- Benutzer
CREATE TABLE user (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'admin', 'reader'
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

---

## 🔧 Technische Details

### Modul-System Implementierung

```typescript
// src/renderer/modules/ModuleRegistry.ts
interface Module {
  key: string;
  name: string;
  icon: string;
  component: React.ComponentType;
  routes: Route[];
  enabled: boolean;
}

const modules: Module[] = [
  { key: 'budgets', name: 'Budgets', ... },
  { key: 'instructors', name: 'Übungsleiter', ... },
  { key: 'cash-advance', name: 'Barvorschüsse', ... },
  { key: 'excel-import', name: 'Excel-Import', ... },
];
```

### Multi-User Architektur

```yaml
# docker-compose.yml (Erweiterung)
services:
  budgeto-db:
    image: postgres:16
    environment:
      POSTGRES_DB: budgeto
      POSTGRES_USER: budgeto_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - budgeto-data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
```

---

## 📝 Geklärte Anforderungen

| Frage                    | Antwort                                               |
| ------------------------ | ----------------------------------------------------- |
| **Geschäftsjahr**        | Kalenderjahr ✅                                       |
| **MwSt**                 | Nicht relevant, nur Bruttobuchungen ✅                |
| **Kategorien**           | Über Tag-System mit Beschreibung (flexibel) ✅        |
| **Genehmigungsworkflow** | Nicht erforderlich ✅                                 |
| **Audit-Trail**          | Nice-to-have, wenn Multi-User                         |
| **Backups**              | Ja, mit Wahlmöglichkeit (bereits vorhanden) ✅        |
| **Kostenstellen**        | Über bestehende Organisationen/Vereine realisieren ✅ |

### Empfohlene Ergänzungen:

| Feature                       | Beschreibung                                          | Priorität |
| ----------------------------- | ----------------------------------------------------- | --------- |
| **Dashboard-Widgets**         | Schnellübersicht: Offene ÜL-Rechnungen, Barvorschüsse | Hoch      |
| **Benachrichtigungen**        | Warnung bei Budgetüberschreitung                      | Mittel    |
| **Audit-Trail**               | Wer hat was wann geändert                             | Hoch      |
| **Automatische Backups**      | Tägliche Sicherung                                    | Mittel    |
| **Jahresabschluss-Assistent** | Geführter Abschluss-Workflow                          | Niedrig   |
| **Suchfunktion**              | Globale Suche über alle Daten                         | Mittel    |
| **Favoriten/Schnellzugriff**  | Häufig genutzte Buchungsvorlagen                      | Niedrig   |
| **Kostenstellen**             | Mehrere Projekte/Abteilungen                          | Mittel    |
| **Druckvorlagen**             | Anpassbare Belege/Reports                             | Niedrig   |

---

## 🚀 Nächste Schritte

1. **Repository klonen und forken**

   ```bash
   git clone https://github.com/Hubertoink/VereinO.git BudgetO
   cd BudgetO
   git remote set-url origin https://github.com/[DEIN-USERNAME]/BudgetO.git
   ```

2. **Abhängigkeiten installieren**

   ```bash
   npm install
   ```

3. **App im Entwicklungsmodus starten**

   ```bash
   npm run dev
   ```

4. **Branding anpassen** (Logo, Titel, etc.)

5. **Mit Phase 1 (Modul-System) beginnen**

---

## 📞 Kontakt & Support

**Projekt:** BudgetO – Budgetverwaltung für Jugendförderung
**Basiert auf:** [VereinO](https://github.com/Hubertoink/VereinO)
**Lizenz:** MIT

---

_Erstellt: 19. Dezember 2024_
_Version: 1.0 (Initialer Projektplan)_
