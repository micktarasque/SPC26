-- ============================================================================
-- SPC26 / TIPBOARD — Seed players (migration 004)
-- Sample roster so the app has active players on first run. EDIT THIS to your
-- real players (or manage them later directly in the users table).
-- Only inserts when the table is empty, so it will not duplicate on re-run and
-- will not clobber a roster you have already customised.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.users)
BEGIN
  INSERT INTO dbo.users (name) VALUES
    (N'Alex'),
    (N'Sam'),
    (N'Jordan'),
    (N'Casey'),
    (N'Taylor'),
    (N'Morgan'),
    (N'Jamie'),
    (N'Riley');

  PRINT 'Migration 004 (seed users) inserted sample roster.';
END
ELSE
BEGIN
  PRINT 'Migration 004 (seed users) skipped — users table already populated.';
END
GO
