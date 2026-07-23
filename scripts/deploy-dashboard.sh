#!/usr/bin/env bash
# Server-side deploy for dashboard.localvip.com.
#
# Lives as a real script rather than a string embedded in the PowerShell wrapper:
# multi-line commands with nested quotes do not survive the trip through ssh
# reliably, and the failure mode is a confusing "unexpected EOF" from bash.
#
# Run on the server (or via deploy-dashboard.ps1, which uploads and calls this):
#   ./deploy-dashboard.sh deploy  <ref> <force_install:0|1>
#   ./deploy-dashboard.sh rollback
set -euo pipefail

APP_PATH="/var/www/localvip-dashboard"
BACKUP_PATH="/var/www/.next-rollback"
COMMIT_FILE="/var/www/.dashboard-rollback-commit"
PM_APP="localvip-dashboard"

ACTION="${1:-deploy}"
REF="${2:-origin/main}"
FORCE_INSTALL="${3:-0}"

cd "$APP_PATH"

restore_previous() {
  echo "--- restoring previous build and commit ---"
  if [ -f "$COMMIT_FILE" ]; then
    git checkout --quiet "$(cat "$COMMIT_FILE")"
  fi
  if [ -d "$BACKUP_PATH" ]; then
    rm -rf .next
    cp -a "$BACKUP_PATH" .next
  fi
  echo "RESTORED_COMMIT: $(git rev-parse HEAD)"
}

if [ "$ACTION" = "rollback" ]; then
  restore_previous
  pm2 restart "$PM_APP" --update-env >/dev/null
  echo "ROLLBACK_COMPLETE"
  exit 0
fi

echo "=== STEP 1: Fetch ==="
git fetch origin --quiet
DEPLOYED="$(git rev-parse HEAD)"
TARGET="$(git rev-parse "$REF")"
echo "DEPLOYED: $DEPLOYED"
echo "TARGET:   $TARGET"

DIRTY="$(git status --porcelain | head -5 || true)"
if [ -n "$DIRTY" ]; then
  echo "WARNING: working tree is dirty:"
  echo "$DIRTY"
fi

if [ "$DEPLOYED" = "$TARGET" ]; then
  echo "ALREADY_AT_TARGET (rebuilding anyway)"
fi

echo "=== STEP 2: Back up current build + commit ==="
echo "$DEPLOYED" > "$COMMIT_FILE"
rm -rf "$BACKUP_PATH"
cp -a .next "$BACKUP_PATH"
echo "BACKUP: $BACKUP_PATH ($(du -sh "$BACKUP_PATH" | cut -f1)) at $DEPLOYED"

echo "=== STEP 3: Check out target ==="
git checkout --quiet "$TARGET"
git log --oneline -1

echo "=== STEP 4: Dependencies ==="
# Reinstalling node_modules is the slowest and riskiest step; only do it when the
# lockfile actually changed between the deployed and target commits.
if [ "$FORCE_INSTALL" = "1" ] || ! git diff --quiet "$DEPLOYED" "$TARGET" -- package-lock.json package.json; then
  echo "installing (lockfile changed or forced)"
  npm ci
else
  echo "SKIPPED_INSTALL (no dependency changes)"
fi

echo "=== STEP 5: Build ==="
# PM2 keeps serving the old build while this runs, so a failed build never takes
# the site down -- but `next build` overwrites .next in place, hence the backup.
if ! npm run build 2>&1 | tail -15; then
  echo "BUILD_FAILED"
  restore_previous
  echo "SITE_UNTOUCHED (not restarted)"
  exit 1
fi

echo "=== STEP 6: Restart ==="
pm2 restart "$PM_APP" --update-env >/dev/null
sleep 8

echo "=== STEP 7: Verify ==="
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3001/ || echo 000)"
echo "LOCAL_HTTP: $CODE"
pm2 list --no-color | grep "$PM_APP" || true

if [ "$CODE" != "200" ]; then
  echo "VERIFY_FAILED"
  restore_previous
  pm2 restart "$PM_APP" --update-env >/dev/null
  echo "ROLLED_BACK"
  exit 1
fi

echo "DEPLOYED_COMMIT: $(git rev-parse HEAD)"
echo "DEPLOY_COMPLETE"
