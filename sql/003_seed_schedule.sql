-- ============================================================================
-- SPC26 / TIPBOARD — Seed weekly_schedule (migration 003)
-- 28-round 2026 season (28 Mar – 3 Oct 2026). Idempotent via MERGE on
-- round_number: re-running updates existing rounds and inserts missing ones,
-- WITHOUT touching bet_results or regenerating round ids.
-- ============================================================================

MERGE dbo.weekly_schedule AS target
USING (VALUES
  (1,  CONVERT(date, '2026-03-28'), 100, N'Races',        N'Rosehill Races',                             200),
  (2,  CONVERT(date, '2026-04-04'), 100, N'Golf',         N'Masters Championship',                        200),
  (3,  CONVERT(date, '2026-04-11'), 100, NULL,            NULL,                                           100),
  (4,  CONVERT(date, '2026-04-18'), 100, NULL,            NULL,                                           100),
  (5,  CONVERT(date, '2026-04-25'), 100, NULL,            NULL,                                           100),
  (6,  CONVERT(date, '2026-05-02'), 100, NULL,            NULL,                                           100),
  (7,  CONVERT(date, '2026-05-09'), 100, NULL,            NULL,                                           100),
  (8,  CONVERT(date, '2026-05-16'), 100, NULL,            NULL,                                           100),
  (9,  CONVERT(date, '2026-05-23'), 100, N'NRL',          N'State of Origin Game I',                      200),
  (10, CONVERT(date, '2026-05-30'), 100, NULL,            NULL,                                           100),
  (11, CONVERT(date, '2026-06-06'), 100, NULL,            NULL,                                           100),
  (12, CONVERT(date, '2026-06-13'), 100, N'Soccer',       N'Soccer World Cup Qualifiers',                 200),
  (13, CONVERT(date, '2026-06-20'), 100, NULL,            NULL,                                           100),
  (14, CONVERT(date, '2026-06-27'), 100, NULL,            NULL,                                           100),
  (15, CONVERT(date, '2026-07-04'), 100, NULL,            NULL,                                           100),
  (16, CONVERT(date, '2026-07-11'), 100, NULL,            NULL,                                           100),
  (17, CONVERT(date, '2026-07-18'), 100, N'Soccer',       N'FIFA World Cup Final',                        200),
  (18, CONVERT(date, '2026-07-25'), 100, NULL,            NULL,                                           100),
  (19, CONVERT(date, '2026-08-01'), 100, N'Table Tennis', N'World Table Tennis Championships Mens Final', 200),
  (20, CONVERT(date, '2026-08-08'), 100, NULL,            NULL,                                           100),
  (21, CONVERT(date, '2026-08-15'), 100, NULL,            NULL,                                           100),
  (22, CONVERT(date, '2026-08-22'), 100, N'E-Sports',     N'DOTA TI',                                     200),
  (23, CONVERT(date, '2026-08-29'), 100, N'Cycling',      N'UCI Road World Championships Mens Road Race', 200),
  (24, CONVERT(date, '2026-09-05'), 100, NULL,            NULL,                                           100),
  (25, CONVERT(date, '2026-09-12'), 100, NULL,            NULL,                                           100),
  (26, CONVERT(date, '2026-09-19'), 100, NULL,            NULL,                                           100),
  (27, CONVERT(date, '2026-09-26'), 200, NULL,            NULL,                                           100),
  (28, CONVERT(date, '2026-10-03'), 200, N'NRL',          N'NRL Grand Final',                             200)
) AS source (round_number, round_date, bet_amount_pct, sport, special_event, bonus_pct)
ON target.round_number = source.round_number
WHEN MATCHED THEN
  UPDATE SET
    round_date     = source.round_date,
    bet_amount_pct = source.bet_amount_pct,
    sport          = source.sport,
    special_event  = source.special_event,
    bonus_pct      = source.bonus_pct
WHEN NOT MATCHED BY TARGET THEN
  INSERT (round_number, round_date, bet_amount_pct, sport, special_event, bonus_pct)
  VALUES (source.round_number, source.round_date, source.bet_amount_pct, source.sport, source.special_event, source.bonus_pct);
GO

PRINT 'Migration 003 (seed schedule) complete.';
GO
