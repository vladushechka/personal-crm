#!/usr/bin/env bash
# Deploys one app image to one environment on the server, staging or prod:
#   bash /opt/crm/<env>/deploy.sh <prod|staging> <image>
# prod: a database backup, migrations, then the new app, then a smoke check of /health.
# staging: the same without the backup.
# Run by CI after every push to main, for both environments. A manual rollback of prod is the
# same command with the previous image:
#   bash /opt/crm/prod/deploy.sh prod "$(cat /opt/crm/prod/previous-image)"
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

# Remember the current and previous images for a manual rollback
current="$(cat current-image 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$image" ]; then
  echo "$current" > previous-image
fi
echo "$image" > current-image

# Both environments run from the same image repository: keep what either of them may need
echo "==> Removing older images, keeping the current and previous ones of prod and staging"
keep="$(cat ../prod/current-image ../prod/previous-image \
  ../staging/current-image ../staging/previous-image 2>/dev/null || true)"
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
  if [ "$ref" != "$image" ] && ! grep -qxF "$ref" <<<"$keep"; then
    docker image rm "$ref" || true
  fi
done

echo "==> Deployed $image to $CRM_ENV"
