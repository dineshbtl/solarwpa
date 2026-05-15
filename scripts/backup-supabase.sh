#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/solar-epc/backups"
CONTAINER_NAME="supabase-db"
RETENTION_DAYS=14
TIMESTAMP="$(date +%F_%H-%M-%S)"
OUT_FILE="${BACKUP_DIR}/supabase_pg_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[backup] docker command not found"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -Fx "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "[backup] container ${CONTAINER_NAME} is not running"
  exit 1
fi

echo "[backup] starting dump to ${OUT_FILE}"
docker exec "${CONTAINER_NAME}" pg_dumpall -U postgres > "${OUT_FILE}"

echo "[backup] compressing ${OUT_FILE}"
gzip -f "${OUT_FILE}"

echo "[backup] pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -name "supabase_pg_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[backup] done: ${OUT_FILE}.gz"
