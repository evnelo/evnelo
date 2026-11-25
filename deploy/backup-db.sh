#!/usr/bin/env sh
# Nightly MySQL dump from the compose stack, kept for 14 days, optionally copied to S3.
# Cron (repository root as working directory):
#   15 3 * * * cd $HOME/evnelo && ./deploy/backup-db.sh >> $HOME/evnelo-backup.log 2>&1
# With BACKUP_S3_URI in .env (s3://bucket/prefix) the dump is also uploaded through the amazon/aws-cli
# image, so the host needs nothing but Docker. It uses BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY /
# BACKUP_S3_REGION when set (give that key s3:PutObject on the backup prefix and nothing else), else the
# app's S3_* credentials. A failed upload exits non-zero so the cron log shows it.
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
pick() { v=$(var "BACKUP_$1"); [ -n "$v" ] && echo "$v" || var "$1"; }
endpoint=$(pick S3_ENDPOINT)
docker run --rm -v "$(cd "$dir" && pwd):/backups:ro" \
  -e AWS_ACCESS_KEY_ID="$(pick S3_ACCESS_KEY_ID)" -e AWS_SECRET_ACCESS_KEY="$(pick S3_SECRET_ACCESS_KEY)" \
  -e AWS_DEFAULT_REGION="$(pick S3_REGION)" \
  amazon/aws-cli s3 cp "/backups/$(basename "$file")" "${uri%/}/" ${endpoint:+--endpoint-url "$endpoint"} --only-show-errors \
  || { echo "upload to ${uri%/}/ FAILED" >&2; exit 1; }
echo "copied to ${uri%/}/$(basename "$file")"
