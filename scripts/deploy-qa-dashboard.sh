#!/usr/bin/env bash
# Deploy a separate QA dashboard from a git archive, without touching production.
set -euo pipefail
exec 9>/var/lock/localvip-dashboard-qa-deploy.lock
flock 9

APP=/var/www/localvip-dashboard-qa
PORT=3101
NAME=localvip-dashboard-qa
ARCHIVE=${1:?Pass an archive path}
[ -f "$ARCHIVE" ] || { echo "Archive missing: $ARCHIVE"; exit 1; }
if tar -tzf "$ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then echo 'Unsafe archive path'; exit 1; fi
[ -f "$APP/.env.production" ] || { echo "Create $APP/.env.production first"; exit 1; }
grep -Eq '^NEXT_PUBLIC_APP_URL=https://dashboard-qa\.localvip\.com/?$' "$APP/.env.production" || { echo 'QA dashboard URL missing'; exit 1; }
grep -Eq '^NEXT_PUBLIC_QA_AUTH_BASE_URL=https://(qa-new|qa)\.localvip\.com/?$' "$APP/.env.production" || { echo 'QA backend URL missing'; exit 1; }
grep -Eq '^NEXT_PUBLIC_DEPLOY_ENV=qa$' "$APP/.env.production" || { echo 'QA link isolation flag missing'; exit 1; }
if grep -Eq '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$APP/.env.production"; then
  echo 'Remove legacy Supabase credentials from QA config'; exit 1
fi

STAGE=$(mktemp -d /var/www/localvip-dashboard-qa.new.XXXXXX)
BACKUP="${APP}.previous.$(date +%s)"
trap 'rm -rf "$STAGE"' EXIT
tar xzf "$ARCHIVE" -C "$STAGE"
cp -p "$APP/.env.production" "$STAGE/.env.production"
cd "$STAGE"
npm ci --no-audit --no-fund
npm run build
[ -f .next/BUILD_ID ]
if [ -d "$APP" ]; then mv "$APP" "$BACKUP"; fi
mv "$STAGE" "$APP"
trap - EXIT
if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env || true
else
  cd "$APP"
  pm2 start npm --name "$NAME" -- start -- -p "$PORT" -H 127.0.0.1 || true
fi
for _ in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/" || true)
  if [ "$CODE" = 200 ]; then
    rm -rf "$BACKUP"
    pm2 save
    echo "QA dashboard healthy on port $PORT"
    exit 0
  fi
  sleep 3
done
echo "QA dashboard failed health check (HTTP $CODE); restoring previous release"
pm2 stop "$NAME" || true
rm -rf "$APP"
if [ -d "$BACKUP" ]; then
  mv "$BACKUP" "$APP"
  pm2 restart "$NAME" --update-env || true
fi
exit 1
