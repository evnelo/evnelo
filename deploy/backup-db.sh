#!/usr/bin/env sh
# Nightly MySQL dump from the compose stack, kept for 14 days, optionally copied to S3.
# Cron (repository root as working directory):
#   15 3 * * * cd $HOME/evnelo && ./deploy/backup-db.sh >> $HOME/evnelo-backup.log 2>&1
# With BACKUP_S3_URI in .env (s3://bucket/prefix) the dump is also uploaded through the amazon/aws-cli
# image using the app's S3_* credentials, so the host needs nothing but Docker.
set -eu
cd "$(dirname "$0")/.."
dir="${BACKUP_DIR:-./backups}"
mkdir -p "$dir"
file="$dir/evnelo-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T db \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines evnelo' | gzip > "$file"
find "$dir" -name 'evnelo-*.sql.gz' -mtime +14 -delete
echo "wrote $file ($(du -h "$file" | cut -f1))"

var() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
uri=$(var BACKUP_S3_URI)
[ -n "$uri" ] || exit 0
endpoint=$(var S3_ENDPOINT)
docker run --rm -v "$(cd "$dir" && pwd):/backups:ro" \
  -e AWS_ACCESS_KEY_ID="$(var S3_ACCESS_KEY_ID)" -e AWS_SECRET_ACCESS_KEY="$(var S3_SECRET_ACCESS_KEY)" \
  -e AWS_DEFAULT_REGION="$(var S3_REGION)" \
  amazon/aws-cli s3 cp "/backups/$(basename "$file")" "${uri%/}/" ${endpoint:+--endpoint-url "$endpoint"} --only-show-errors
echo "copied to ${uri%/}/$(basename "$file")"
