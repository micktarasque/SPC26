-- ============================================================================
-- SPC26 / TIPBOARD — Anonymous write policies
-- ----------------------------------------------------------------------------
-- The app no longer uses Supabase Auth. Editing is gated client-side by a
-- shared PIN (environment.editPin), which is convenience only — the data layer
-- must allow the public/anon key to write. Run this once in the Supabase SQL
-- editor (Dashboard → SQL Editor) to replace the old "authenticated" write
-- policies with anon-friendly ones.
--
-- Scope of writes the app performs:
--   * bet_results     — insert / update / delete (score entry)
--   * weekly_schedule — update only (sport + multiplier for a round)
--   * users           — NOT written by the app (manage players in Supabase)
-- ============================================================================

-- ── bet_results ─────────────────────────────────────────────────────────────
drop policy if exists "authenticated write bet_results"  on public.bet_results;
drop policy if exists "anon write bet_results"           on public.bet_results;

create policy "anon write bet_results"
  on public.bet_results
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ── weekly_schedule (update sport / multiplier) ──────────────────────────────
drop policy if exists "authenticated update weekly_schedule" on public.weekly_schedule;
drop policy if exists "anon update weekly_schedule"          on public.weekly_schedule;

create policy "anon update weekly_schedule"
  on public.weekly_schedule
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- ── Public read (idempotent — keep existing read access) ─────────────────────
-- These should already exist; included so a fresh project works end-to-end.
drop policy if exists "public read bet_results"     on public.bet_results;
create policy "public read bet_results"
  on public.bet_results for select to anon, authenticated using (true);

drop policy if exists "public read weekly_schedule" on public.weekly_schedule;
create policy "public read weekly_schedule"
  on public.weekly_schedule for select to anon, authenticated using (true);

drop policy if exists "public read users"           on public.users;
create policy "public read users"
  on public.users for select to anon, authenticated using (true);
