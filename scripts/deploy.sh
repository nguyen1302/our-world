#!/usr/bin/env bash
# Deploy on the EC2 host: pull latest main + rebuild the app containers.
# Run manually (`bash scripts/deploy.sh`) or via the GitHub Actions CD workflow.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/apps/our-world}"
cd "$APP_DIR"

echo "==> git pull"
git fetch --all --prune
git reset --hard origin/main

echo "==> rebuild web + worker (postgres/caddy untouched)"
docker compose up -d --build web worker

echo "==> prune old images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> status"
docker compose ps
echo "✅ deploy done"
