#!/usr/bin/env bash
# Backs up the production database into backups/ (pg_dump, custom format for pg_restore).
# The name has the date (Moscow time) and the app version running now, i.e. before a deploy:
#   backups/2026-11-08_023000_6a9ab34_before-deploy.dump
# deploy.sh runs it before migrations, restore.sh before replacing the database.
# Usage: bash backup.sh [label]   - label is a word for the name, "manual" by default.
# Prints the path of the new backup as the last line.
set -euo pipefail
cd "$(dirname "$0")"
# Backups are for prod only; refuses to run from the staging folder
source ./env.sh prod

label="${1:-manual}"

# Backups hold personal data: only the owner of this folder can read them
umask 077
mkdir -p backups
chmod 700 backups

# The compose file needs an image even for commands that only touch the database
if [ -z "${APP_IMAGE:-}" ]; then
  APP_IMAGE="$(cat current-image 2>/dev/null || echo none)"
  export APP_IMAGE
fi

version="$(cat current-image 2>/dev/null || true)"
version="${version##*:}"
version="${version:0:7}"
file="backups/$(TZ=Europe/Moscow date +%Y-%m-%d_%H%M%S)_${version:-none}_${label}.dump"
partial="$file.partial"
trap 'rm -f "$partial"' EXIT

compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  </dev/null >"$partial"
# A file pg_restore can't read is not a backup
compose exec -T db pg_restore --list <"$partial" >/dev/null
mv "$partial" "$file"

echo "Backup saved: $file ($(du -h "$file" | cut -f1))" >&2
echo "$file"
