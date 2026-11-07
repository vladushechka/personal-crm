#!/usr/bin/env bash
# Restores the production database from a backup made by backup.sh. Run by hand on the server:
#   bash /opt/crm/prod/restore.sh backups/<file>.dump
# Shows what it will replace and waits for "yes". Then: backs up the current database, stops
# the app, drops the database, creates it empty, loads the backup, starts the app again.
# The app version stays the same; for a full rollback see README, "Бэкапы и восстановление".
set -euo pipefail
cd "$(dirname "$0")"

file="${1:?Usage: bash restore.sh backups/<file>.dump}"
if [ ! -f "$file" ]; then
  echo "No such file: $file" >&2
  exit 1
fi

APP_IMAGE="$(cat current-image)"
export APP_IMAGE

# Docker commands get no keyboard input: only the "yes" question reads it
compose() {
  docker compose -p prod -f docker-compose.yml "$@" </dev/null
}

# Reads the backup file on its input
compose_with_file() {
  docker compose -p prod -f docker-compose.yml "$@" <"$file"
}

compose up -d --wait db
if ! compose_with_file exec -T db pg_restore --list >/dev/null; then
  echo "$file is not a database backup, nothing changed" >&2
  exit 1
fi
database="$(compose exec -T db printenv POSTGRES_DB)"

echo
echo "Database \"$database\" will be DELETED and replaced with the backup"
echo "  $file ($(du -h "$file" | cut -f1), made $(TZ=Europe/Moscow date -r "$file" '+%Y-%m-%d %H:%M') Moscow time)"
echo "The app is stopped meanwhile and comes back with the same version: ${APP_IMAGE##*:}"
echo
read -r -p 'Type yes to continue: ' answer || answer=""
if [ "$answer" != "yes" ]; then
  echo "Cancelled, nothing changed"
  exit 1
fi

echo "==> Backing up the current database first"
snapshot="$(bash ./backup.sh before-restore </dev/null | tail -n 1)"

trap 'echo "RESTORE FAILED at line $LINENO. The database as it was before: $snapshot" >&2' ERR

echo "==> Stopping the app"
compose stop app

echo "==> Replacing the database"
compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB"'
compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
compose_with_file exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error --single-transaction'

echo "==> Starting the app"
compose up -d --wait --wait-timeout 120 app

echo "==> Smoke check /health"
for attempt in $(seq 1 10); do
  if curl -fsS http://127.0.0.1:3000/health; then
    echo
    healthy=1
    break
  fi
  sleep 3
done
if [ "${healthy:-}" != 1 ]; then
  echo "Smoke check failed: /health does not answer 200" >&2
  exit 1
fi

echo "==> Restored $file"
echo "The database as it was before the restore: $snapshot"
