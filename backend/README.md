# VereinO Backend API

Fastify-based REST API für VereinO mit PostgreSQL und JWT-Authentifizierung.

## Voraussetzungen

- Node.js 20+
- PostgreSQL 16+
- Docker & Docker Compose (für Container-Deployment)

## Installation

```bash
cd backend
npm install
```

## Konfiguration

Erstelle eine `.env` Datei:

```bash
cp .env.example .env
```

Passe die Werte an:

```env
DATABASE_URL=postgresql://vereino:password@localhost:5432/vereino
JWT_SECRET=dein_geheimer_jwt_key
PORT=3000
CORS_ORIGIN=*
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Entwicklung

### Lokale Entwicklung

```bash
# Database starten (mit Docker)
docker run -d \
  --name vereino-postgres \
  -e POSTGRES_USER=vereino \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=vereino \
  -p 5432:5432 \
  postgres:16-alpine

# Migrationen ausführen
npm run migrate

# Dev-Server starten (mit Hot Reload)
npm run dev
```

Server läuft auf `http://localhost:3000`.

### Docker Compose (Empfohlen)

```bash
# In Projektroot (nicht backend/)
cp .env.docker.example .env

# Container starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f backend

# Container stoppen
docker-compose down

# Volumes löschen (Daten werden gelöscht!)
docker-compose down -v
```

## API-Endpunkte

### Authentifizierung

- `POST /api/auth/register` - Neuen User + Organisation registrieren
- `POST /api/auth/login` - Login (liefert JWT-Token)
- `GET /api/auth/me` - Aktuellen User abrufen (benötigt Token)

### Belege (Vouchers)

- `GET /api/vouchers` - Liste aller Belege (mit Pagination)
- `GET /api/vouchers/:id` - Einzelner Beleg mit Buchungen + Anhängen
- `POST /api/vouchers` - Neuen Beleg erstellen
- `DELETE /api/vouchers/:id` - Beleg löschen

### Mitglieder

- `GET /api/members` - Liste aller Mitglieder (mit Suche)
- `GET /api/members/:id` - Einzelnes Mitglied
- `POST /api/members` - Neues Mitglied erstellen
- `PATCH /api/members/:id` - Mitglied aktualisieren
- `DELETE /api/members/:id` - Mitglied löschen

### Health Check

- `GET /health` - Server-Status

## Authentifizierung

Alle Endpunkte (außer `/api/auth/*` und `/health`) benötigen einen JWT-Token im Header:

```
Authorization: Bearer <token>
```

Beispiel mit `curl`:

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r .token)

# Belege abrufen
curl http://localhost:3000/api/vouchers \
  -H "Authorization: Bearer $TOKEN"
```

## Multi-Tenancy

Alle Daten sind organisationsbezogen (`organization_id`). Jeder User kann nur Daten seiner eigenen Organisation sehen/bearbeiten.

## Deployment auf Mittwald

1. Repository auf Server clonen
2. `.env` Datei mit Production-Werten erstellen
3. Docker Compose starten:

```bash
docker-compose up -d
```

4. SSL/TLS über Reverse Proxy (Traefik/Nginx) einrichten
5. CORS_ORIGIN auf Electron-App-Domain beschränken

## Sicherheit

- Passwörter werden mit bcrypt gehashed (Faktor 10)
- JWT-Tokens ablaufen nach 7 Tagen
- SQL-Injection-Schutz durch parametrisierte Queries
- CORS konfigurierbar
- File-Upload limitiert auf 10MB (konfigurierbar)

## Entwickler-Notizen

- TypeScript Strict Mode aktiv
- ESLint + Prettier für Code-Qualität
- Zod für Request-Validierung
- PostgreSQL mit Indexes für Performance
- Graceful Shutdown implementiert

## Troubleshooting

### Port bereits belegt

```bash
# Prozess auf Port 3000 finden
lsof -i :3000

# Oder Port in .env ändern
PORT=3001
```

### Datenbankverbindung fehlgeschlagen

```bash
# PostgreSQL-Container-Logs prüfen
docker logs vereino-postgres

# Verbindung testen
psql postgresql://vereino:dev_password@localhost:5432/vereino
```

### Migration-Fehler

```bash
# Manuell SQL ausführen
psql postgresql://vereino:dev_password@localhost:5432/vereino < backend/migrations/001_initial_schema.sql
```
