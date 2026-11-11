# Settings of one environment for the scripts in deploy/. Each environment has its own folder
# on the server, /opt/crm/prod and /opt/crm/staging, with its own copy of deploy/ and its own .env.
# Usage, from a script in that folder:
#   source ./env.sh prod|staging
# A script refuses to touch an environment from another environment's folder: the folder holds
# the .env, so a mix-up would start prod with the staging keys or the other way round.

case "${1:-}" in
  prod) APP_PORT=3000 ;;
  staging) APP_PORT=3001 ;;
  *)
    echo "Environment must be prod or staging, got: ${1:-nothing}" >&2
    exit 1
    ;;
esac
CRM_ENV="$1"
export APP_PORT

if [ "$(basename "$PWD")" != "$CRM_ENV" ]; then
  echo "This is $PWD: the $CRM_ENV scripts run only from /opt/crm/$CRM_ENV" >&2
  exit 1
fi

# The compose project is the environment: its own containers, network and database volume
compose() {
  docker compose -p "$CRM_ENV" -f docker-compose.yml "$@"
}

# The app of this environment answers 200 on /health, straight on its port, not through nginx
smoke() {
  local attempt
  for attempt in $(seq 1 10); do
    if curl -fsS "http://127.0.0.1:$APP_PORT/health"; then
      echo
      return 0
    fi
    sleep 3
  done
  echo "Smoke check failed: /health of $CRM_ENV does not answer 200" >&2
  return 1
}
