-- ============================================================================
-- SPC26 / TIPBOARD — Azure SQL schema (migration 001)
-- Idempotent: safe to run repeatedly. Run with sqlcmd (GO batch separators).
-- Translated from the original Supabase/Postgres schema.
-- ============================================================================

-- ── users ────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id      DEFAULT NEWID(),
    name        NVARCHAR(200)    NOT NULL,
    active      BIT              NOT NULL CONSTRAINT DF_users_active   DEFAULT 1,
    created_at  DATETIME2(3)     NOT NULL CONSTRAINT DF_users_created  DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_users PRIMARY KEY (id)
  );
END
GO

-- ── weekly_schedule ──────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.weekly_schedule', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.weekly_schedule (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ws_id       DEFAULT NEWID(),
    round_number    INT              NOT NULL,
    round_date      DATE             NOT NULL,
    sport           NVARCHAR(100)    NULL,
    special_event   NVARCHAR(400)    NULL,
    bet_amount_pct  INT              NOT NULL CONSTRAINT DF_ws_bet_amt  DEFAULT 100,  -- base stake: 100 or 200
    bonus_pct       INT              NOT NULL CONSTRAINT DF_ws_bonus    DEFAULT 100,  -- round bonus: 100 = none, 200 = double
    CONSTRAINT PK_weekly_schedule PRIMARY KEY (id),
    CONSTRAINT UQ_ws_round_number UNIQUE (round_number)
  );
END
GO

-- ── bet_results ──────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.bet_results', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.bet_results (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_br_id       DEFAULT NEWID(),
    user_id           UNIQUEIDENTIFIER NOT NULL,
    schedule_id       UNIQUEIDENTIFIER NOT NULL,
    gross             DECIMAL(12, 2)   NOT NULL,                                    -- positive = win, negative = loss
    apply_multiplier  BIT              NOT NULL CONSTRAINT DF_br_multi    DEFAULT 0, -- flagged when bonus condition met
    created_at        DATETIME2(3)     NOT NULL CONSTRAINT DF_br_created  DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_bet_results PRIMARY KEY (id),
    CONSTRAINT FK_br_user     FOREIGN KEY (user_id)     REFERENCES dbo.users(id)            ON DELETE CASCADE,
    CONSTRAINT FK_br_schedule FOREIGN KEY (schedule_id) REFERENCES dbo.weekly_schedule(id)  ON DELETE CASCADE,
    CONSTRAINT UQ_br_user_schedule UNIQUE (user_id, schedule_id)                    -- one bet per player per round
  );
END
GO

PRINT 'Migration 001 (schema) complete.';
GO
