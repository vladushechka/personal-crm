#!/usr/bin/env bash
# Keeps the 10 latest builds of the app image in GHCR and deletes older ones.
# Run by Deploy prod after a successful deploy; needs GH_TOKEN with packages: write and a
# docker login to ghcr.io. The server keeps its own copies of the images it may roll back to.
#
# A build may be an image index whose parts (the image itself, its attestation) are separate
# untagged versions in GHCR: the parts of the kept builds are kept too. Untagged versions younger
# than a day are left alone: a build running right now pushes its parts before its tag.
set -euo pipefail

keep_builds=10
owner="$GITHUB_REPOSITORY_OWNER"
package="${GITHUB_REPOSITORY#*/}"
api="users/$owner/packages/container/$package/versions"
day_ago="$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)"

# id, digest, created, tags - newest first
versions="$(gh api --paginate "$api?per_page=100" \
  --jq '.[] | [.id, .name, .created_at, (.metadata.container.tags | join(","))] | @tsv' |
  sort -t $'\t' -k3,3r)"

kept_tagged="$(awk -F'\t' '$4 != ""' <<<"$versions" | head -n "$keep_builds")"
keep_digests="$(cut -f2 <<<"$kept_tagged")"
while read -r digest; do
  [ -n "$digest" ] || continue
  parts="$(docker buildx imagetools inspect --raw "ghcr.io/$GITHUB_REPOSITORY@$digest" |
    jq -r '.manifests[]?.digest')"
  keep_digests+=$'\n'"$parts"
done <<<"$(cut -f2 <<<"$kept_tagged")"

deleted=0
while IFS=$'\t' read -r id digest created tags; do
  [ -n "$id" ] || continue
  grep -qxF "$digest" <<<"$keep_digests" && continue
  if [ -z "$tags" ] && [[ "$created" > "$day_ago" ]]; then
    continue
  fi
  echo "Deleting ${tags:-untagged} $digest ($created)"
  gh api -X DELETE "$api/$id" >/dev/null
  deleted=$((deleted + 1))
done <<<"$versions"

echo "GHCR: kept the $keep_builds latest builds, deleted $deleted old versions"
