#!/usr/bin/env sh
# Ship the checked-out commit on the one-VM stack: pull, build with the commit baked in (Datadog
# version and source links), restart the app, drop the previous image. Run from the repository root.
set -eu
cd "$(dirname "$0")/.."
git pull --ff-only
sha=$(git rev-parse HEAD)
GIT_SHA="$sha" APP_VERSION="$(git rev-parse --short HEAD)" \
  docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build app
docker image prune -f >/dev/null
echo "deployed $sha"
