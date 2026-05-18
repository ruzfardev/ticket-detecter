#!/usr/bin/env bash
# Daily pg_dump backup. Schedule via root crontab:
#   30 3 * * * /opt/ticket-detecter/infra/backup/backup.sh >> /var/log/ticketbot-backup.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${BACKUP_DIR:-/var/backups/ticketbot}"
TS=$(date +%Y%m%d_%H%M%S)
RETAIN_DAYS=${RETAIN_DAYS:-14}

mkdir -p "$DEST"

# Run pg_dump inside the compose service so we don't need pg_dump on the host
docker compose -f "$ROOT/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-ticketbot}" "${POSTGRES_DB:-ticketbot}" \
    | gzip > "$DEST/dump_${TS}.sql.gz"

echo "Backup written: $DEST/dump_${TS}.sql.gz"

# Retention
find "$DEST" -name "dump_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
