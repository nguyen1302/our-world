#!/bin/sh
set -e
echo "Starting worker..."
exec node_modules/.bin/tsx src/worker/index.ts
