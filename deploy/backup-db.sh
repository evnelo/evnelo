#!/usr/bin/env sh
# Nightly MySQL dump from the compose stack, kept for 14 days, optionally copied to S3.
# Cron example (repository root as working directory):
#   15 3 * * * cd /home/ubuntu/evnelo && ./deploy/backup-db.sh >> /var/log/evnelo-backup.log 2>&1
set -eu
dir="${BACKUP_DIR:-./backups}"
mkdir -p "$dir"
file="$dir/evnelo-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T db \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines evnelo' | gzip > "$file"
find "$dir" -name 'evnelo-*.sql.gz' -mtime +14 -delete
[ -n "${BACKUP_S3_URI:-}" ] && aws s3 cp "$file" "$BACKUP_S3_URI/" || true
echo "wrote $file"
