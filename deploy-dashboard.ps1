# Deploys the dashboard to dashboard.localvip.com.
#
# The app is a Next.js server (NOT a static export and NOT Netlify, whatever the
# older docs said) running under PM2 behind nginx on our own Ubuntu box:
#
#   host    5.252.52.243  (root, key: ~/.ssh/contabo_localvip)
#   path    /var/www/localvip-dashboard   (git checkout, detached HEAD at the
#           deployed commit)
#   process PM2 app "localvip-dashboard" -> `npm start` -> next start on :3001
#   proxy   nginx -> https://dashboard.localvip.com
#
# Order matters: build BEFORE restarting. PM2 keeps serving the old build while the
# new one compiles, so a failed build never takes the site down -- but `next build`
# overwrites .next in place, so we back it up first and restore on failure.
#
# `npm ci` is skipped unless the lockfile actually changed between the deployed and
# target commits. Reinstalling node_modules is the slowest and riskiest step, and
# most deploys do not need it.
#
# Usage:
#   .\deploy-dashboard.ps1                 # deploy origin/main
#   .\deploy-dashboard.ps1 -Ref <sha>      # deploy a specific commit
#   .\deploy-dashboard.ps1 -ForceInstall   # force npm ci
#   .\deploy-dashboard.ps1 -Rollback       # restore the previous build + commit

param(
    [string]$Ref = "origin/main",
    [switch]$ForceInstall,
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

$server      = "root@5.252.52.243"
$keyFile     = "$env:USERPROFILE\.ssh\contabo_localvip"
$remotePath  = "/var/www/localvip-dashboard"
$backupPath  = "/var/www/.next-rollback"
$commitFile  = "/var/www/.dashboard-rollback-commit"
$pmApp       = "localvip-dashboard"
$siteUrl     = "https://dashboard.localvip.com"

function Invoke-Remote([string]$cmd) {
    ssh -o BatchMode=yes -i $keyFile $server $cmd
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed (exit $LASTEXITCODE): $cmd" }
}

function Test-Site {
    try {
        $r = Invoke-WebRequest -Uri $siteUrl -Method Head -TimeoutSec 30 -UseBasicParsing
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

if ($Rollback) {
    Write-Host "`n=== ROLLBACK ===" -ForegroundColor Yellow
    Invoke-Remote "set -e
        cd $remotePath
        [ -d $backupPath ] || { echo 'No build backup to roll back to.'; exit 1; }
        [ -f $commitFile ] && git checkout --quiet `$(cat $commitFile)
        rm -rf .next && cp -a $backupPath .next
        pm2 restart $pmApp --update-env >/dev/null
        echo \"rolled back to `$(git rev-parse HEAD)\""
    Start-Sleep -Seconds 8
    Write-Host ("Site: {0}" -f (Test-Site)) -ForegroundColor Green
    exit 0
}

Write-Host "`n=== STEP 1: Fetch and inspect ===" -ForegroundColor Cyan
Invoke-Remote "set -e
    cd $remotePath
    git fetch origin --quiet
    echo \"deployed: `$(git rev-parse HEAD)\"
    echo \"target:   `$(git rev-parse $Ref)\"
    git status --short | head -5"

Write-Host "`n=== STEP 2: Back up current build + commit ===" -ForegroundColor Cyan
Invoke-Remote "set -e
    cd $remotePath
    git rev-parse HEAD > $commitFile
    rm -rf $backupPath
    cp -a .next $backupPath
    echo \"backup: $backupPath (`$(du -sh $backupPath | cut -f1)) at commit `$(cat $commitFile)\""

Write-Host "`n=== STEP 3: Check out target ===" -ForegroundColor Cyan
Invoke-Remote "set -e
    cd $remotePath
    git checkout --quiet `$(git rev-parse $Ref)
    echo \"HEAD now: `$(git rev-parse HEAD)\"
    git log --oneline -1"

Write-Host "`n=== STEP 4: Dependencies ===" -ForegroundColor Cyan
$installFlag = if ($ForceInstall) { "1" } else { "0" }
Invoke-Remote "set -e
    cd $remotePath
    prev=`$(cat $commitFile)
    if [ '$installFlag' = '1' ] || ! git diff --quiet `$prev HEAD -- package-lock.json package.json; then
        echo 'lockfile changed (or forced) -> npm ci'
        npm ci
    else
        echo 'no dependency changes -> skipping install'
    fi"

Write-Host "`n=== STEP 5: Build (site stays up on the old build) ===" -ForegroundColor Cyan
$buildOk = $true
try {
    Invoke-Remote "cd $remotePath && npm run build 2>&1 | tail -15"
} catch {
    $buildOk = $false
}

if (-not $buildOk) {
    Write-Host "`nBUILD FAILED - restoring previous build, NOT restarting." -ForegroundColor Red
    Invoke-Remote "set -e
        cd $remotePath
        git checkout --quiet `$(cat $commitFile)
        rm -rf .next && cp -a $backupPath .next
        echo 'restored'"
    Write-Host "Site untouched: $(Test-Site)" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== STEP 6: Restart ===" -ForegroundColor Cyan
Invoke-Remote "pm2 restart $pmApp --update-env >/dev/null && echo restarted"
Start-Sleep -Seconds 10

Write-Host "`n=== STEP 7: Verify ===" -ForegroundColor Cyan
$status = Test-Site
Write-Host ("{0} -> HTTP {1}" -f $siteUrl, $status)
Invoke-Remote "pm2 list --no-color | grep $pmApp"

if ($status -ne 200) {
    Write-Host "`nVERIFY FAILED (expected 200) - rolling back." -ForegroundColor Red
    Invoke-Remote "set -e
        cd $remotePath
        git checkout --quiet `$(cat $commitFile)
        rm -rf .next && cp -a $backupPath .next
        pm2 restart $pmApp --update-env >/dev/null
        echo 'rolled back'"
    Start-Sleep -Seconds 8
    Write-Host ("Site after rollback: {0}" -f (Test-Site)) -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Rollback with: .\deploy-dashboard.ps1 -Rollback" -ForegroundColor Green
