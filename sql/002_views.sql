-- ============================================================================
-- SPC26 / TIPBOARD — Azure SQL views (migration 002)
-- Net applies bonus_pct only when apply_multiplier = 1.
-- NOTE: T-SQL views cannot contain ORDER BY — ordering is applied by the API.
-- ============================================================================

-- ── v_leaderboard: total gross and net per active player ─────────────────────
DROP VIEW IF EXISTS dbo.v_leaderboard;
GO
CREATE VIEW dbo.v_leaderboard AS
SELECT
  u.id                                          AS user_id,
  u.name,
  COUNT(br.id)                                  AS total_bets,
  SUM(br.gross)                                 AS total_gross,
  SUM(
    CASE
      WHEN br.apply_multiplier = 1
      THEN br.gross * (CAST(ws.bonus_pct AS DECIMAL(9, 4)) / 100.0)
      ELSE br.gross
    END
  )                                             AS total_net
FROM dbo.users u
LEFT JOIN dbo.bet_results br     ON br.user_id = u.id
LEFT JOIN dbo.weekly_schedule ws ON ws.id = br.schedule_id
WHERE u.active = 1
GROUP BY u.id, u.name;
GO

-- ── v_round_scores: every active player × every round, net per row ───────────
DROP VIEW IF EXISTS dbo.v_round_scores;
GO
CREATE VIEW dbo.v_round_scores AS
SELECT
  u.id                                          AS user_id,
  u.name,
  ws.id                                         AS schedule_id,
  ws.round_number,
  ws.round_date,
  ws.sport,
  ws.special_event,
  ws.bonus_pct,
  ws.bet_amount_pct,
  br.gross,
  br.apply_multiplier,
  CASE
    WHEN br.apply_multiplier = 1
    THEN br.gross * (CAST(ws.bonus_pct AS DECIMAL(9, 4)) / 100.0)
    ELSE br.gross
  END                                           AS net
FROM dbo.weekly_schedule ws
CROSS JOIN dbo.users u
LEFT JOIN dbo.bet_results br
  ON br.schedule_id = ws.id
  AND br.user_id = u.id
WHERE u.active = 1;
GO

PRINT 'Migration 002 (views) complete.';
GO
