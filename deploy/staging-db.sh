#!/usr/bin/env bash
# Recreates the staging database as a copy of prod from a prod backup: the newest one, or the
# given file. Staging only; prod is not touched. Run on the server when staging needs fresh data
# or its database got spoiled:
#   bash /opt/crm/staging/staging-db.sh [/opt/crm/prod/backups/<file>.dump]
# Drops the staging database, loads the backup, applies the migrations of the staging version,
# removes the sign-in sessions and links that came from prod (sign-in on staging is separate),
# then starts the staging app again.
set -euo pipefail
cd "$(dirname "$0")"
source ./env.sh staging

# Not in the middle of a staging deploy (deploy.sh holds the same lock)
exec 9>deploy.lock
if ! flock -w 1800 9; then
  echo "A staging deploy has been running for 30 minutes, giving up" >&2
  exit 1
fi

# The newest backup: names start with the Moscow date and time (backup.sh)
file="${1:-$(ls -1 ../prod/backups/*.dump 2>/dev/null | sort | tail -n 1)}"
if [ ! -f "$file" ]; then
  echo "No prod backup to copy: ${file:-../prod/backups is empty}" >&2
  exit 1
fi

# The compose file needs an image even for commands that only touch the database
APP_IMAGE="$(cat current-image 2>/dev/null || echo none)"
export APP_IMAGE

# Docker commands get no keyboard input; the backup goes in only where it is read
db() {
  compose exec -T db "$@" </dev/null
}

echo "==> Copying $file into the staging database"
compose up -d --wait db </dev/null
if ! compose exec -T db pg_restore --list <"$file" >/dev/null; then
  echo "$file is not a database backup, nothing changed" >&2
  exit 1
fi

if [ "$APP_IMAGE" != none ]; then
  echo "==> Stopping the staging app"
  compose stop app </dev/null
fi

echo "==> Replacing the staging database"
db sh -c 'dropdb -U "$POSTGRES_USER" --force --if-exists "$POSTGRES_DB"'
db sh -c 'createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error --single-transaction' \
  <"$file"

# The backup may come from an older prod version than the one on staging
if [ "$APP_IMAGE" != none ]; then
  echo "==> Applying migrations of the staging version"
  compose run --rm migrate </dev/null
fi

# A backup made before sign-in existed has none of these tables
echo "==> Removing sign-in sessions and links copied from prod"
compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q' <<'SQL'
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sessions', 'verifications', 'magic_link_sends'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE %I', t);
    END IF;
  END LOOP;
END
$$;
SQL

if [ "$APP_IMAGE" = none ]; then
  echo "==> Done. No staging version deployed yet: the next deploy applies migrations and starts it"
  exit 0
fi

echo "==> Starting the staging app"
compose up -d --wait --wait-timeout 120 app </dev/null

echo "==> Smoke check /health"
smoke

echo "==> Staging database is now a copy of $file"
