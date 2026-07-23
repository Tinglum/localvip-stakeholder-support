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
# This wrapper only uploads scripts/deploy-dashboard.sh and runs it. All the real
# logic lives in that script deliberately: multi-line commands with nested quotes
# do not survive the trip through ssh reliably, and it means the deploy can also be
# run directly on the server if a workstation isn't available.
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

$server     = "root@5.252.52.243"
$keyFile    = "$env:USERPROFILE\.ssh\contabo_localvip"
$localSh    = Join-Path $PSScriptRoot "scripts\deploy-dashboard.sh"
$remoteSh   = "/root/deploy-dashboard.sh"
$siteUrl    = "https://dashboard.localvip.com"

if (-not (Test-Path $localSh)) { Write-Host "Missing $localSh" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Uploading deploy script ===" -ForegroundColor Cyan
# Normalise to LF: bash rejects CRLF line endings with a confusing error.
$sh = [System.IO.File]::ReadAllText($localSh).Replace("`r`n", "`n")
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $sh, (New-Object System.Text.UTF8Encoding $false))
scp -o BatchMode=yes -i $keyFile $tmp "${server}:${remoteSh}"
if ($LASTEXITCODE -ne 0) { Write-Host "Upload failed." -ForegroundColor Red; exit 1 }
Remove-Item $tmp -Force

$action = if ($Rollback) { "rollback" } else { "deploy" }
$install = if ($ForceInstall) { "1" } else { "0" }

Write-Host "=== Running: $action $Ref ===" -ForegroundColor Cyan
ssh -o BatchMode=yes -i $keyFile $server "chmod +x $remoteSh && $remoteSh $action $Ref $install"
$deployExit = $LASTEXITCODE

Write-Host "`n=== Public health check ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri $siteUrl -Method Head -TimeoutSec 30 -UseBasicParsing
    $status = [int]$r.StatusCode
} catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
}
Write-Host ("{0} -> HTTP {1}" -f $siteUrl, $status)

if ($deployExit -ne 0 -or $status -ne 200) {
    Write-Host "`nDEPLOY FAILED (the script restores the previous build automatically)." -ForegroundColor Red
    Write-Host "Manual rollback: .\deploy-dashboard.ps1 -Rollback" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Rollback with: .\deploy-dashboard.ps1 -Rollback" -ForegroundColor Green
