#!/usr/bin/env bash
# Pull, build, migrate, restart. Safe to re-run.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
    echo "ERROR: infra/.env missing. Copy from ../.env.example and fill in."
    exit 1
fi

echo "==> git pull"
(cd .. && git pull --ff-only)

echo "==> docker compose build"
docker compose -f docker-compose.prod.yml --env-file .env build backend worker mini-app

echo "==> Run migrations"
docker compose -f docker-compose.prod.yml --env-file .env run --rm backend \
    alembic upgrade head

echo "==> Restart services"
docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "==> Health"
sleep 3
docker compose -f docker-compose.prod.yml --env-file .env ps
curl -fsS "http://localhost:8000/health" || true

echo "==> Done."
