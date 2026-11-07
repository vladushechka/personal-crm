#!/usr/bin/env bash
# Deploys one app image on the server: a database backup, migrations, then the new app, then a
# smoke check of /health.
# Run by CI after every push to main. A manual rollback is the same command with the previous image:
#   bash /opt/crm/prod/deploy.sh "$(cat /opt/crm/prod/previous-image)"
# There is no automatic rollback: on any failure the script stops and exits non-zero.
set -euo pipefail
cd "$(dirname "$0")"

image="${1:?Usage: deploy.sh <image, e.g. ghcr.io/vladushechka/personal-crm:SHA>}"
export APP_IMAGE="$image"

trap 'echo "DEPLOY FAILED at line $LINENO: $image" >&2' ERR

compose() {
  docker compose -p prod -f docker-compose.yml "$@"
}

echo "==> Pulling $image"
docker pull "$image"

echo "==> Starting the database"
compose up -d --wait db

# Before migrations change anything; named after the version running now (backup.sh)
echo "==> Backing up the database"
bash ./backup.sh before-deploy

echo "==> Applying migrations"
if ! compose run --rm migrate; then
  echo "Migrations failed: the new version was NOT started, the old one keeps running" >&2
  exit 1
fi

echo "==> Starting the new version"
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

# Remember the current and previous images for a manual rollback
current="$(cat current-image 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$image" ]; then
  echo "$current" > previous-image
fi
echo "$image" > current-image

echo "==> Removing older images, keeping current and previous"
previous="$(cat previous-image 2>/dev/null || true)"
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
  if [ "$ref" != "$image" ] && [ "$ref" != "$previous" ]; then
    docker image rm "$ref" || true
  fi
done

echo "==> Deployed $image"
