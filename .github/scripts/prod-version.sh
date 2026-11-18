#!/usr/bin/env bash
# Chooses the version for Deploy prod and writes sha=, image=, how= to $GITHUB_OUTPUT.
#   ROLLBACK=true - the prod version before the current one, as the server remembers it
#                   (/opt/crm/prod/previous-image); no staging check, WANTED is ignored
#   WANTED=<sha>  - that commit, only if it has a successful staging deploy
#   neither       - the commit of the last successful staging deploy
# Staging deploys are GitHub Deployments of the environment "staging" (workflow Deploy staging).
# Needs GH_TOKEN with deployments: read, and `ssh server` (server-ssh action) for a rollback.
# Messages for the person who pressed the button go to the run summary, in Russian.
set -euo pipefail

repo="$GITHUB_REPOSITORY"

fail() {
  echo "::error::$1"
  {
    echo "### Прод не выкатывался"
    echo "$2"
  } >>"$GITHUB_STEP_SUMMARY"
  exit 1
}

# A deploy that succeeded and was later replaced by a newer one turns "inactive", so look for
# a success anywhere in its history, not only in the latest status
deploy_succeeded() {
  [ "$(gh api "repos/$repo/deployments/$1/statuses?per_page=100" \
    --jq 'any(.[]; .state == "success")')" = true ]
}

passed_staging() {
  local id
  for id in $(gh api "repos/$repo/deployments?environment=staging&sha=$1&per_page=100" --jq '.[].id'); do
    deploy_succeeded "$id" && return 0
  done
  return 1
}

if [ "${ROLLBACK:-false}" = true ]; then
  image="$(ssh server cat /opt/crm/prod/previous-image 2>/dev/null || true)"
  [ -n "$image" ] || fail "The server has no previous prod version (previous-image)" \
    "Откатывать не на что: сервер не помнит прошлую версию прода."
  sha="${image##*:}"
  how="откат на прошлую версию прода, база не откатывается"
elif [ -n "${WANTED:-}" ]; then
  wanted="$(echo "$WANTED" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  [[ "$wanted" =~ ^[0-9a-f]{7,40}$ ]] || fail "Not a commit SHA: $WANTED" \
    "«$WANTED» - это не SHA коммита. Оставьте поле пустым или вставьте SHA из main."
  sha="$(gh api "repos/$repo/commits/$wanted" --jq .sha 2>/dev/null)" || fail \
    "No such commit: $wanted" "Коммита $wanted нет в репозитории."
  passed_staging "$sha" || fail "$sha has no successful staging deploy" \
    "Версия ${sha:0:7} не проходила тест-стенд, на прод её не катим. Сначала выкатка на стенд."
  how="указана вручную, прошла тест-стенд"
else
  sha=""
  while read -r id commit; do
    if deploy_succeeded "$id"; then
      sha="$commit"
      break
    fi
  done < <(gh api "repos/$repo/deployments?environment=staging&per_page=30" --jq '.[] | "\(.id) \(.sha)"')
  [ -n "$sha" ] || fail "No successful staging deploy found" \
    "Не нашёл ни одной удачной выкатки на тест-стенд, катить нечего."
  how="последняя версия, прошедшая тест-стенд"
fi

image="ghcr.io/$repo:$sha"
echo "Prod version: $sha ($how)"
{
  echo "sha=$sha"
  echo "image=$image"
  echo "how=$how"
} >>"$GITHUB_OUTPUT"
