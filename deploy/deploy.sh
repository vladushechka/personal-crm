#!/usr/bin/env bash
# Deploys one app image to one environment on the server, staging or prod:
#   bash /opt/crm/<env>/deploy.sh <prod|staging> <image>
# prod: a database backup, migrations, then the new app, then a smoke check of /health; after
# that the daily backup is set up and images older than 2 weeks are removed.
# staging: the same without the backup, the daily backup and the cleanup.
# Run by CI: workflow Deploy staging after every push to main, workflow Deploy prod by the
# owner's button (a rollback there is this script with the image from previous-image).
# There is no automatic rollback: on any failure the script stops and exits non-zero.
set -euo pipefail
cd "$(dirname "$0")"

usage="Usage: deploy.sh <prod|staging> <image, e.g. ghcr.io/vladushechka/personal-crm:SHA>"
source ./env.sh "${1:?$usage}"
image="${2:?$usage}"
export APP_IMAGE="$image"

trap 'echo "DEPLOY FAILED ($CRM_ENV) at line $LINENO: $image" >&2' ERR

# One deploy per environment at a time: the next one waits for this one to finish
exec 9>deploy.lock
if ! flock -w 1800 9; then
  echo "Another $CRM_ENV deploy has been running for 30 minutes, giving up" >&2
  exit 1
fi

echo "==> Deploying $image to $CRM_ENV"
# CI pulls it before; a tag is a commit SHA, so an image already here is the right one
if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "==> Pulling the image"
  docker pull "$image"
fi

echo "==> Starting the database"
compose up -d --wait db

# Before migrations change anything; named after the version running now (backup.sh)
if [ "$CRM_ENV" = prod ]; then
  echo "==> Backing up the database"
  bash ./backup.sh before-deploy
fi

echo "==> Applying migrations"
if ! compose run --rm migrate; then
  echo "Migrations failed: the new version was NOT started, the old one keeps running" >&2
  exit 1
fi

echo "==> Starting the new version"
compose up -d --wait --wait-timeout 120 app

echo "==> Smoke check /health"
smoke

# Remember the current and previous images: Deploy prod rolls back to previous-image
current="$(cat current-image 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$image" ]; then
  echo "$current" > previous-image
fi
echo "$image" > current-image

if [ "$CRM_ENV" = prod ]; then
  # 03:00 Moscow time: the server clock is Moscow time. Output goes to the server journal
  echo "==> Daily backup at 03:00 (crontab of $(id -un))"
  marker="# personal-crm daily backup"
  job="0 3 * * * bash /opt/crm/prod/backup.sh daily 2>&1 | logger -t personal-crm-backup $marker"
  crontab_now="$(crontab -l 2>/dev/null || true)"
  if ! grep -qxF "$job" <<<"$crontab_now"; then
    { grep -vF "$marker" <<<"$crontab_now" || true; echo "$job"; } | crontab -
  fi

  # Staging and prod run from the same image repository. Kept: anything younger than 2 weeks,
  # the two latest prod versions (current and previous, for a rollback), the staging version
  echo "==> Removing images older than 2 weeks, except the 2 latest prod and the staging one"
  keep="$(cat current-image previous-image ../staging/current-image 2>/dev/null || true)"
  cutoff="$(date -d '14 days ago' +%s)"
  docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
    case "$ref" in *:'<none>') continue ;; esac
    grep -qxF "$ref" <<<"$keep" && continue
    created="$(docker image inspect -f '{{.Created}}' "$ref" 2>/dev/null)" || continue
    if [ "$(date -d "$created" +%s)" -lt "$cutoff" ]; then
      docker image rm "$ref" || true
    fi
  done
fi

echo "==> Deployed $image to $CRM_ENV"
