#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-dgym_user}"
POSTGRES_DB="${POSTGRES_DB:-dgym_prod}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

STAMP="$(date -u +%Y%m%d_%H%M%S)"
TARGET_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$TARGET_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "[backup] Dumping PostgreSQL database (${POSTGRES_DB})..."
compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-privileges > "$TARGET_DIR/db.dump"

echo "[backup] Verifying pg_dump archive readability..."
compose exec -T db pg_restore --list < "$TARGET_DIR/db.dump" >/dev/null

echo "[backup] Archiving uploaded assets (/app/uploads)..."
compose exec -T backend tar -czf - -C /app uploads > "$TARGET_DIR/uploads.tar.gz"
tar -tzf "$TARGET_DIR/uploads.tar.gz" >/dev/null

(cd "$TARGET_DIR" && sha256sum db.dump uploads.tar.gz > SHA256SUMS)
chmod 600 "$TARGET_DIR/db.dump" "$TARGET_DIR/uploads.tar.gz" "$TARGET_DIR/SHA256SUMS"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
fi

echo "[backup] Completed cleanly: $TARGET_DIR"
