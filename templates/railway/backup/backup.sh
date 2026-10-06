#!/bin/sh
# backup/backup.sh — dump the pgvector database to the Railway bucket, prune old dumps, exit.
# Needs: DATABASE_URL (reference to pgvector DATABASE_URL_PRIVATE), AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, ENDPOINT, BUCKET, BACKUP_RETENTION_DAYS.
# Prints no secret: pg_dump reads the URL from the environment, aws reads keys from the environment.
set -eu
: "${DATABASE_URL:?}" "${BUCKET:?}" "${ENDPOINT:?}"
KEEP="${BACKUP_RETENTION_DAYS:-14}"
NAME="jarvis-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="/tmp/$NAME"
aws s3 cp "/tmp/$NAME" "s3://$BUCKET/pg/$NAME" --endpoint-url "$ENDPOINT" --only-show-errors
rm -f "/tmp/$NAME"
CUTOFF=$(date -u -d "@$(( $(date -u +%s) - KEEP * 86400 ))" +%Y%m%dT%H%M%SZ)
aws s3 ls "s3://$BUCKET/pg/" --endpoint-url "$ENDPOINT" | awk '{print $4}' | while read -r f; do
  ts=$(echo "$f" | sed -n 's/^jarvis-\(.*\)\.dump$/\1/p')
  [ -n "$ts" ] && [ "$ts" != "$CUTOFF" ] && [ "$(printf '%s\n%s\n' "$ts" "$CUTOFF" | sort | head -n 1)" = "$ts" ] && aws s3 rm "s3://$BUCKET/pg/$f" --endpoint-url "$ENDPOINT" --only-show-errors
done || true
echo "backup ok: $NAME"
