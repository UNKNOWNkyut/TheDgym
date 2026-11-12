#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup_dir> [--yes]" >&2
  exit 1
fi

BACKUP_DIR="$1"
AUTO_CONFIRM="${2:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing env file: $ENV_FILE" >&2
  exit 1
fi
if [ ! -f "$BACKUP_DIR/db.dump" ] || [ ! -f "$BACKUP_DIR/uploads.tar.gz" ]; then
  echo "ERROR: Backup directory missing db.dump or uploads.tar.gz: $BACKUP_DIR" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-dgym_user}"
POSTGRES_DB="${POSTGRES_DB:-dgym_prod}"

if [ "$AUTO_CONFIRM" != "--yes" ]; then
  read -r -p "Restore will OVERWRITE database '${POSTGRES_DB}' and uploads. Continue? [yes/N]: " ans
  if [ "$ans" != "yes" ]; then
    echo "Restore aborted."
    exit 1
  fi
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if [ -f "$BACKUP_DIR/SHA256SUMS" ]; then
  echo "[restore] Verifying backup checksums..."
  (cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
fi

echo "[restore] Validating dump archive..."
compose exec -T db pg_restore --list < "$BACKUP_DIR/db.dump" >/dev/null
tar -tzf "$BACKUP_DIR/uploads.tar.gz" >/dev/null

echo "[restore] Stopping backend before restore..."
compose stop backend

echo "[restore] Resetting and restoring PostgreSQL database '${POSTGRES_DB}'..."
compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
compose exec -T db pg_restore \
  --no-owner \
  --no-privileges \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" < "$BACKUP_DIR/db.dump"

echo "[restore] Restoring /app/uploads volume..."
compose run --rm -T --no-deps --entrypoint sh backend \
  -c "mkdir -p /app/uploads && rm -rf /app/uploads/* && tar -xzf - -C /app" < "$BACKUP_DIR/uploads.tar.gz"

echo "[restore] Starting backend and checking health..."
compose up -d backend
for _ in $(seq 1 15); do
  if compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" >/dev/null 2>&1; then
    echo "[restore] Completed and /api/health is OK."
    exit 0
  fi
  sleep 2
done

echo "WARNING: Restore finished, but /api/health did not become healthy within 30s." >&2
exit 1
