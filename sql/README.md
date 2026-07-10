# Azure SQL — migrations & seed

T-SQL scripts that build the SPC26 database. Translated 1:1 from the original
Supabase/Postgres schema. All scripts are **idempotent** (safe to re-run).

| Script | Purpose |
|---|---|
| `001_schema.sql` | Tables: `users`, `weekly_schedule`, `bet_results` (+ keys, FKs, unique constraints) |
| `002_views.sql` | Views: `v_leaderboard`, `v_round_scores` (net = gross × bonus when `apply_multiplier`) |
| `003_seed_schedule.sql` | 28-round 2026 season (MERGE — updates/inserts, never clobbers results) |
| `004_seed_users.sql` | Sample player roster (only when `users` is empty — **edit to your players**) |

## Prerequisites

- An Azure SQL database (e.g. `spc26`) and a login with DDL rights.
- `sqlcmd` CLI — ships with SQL Server tools / Azure Data Studio, or `winget install sqlcmd`.
- The scripts use `GO` batch separators, so they must be run with **sqlcmd**, not
  the app's SQL driver.

## Run everything

```powershell
# SQL auth
./run-migrations.ps1 -Server myserver.database.windows.net -Database spc26 -User sqladmin -Password '***'

# Entra ID (interactive) auth
./run-migrations.ps1 -Server myserver.database.windows.net -Database spc26
```

## Run one script manually

```powershell
sqlcmd -S myserver.database.windows.net -d spc26 -U sqladmin -P '***' -b -i 001_schema.sql
```

## Firewall

Add your client IP (and, for the deployed app, **"Allow Azure services"**) under the
Azure SQL server's networking rules, or the connection will time out.

## Notes on the Postgres → T-SQL translation

- `UUID DEFAULT gen_random_uuid()` → `UNIQUEIDENTIFIER DEFAULT NEWID()`
- `TEXT` → `NVARCHAR(n)`, `BOOLEAN` → `BIT`, `NUMERIC` → `DECIMAL(12,2)`
- `TIMESTAMPTZ DEFAULT now()` → `DATETIME2 DEFAULT SYSUTCDATETIME()`
- Views drop the `ORDER BY` (illegal in T-SQL views) — the API orders results instead.
- RLS is gone; write access is enforced by the API's server-side PIN check.
