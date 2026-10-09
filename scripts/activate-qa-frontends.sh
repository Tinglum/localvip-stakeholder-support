#!/usr/bin/env bash
set -euo pipefail

QA=/etc/nginx/sites-available/localvip-qa-frontends
DASH=/etc/nginx/sites-enabled/localvip-dashboard
APP=/etc/nginx/sites-enabled/localvip-app
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
cp -p "$QA" "$QA.$STAMP.bak"
cp -p "$DASH" "$DASH.$STAMP.bak"
cp -p "$APP" "$APP.$STAMP.bak"
restore() {
  cp -p "$QA.$STAMP.bak" "$QA"
  cp -p "$DASH.$STAMP.bak" "$DASH"
  cp -p "$APP.$STAMP.bak" "$APP"
  nginx -t && systemctl reload nginx
}
trap restore ERR

cp /tmp/nginx-qa-frontends.conf "$QA"
python3 - "$DASH" "$APP" <<'PY'
from pathlib import Path
import sys

for path, target in zip(map(Path, sys.argv[1:]), (
    'https://dashboard-qa.5.252.52.243.sslip.io/',
    'https://my-qa.5.252.52.243.sslip.io/',
)):
    source = path.read_text()
    if 'location = /qa {' in source:
        continue
    marker = '  location / {'
    if marker not in source:
        raise SystemExit(f'Missing proxy location in {path}')
    redirect = f'  location = /qa {{ return 302 {target}; }}\n  location = /qa/ {{ return 302 {target}; }}\n'
    path.write_text(source.replace(marker, redirect + marker, 1))
PY
nginx -t
systemctl reload nginx
trap - ERR
