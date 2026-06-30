#!/bin/sh
set -e
echo "Running migrations + seed..."
node_modules/.bin/tsx src/db/migrate.ts
node_modules/.bin/tsx src/db/seed.ts
echo "Starting web..."
exec node_modules/.bin/next start -p "${PORT:-3000}"
