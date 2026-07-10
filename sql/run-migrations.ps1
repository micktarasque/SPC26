<#
.SYNOPSIS
  Applies the SPC26 Azure SQL migrations + seed scripts in order.

.DESCRIPTION
  Runs 001..004 against the target database using sqlcmd. Idempotent — safe to
  re-run. Requires the `sqlcmd` CLI (ships with SQL Server tools / Azure Data Studio,
  or `winget install sqlcmd`).

.PARAMETER Server
  Fully-qualified Azure SQL server, e.g. myserver.database.windows.net

.PARAMETER Database
  Database name, e.g. spc26

.PARAMETER User
  SQL auth login. Omit to use Entra ID / integrated auth (adds -G).

.PARAMETER Password
  SQL auth password (required if -User is supplied).

.EXAMPLE
  ./run-migrations.ps1 -Server myserver.database.windows.net -Database spc26 -User sqladmin -Password '***'

.EXAMPLE
  # Entra ID (interactive) auth:
  ./run-migrations.ps1 -Server myserver.database.windows.net -Database spc26
#>
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [Parameter(Mandatory = $true)][string]$Database,
  [string]$User,
  [string]$Password
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$files = @(
  '001_schema.sql',
  '002_views.sql',
  '003_seed_schedule.sql',
  '004_seed_users.sql'
)

# Base auth args
$authArgs = @()
if ($User) {
  if (-not $Password) { throw 'Password is required when -User is supplied.' }
  $authArgs = @('-U', $User, '-P', $Password)
} else {
  # Entra ID interactive auth
  $authArgs = @('-G')
}

foreach ($file in $files) {
  $path = Join-Path $scriptDir $file
  Write-Host "→ Applying $file ..." -ForegroundColor Cyan
  & sqlcmd -S $Server -d $Database @authArgs -b -I -i $path
  if ($LASTEXITCODE -ne 0) { throw "Migration failed on $file (exit $LASTEXITCODE)." }
}

Write-Host "All migrations applied successfully." -ForegroundColor Green
