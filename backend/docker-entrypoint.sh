#!/bin/sh
set -e

echo "🔄 Waiting for database to be ready..."
sleep 2

echo "🔄 Running database migrations..."
npm run migrate

echo "✅ Migrations completed, starting server..."
exec "$@"
