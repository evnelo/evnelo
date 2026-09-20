#!/usr/bin/env bash
# Cron entry point for continuous deployment on the VM: nothing reaches the machine from outside,
# it pulls. Every minute it looks at origin/production; when that commit is not the one deployed
# (and not one that already failed to boot), it runs deploy/deploy.sh. Install with:
#
#   (crontab -l 2>/dev/null; echo "* * * * * $HOME/evnelo/deploy/auto-deploy.sh >> $HOME/evnelo-deploy.log 2>&1") | crontab -
#
# The whole script is a function called on the last line, so a `git reset` replacing this file
# mid-run cannot confuse bash. A failed commit is retried only once production moves again.
main() {
  set -euo pipefail
  cd "$(dirname "$0")/.."
  state="${EVNELO_DEPLOY_STATE:-$HOME/.evnelo-deployed}"
  lock="${EVNELO_DEPLOY_LOCK:-/tmp/evnelo-deploy.lock}"

  exec 9>"$lock"
  flock -n 9 || exit 0 # a deploy is in progress

  git fetch --quiet origin production 2>/dev/null || exit 0 # no production branch yet, or GitHub unreachable
  target=$(git rev-parse origin/production)
  deployed=$(cat "$state" 2>/dev/null || git rev-parse HEAD)
  failed=$(cat "$state.failed" 2>/dev/null || true)
  [ "$target" = "$deployed" ] && exit 0
  [ "$target" = "$failed" ] && exit 0

  flock -u 9
  echo "$(date -u +%FT%TZ) production moved to ${target:0:7} (deployed ${deployed:0:7})"
  ./deploy/deploy.sh
}
main "$@"
