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
[ -f "$APP/.env.production" ] || { echo "Create $APP/.env.production first"; exit 1; }
grep -Eq '^NEXT_PUBLIC_APP_URL=https://dashboard-qa\.localvip\.com/?$' "$APP/.env.production" || { echo 'QA dashboard URL missing'; exit 1; }
grep -Eq '^NEXT_PUBLIC_QA_AUTH_BASE_URL=https://(qa-new|qa)\.localvip\.com/?$' "$APP/.env.production" || { echo 'QA backend URL missing'; exit 1; }
if grep -Eq '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$APP/.env.production"; then
  echo 'Remove legacy Supabase credentials from QA config'; exit 1
fi

STAGE=$(mktemp -d /var/www/localvip-dashboard-qa.new.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT
tar xzf "$ARCHIVE" -C "$STAGE"
cp -p "$APP/.env.production" "$STAGE/.env.production"
cd "$STAGE"
npm ci --no-audit --no-fund
npm run build
[ -f .next/BUILD_ID ]
[ ! -e "${APP}.previous" ] || { echo 'Previous release backup exists; inspect it first'; exit 1; }
if [ -d "$APP" ]; then mv "$APP" "${APP}.previous"; fi
mv "$STAGE" "$APP"
trap - EXIT
if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env
else
  cd "$APP"
  pm2 start npm --name "$NAME" -- start -- -p "$PORT" -H 127.0.0.1
fi
for _ in $(seq 1 10); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/" >/dev/null; then
    rm -rf "${APP}.previous"
    pm2 save
    echo "QA dashboard healthy on port $PORT"
    exit 0
  fi
  sleep 3
done
echo 'QA dashboard failed health check; restoring previous release'
pm2 stop "$NAME" || true
rm -rf "$APP"
if [ -d "${APP}.previous" ]; then
  mv "${APP}.previous" "$APP"
  pm2 restart "$NAME" --update-env || true
fi
exit 1
