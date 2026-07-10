# TIPBOARD — SPC26 2026

A retro-arcade tipping leaderboard for the SPC26 2026 season. Angular 20 standalone
app, Supabase backend, deployed to GitHub Pages from `docs/`.

## Pages

| Path        | Page              | Purpose                                              |
|-------------|-------------------|------------------------------------------------------|
| `/`         | Dashboard         | Leaderboard, streaks, season stats, heat map         |
| `/entry`    | Result Entry      | Enter weekly scores + set the round's sport/multiplier |
| `/schedule` | Schedule          | Upcoming and past rounds                             |
| `/wheel`    | Wheel Spinner     | Spin to pick a round's sport + multiplier            |

There is no login. Editing (Result Entry + Wheel "save to round") is gated by a
shared **PIN** held in `environment.editPin`. This is a convenience speed-bump,
**not** real security — anyone can read the PIN from the bundle. Actual write
protection is enforced by Supabase Row Level Security (see below).

## Setup

```bash
cd app
npm install
cp src/environments/environment.example.ts src/environments/environment.ts
# edit environment.ts: supabaseUrl, supabaseAnonKey, editPin
ng serve
```

## Supabase / RLS

Because the app no longer uses Supabase Auth, the anon key must be allowed to
write `bet_results` and update `weekly_schedule`. Run
[`supabase/rls-anon-write.sql`](../supabase/rls-anon-write.sql) once in the
Supabase SQL editor. Players (`users`) are managed directly in the Supabase
table editor — the app does not write them.

## Build / Deploy

```bash
ng build          # outputs to ../docs with baseHref /SPC26/ for GitHub Pages
```

Commit the `docs/` folder; GitHub Pages serves from it.
