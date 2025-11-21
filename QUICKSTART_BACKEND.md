# VereinO Backend - Schnellstart

## 🚀 Schnellstart mit Docker (Empfohlen)

```bash
# 1. Container starten (im Root-Verzeichnis)
docker-compose up -d --build

# 2. Logs prüfen
docker logs vereino-api -f

# 3. Datenbank-Status prüfen
docker logs vereino-db

# 4. Health Check
curl http://localhost:3000/health
```

Backend läuft auf `http://localhost:3000` ✅

**Hinweise:**
- Migrationen laufen automatisch beim Start
- PostgreSQL läuft auf Port 5432
- Volumes bleiben erhalten bei `docker-compose down`
- Für clean state: `docker-compose down -v`

## 🛠️ Lokale Entwicklung

```bash
# 1. Backend-Ordner öffnen
cd backend

# 2. Dependencies installieren
npm install

# 3. PostgreSQL starten (Docker)
docker run -d \
  --name vereino-postgres \
  -e POSTGRES_USER=vereino \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=vereino \
  -p 5432:5432 \
  postgres:16-alpine

# 4. .env erstellen
cp .env.example .env

# 5. Datenbank initialisieren
npm run migrate

# 6. Dev-Server starten
npm run dev
```

Server läuft auf `http://localhost:3000` mit Hot Reload ✅

## 🧪 Ersten User anlegen

**Via Electron App:**
1. In Einstellungen zu "Cloud-Modus" wechseln
2. Cloud-Login öffnen → "Registrieren"
3. E-Mail, Passwort, Vereinsname eingeben
4. Fertig! JWT wird automatisch gespeichert

**Via cURL (für Tests):**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "secret123",
    "organizationName": "Test Verein e.V."
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "organizationId": 1,
    "organizationName": "Test Verein e.V."
  }
}
```

## 📊 Nächste Schritte

1. **Electron-Adapter implementieren** (siehe `DOCKER_MIGRATION_PLAN.md` Phase 3)
2. **Login-Screen in Electron** (Modal für Cloud-Modus)
3. **App-Modus Switcher** (Lokal vs. Cloud)
4. **Production Deployment** (Mittwald mit SSL)

## 🐛 Troubleshooting

**Port 3000 belegt:**
```bash
# In .env ändern:
PORT=3001
```

**PostgreSQL-Verbindung schlägt fehl:**
```bash
docker logs vereino-postgres
```

**Migration fehlgeschlagen:**
```bash
# Manuell ausführen:
psql postgresql://vereino:dev_password@localhost:5432/vereino < backend/migrations/001_initial_schema.sql
```

## 📁 Ordnerstruktur

```
backend/
├── src/
│   ├── server.ts          # Hauptserver
│   ├── config/
│   │   └── database.ts    # DB-Connection
│   ├── middleware/
│   │   ├── auth.ts        # JWT-Middleware
│   │   └── error.ts       # Error-Handler
│   ├── routes/
│   │   ├── auth.ts        # Auth-Endpunkte
│   │   ├── vouchers.ts    # Beleg-Endpunkte
│   │   └── members.ts     # Mitglieder-Endpunkte
│   ├── types/
│   │   ├── database.ts    # DB-Typen
│   │   └── fastify.d.ts   # Fastify-Erweiterungen
│   └── scripts/
│       └── migrate.ts     # Migration-Runner
├── migrations/
│   └── 001_initial_schema.sql
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

---

## ✅ Status (21.11.2025)

**Fertiggestellt:**
- ✅ Backend läuft stabil mit Docker
- ✅ Auto-Migrationen funktionieren
- ✅ Auth-System vollständig (Register/Login)
- ✅ Electron-Adapter implementiert (LocalAdapter, CloudAdapter)
- ✅ UI-Integration abgeschlossen (Cloud-Login, Settings)
- ✅ CSP konfiguriert für Electron ↔ Backend Kommunikation

**Getestet:**
- ✅ Registrierung via Electron App
- ✅ Login via Electron App
- ✅ Mode-Switch (Lokal ↔ Cloud)

**Nächste Schritte:**
- Vouchers/Members/Budgets API-Routen
- File-Upload für Anhänge
- Production Deployment
