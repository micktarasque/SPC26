# TIPBOARD — Master Project Specification

> A seasonal tipping competition tracker for a private group.
> Lightweight, visually sharp, zero-cost to run. Built for weekly screenshots and group engagement.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 17+ — standalone components, SCSS + Tailwind CSS |
| Database | Supabase free tier (Postgres) |
| Auth | Supabase email auth — single admin user |
| Hosting | GitHub Pages |

**Cost**: $0. Supabase free tier has hard usage caps and will never auto-upgrade or charge unexpectedly.

---

## 2. Authentication Model

- **Public** — read-only. No login required to view leaderboard, rounds, or race
- **Admin (you)** — single Supabase email account. Full write access to scores and users
- The Supabase `anon` key is intentionally public — RLS policies are the security layer
- All views use `security_invoker = true` to inherit RLS from the calling user

---

## 3. Data Model

### Relationships
```
users ──< bet_results >── weekly_schedule
```

---

### Table: `users`
Players in the competition. Denormalised — list not finalised at project start.

```sql
CREATE TABLE users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```
> Set `active = false` to deactivate a player. Never hard delete — preserves bet history.

---

### Table: `weekly_schedule`
Full 28-round season structure. Pre-seeded once at setup. Read-only from the app.

```sql
CREATE TABLE weekly_schedule (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number   INTEGER NOT NULL UNIQUE,
  round_date     DATE NOT NULL,
  sport          TEXT,                          -- nullable for generic rounds
  special_event  TEXT,                          -- nullable
  bet_amount_pct INTEGER NOT NULL DEFAULT 100,  -- base stake multiplier: 100 or 200
  bonus_pct      INTEGER NOT NULL DEFAULT 100   -- round bonus: 100 = none, 200 = double
);
```

---

### Table: `bet_results`
One row per player per round. Only inserted when a result exists.

```sql
CREATE TABLE bet_results (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  schedule_id       UUID REFERENCES weekly_schedule(id) ON DELETE CASCADE,
  gross             NUMERIC NOT NULL,      -- positive = win, negative = loss
  apply_multiplier  BOOLEAN DEFAULT false, -- admin manually flags when bonus condition is met
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, schedule_id)             -- one bet per player per round, enforced at DB level
);
```
> `apply_multiplier` defaults to false. Admin explicitly enables it per bet when the player has met the round bonus condition.

---

## 4. Views

### `v_leaderboard`
Total gross and net per player. Net applies `bonus_pct` only when `apply_multiplier = true`.

```sql
CREATE VIEW v_leaderboard
WITH (security_invoker = true) AS
SELECT
  u.id                                        AS user_id,
  u.name,
  COUNT(br.id)                                AS total_bets,
  SUM(br.gross)                               AS total_gross,
  SUM(
    CASE
      WHEN br.apply_multiplier = true
      THEN br.gross * (ws.bonus_pct / 100.0)
      ELSE br.gross
    END
  )                                           AS total_net
FROM users u
LEFT JOIN bet_results br ON br.user_id = u.id
LEFT JOIN weekly_schedule ws ON ws.id = br.schedule_id
WHERE u.active = true
GROUP BY u.id, u.name
ORDER BY total_net DESC NULLS LAST;
```

---

### `v_round_scores`
All players × all rounds with computed net per row. `CROSS JOIN` ensures every player appears for every round — nulls where no result exists yet.

```sql
CREATE VIEW v_round_scores
WITH (security_invoker = true) AS
SELECT
  u.id                                        AS user_id,
  u.name,
  ws.id                                       AS schedule_id,
  ws.round_number,
  ws.round_date,
  ws.sport,
  ws.special_event,
  ws.bonus_pct,
  ws.bet_amount_pct,
  br.gross,
  br.apply_multiplier,
  CASE
    WHEN br.apply_multiplier = true
    THEN br.gross * (ws.bonus_pct / 100.0)
    ELSE br.gross
  END                                         AS net
FROM weekly_schedule ws
CROSS JOIN users u
LEFT JOIN bet_results br
  ON br.schedule_id = ws.id
  AND br.user_id = u.id
WHERE u.active = true
ORDER BY ws.round_number, u.name;
```

---

## 5. RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_results ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "public read" ON users FOR SELECT USING (true);
CREATE POLICY "public read" ON weekly_schedule FOR SELECT USING (true);
CREATE POLICY "public read" ON bet_results FOR SELECT USING (true);

-- Authenticated write — users
CREATE POLICY "auth insert" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update" ON users FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth delete" ON users FOR DELETE USING (auth.role() = 'authenticated');

-- Authenticated write — bet_results
CREATE POLICY "auth insert" ON bet_results FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update" ON bet_results FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth delete" ON bet_results FOR DELETE USING (auth.role() = 'authenticated');

-- weekly_schedule has no write policies — edit via Supabase dashboard only
```

---

## 6. Seed Data — `weekly_schedule`

Run once in Supabase SQL editor after table creation.

```sql
INSERT INTO weekly_schedule (round_number, round_date, bet_amount_pct, sport, special_event, bonus_pct) VALUES
(1,  '2026-03-28', 100, 'Races',        'Rosehill Races',                              200),
(2,  '2026-04-04', 100, 'Golf',         'Masters Championship',                         200),
(3,  '2026-04-11', 100,  NULL,           NULL,                                          100),
(4,  '2026-04-18', 100,  NULL,           NULL,                                          100),
(5,  '2026-04-25', 100,  NULL,           NULL,                                          100),
(6,  '2026-05-02', 100,  NULL,           NULL,                                          100),
(7,  '2026-05-09', 100,  NULL,           NULL,                                          100),
(8,  '2026-05-16', 100,  NULL,           NULL,                                          100),
(9,  '2026-05-23', 100, 'NRL',          'State of Origin Game I',                       200),
(10, '2026-05-30', 100,  NULL,           NULL,                                          100),
(11, '2026-06-06', 100,  NULL,           NULL,                                          100),
(12, '2026-06-13', 100, 'Soccer',       'Soccer World Cup Qualifiers',                  200),
(13, '2026-06-20', 100,  NULL,           NULL,                                          100),
(14, '2026-06-27', 100,  NULL,           NULL,                                          100),
(15, '2026-07-04', 100,  NULL,           NULL,                                          100),
(16, '2026-07-11', 100,  NULL,           NULL,                                          100),
(17, '2026-07-18', 100, 'Soccer',       'FIFA World Cup Final',                         200),
(18, '2026-07-25', 100,  NULL,           NULL,                                          100),
(19, '2026-08-01', 100, 'Table Tennis', 'World Table Tennis Championships Mens Final',  200),
(20, '2026-08-08', 100,  NULL,           NULL,                                          100),
(21, '2026-08-15', 100,  NULL,           NULL,                                          100),
(22, '2026-08-22', 100, 'E-Sports',     'DOTA TI',                                      200),
(23, '2026-08-29', 100, 'Cycling',      'UCI Road World Championships Mens Road Race',  200),
(24, '2026-09-05', 100,  NULL,           NULL,                                          100),
(25, '2026-09-12', 100,  NULL,           NULL,                                          100),
(26, '2026-09-19', 100,  NULL,           NULL,                                          100),
(27, '2026-09-26', 200,  NULL,           NULL,                                          100),
(28, '2026-10-03', 200, 'NRL',          'NRL Grand Final',                              200);
```

---

## 7. Angular Project Structure

```
tipboard/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── supabase.service.ts       # Supabase client singleton — all DB calls go here
│   │   │   └── auth.service.ts           # Session state, login, logout
│   │   ├── features/
│   │   │   ├── leaderboard/              # Reads v_leaderboard — podium, standings, stats
│   │   │   ├── rounds/                   # Reads v_round_scores — heat map grid
│   │   │   ├── race/                     # Horse race visual component
│   │   │   ├── admin/                    # Auth-gated — enter scores, manage users
│   │   │   └── login/                    # Supabase email + password form
│   │   ├── shared/
│   │   │   ├── models/
│   │   │   │   ├── user.model.ts
│   │   │   │   ├── round.model.ts
│   │   │   │   └── bet-result.model.ts
│   │   │   └── components/
│   │   │       ├── round-result-card/    # Weekly screenshot card component
│   │   │       └── upcoming-banner/     # Next round banner
│   │   └── app.routes.ts
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── styles.scss
├── tailwind.config.js
└── angular.json
```

---

## 8. Environment Config

```ts
// environment.ts and environment.prod.ts — same values
export const environment = {
  production: false,
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

---

## 9. Styling System

SCSS and Tailwind are used together. Follow this split consistently:

- **Tailwind** — layout, spacing, flex, grid, responsive breakpoints, typography scale
- **SCSS (component files)** — hover transitions, gradients, animations, dynamic state
- **`styles.scss`** — Tailwind directives, CSS custom properties, shared `@layer components`

### Design Direction
Underground sportsbook meets F1 telemetry dashboard. Dark, data-dense, electric accents.

### Fonts
- Display / headings: `Bebas Neue` or `Barlow Condensed` — tall, bold, commanding
- Data / scores / stats: `JetBrains Mono` — monospaced precision

### Colour Tokens
```scss
/* styles.scss */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg:      #0A0C10;
  --color-card:    #111318;
  --color-card-2:  #1A1E2A;
  --color-border:  #1E2230;
  --color-accent:  #C9F31D;  /* electric lime — wins, leader, highlights */
  --color-loss:    #FF3B3B;  /* loss red */
  --color-gold:    #FFB800;  /* 1st place */
  --color-silver:  #8A9BB0;  /* 2nd place */
  --color-bronze:  #CD7F32;  /* 3rd place */
  --color-muted:   #4A5568;
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded-lg font-semibold text-sm tracking-wide transition-opacity hover:opacity-90;
    background: var(--color-accent);
    color: var(--color-bg);
  }
  .btn-ghost {
    @apply px-4 py-2 rounded-lg text-sm transition-colors;
    border: 1px solid var(--color-border);
    color: var(--color-muted);
  }
  .stat-card {
    @apply rounded-2xl p-6;
    background: var(--color-card);
    border: 1px solid var(--color-border);
  }
}
```

---

## 10. UI Routes

| Route | Access | Data Source | Description |
|---|---|---|---|
| `/` | Public | `v_leaderboard` | Podium hero + full standings |
| `/rounds` | Public | `v_round_scores` | Heat map round grid |
| `/race` | Public | `v_leaderboard` | Horse race visual |
| `/admin` | Auth only | `bet_results`, `users` | Enter scores, manage players |
| `/login` | Public | — | Supabase email + password |

---

## 11. Display Rules

- Null gross → always render as `—`, never `0`
- Positive gross → accent green (`--color-accent`)
- Negative gross → loss red (`--color-loss`)
- `apply_multiplier = true` → render a `⚡×2` badge on the round grid cell
- Bonus round column (`bonus_pct = 200`) → gold tinted header with ⚡ icon
- Last place player → subtle red border, 🔻 icon
- Leader → crown 👑, lime glow pulse animation on card

---

## 12. Features & Visual Components

### Leaderboard Page (`/`)

**Podium Hero Block**
Top 3 rendered as a raised podium — 2nd | 1st | 3rd. Each card shows name, total net, win rate, and a sparkline of last 5 rounds. Leader card has a lime aura pulse animation.

**Standings List**
All players ranked below the podium. Each row includes:
- Rank movement arrow: `↑2` / `↓1` / `—` (green / red / grey)
- Points gap bar — thin proportional bar showing distance to 1st
- Current streak indicator: 🔥 win streak or ❄️ loss streak

**Danger Zone**
Bottom 2 players get a red tint card. Last place gets a flashing red border.

**Upcoming Round Banner**
Pinned at top of page. Shows next round date, sport, and bonus status:
```
⚡ ROUND 9 · 23 MAY · NRL — State of Origin Game I · BONUS ROUND ×2
```

---

### Round Grid Page (`/rounds`)

**Heat Map Cells**
Each cell colour-coded relative to round average. Above average = lime. Below average = dark red. Null = grey `—`.

**Round Summary Row**
Pinned at grid bottom. Shows round winner, highest gross, average gross per round.

**Sticky Player Column**
Player name column stays fixed while rounds scroll horizontally.

**Bonus Column Highlight**
Rounds with `bonus_pct = 200` get a gold header tint and ⚡ icon.

---

### Horse Race Page (`/race`)

Side-scrolling race track. Each player is a horse 🐎 with their name as a jockey label above. Position along the track is proportional to their current net points relative to the leader.

```ts
// Position calculation
horsePositionPct = (playerNet / leaderNet) * 100
```

- Leader gets a 👑 above their horse
- Horses animate smoothly to new positions on data refresh (`transition: left 0.8s ease`)
- Last place has a comedy dust cloud behind them
- `apply_multiplier` activation triggers a brief turbo boost animation
- On mobile: track rotates to vertical (top to bottom)
- Track has distance markers at 25%, 50%, 75%

**Implementation**: Pure SVG + SCSS animation. No third party library needed.

---

### Round Result Card (shared component)
A bold portrait-optimised graphic generated after each round is entered. Designed to be screenshotted and sent to the group.

Contents:
- Round number, date, sport / special event name
- Round winner + their score
- Biggest rank mover (↑ name)
- Any ⚡ multiplier activations this round
- Top 5 leaderboard snapshot

Style: Sports broadcast graphic aesthetic. Big type, high contrast, minimal clutter.

---

### Per Player Stats
Available on click/tap of any player card. Shows:

| Metric | Description |
|---|---|
| Net Points | Primary ranking metric |
| Gross Points | Raw before multipliers |
| Win Rate % | Wins / total bets |
| Current Streak | 🔥 W or ❄️ L |
| Best Round | Highest single round net |
| Worst Round | Lowest single round net |
| Bonus Activations | Times multiplier was applied |
| Rounds Played | Out of 28 |

---

### Group-Wide Stats Widget
| Metric | Description |
|---|---|
| Group Win Rate | Total wins / total bets across all players |
| Season Progress | Rounds completed arc — e.g. `7 / 28 · 25%` |
| Tightest Round | Smallest spread between 1st and last |
| Biggest Swing | Largest spread between 1st and last |

---

## 13. Micro-Interactions & Motion

- **Page load**: Leaderboard rows stagger in from bottom, 80ms delay between each
- **Score saved**: Number count-up animation on the affected player's score
- **Rank change**: Cards animate to new positions with FLIP transition
- **Player card hover**: `transform: translateY(-3px)` + accent border glow
- **Bonus cell**: ⚡ badge pulses on render
- **Win streak**: Animated flame flicker on 🔥 via CSS keyframes
- **Horse race**: Smooth `transition: left 0.8s ease` on position updates

---

## 14. GitHub Pages Deployment

```bash
ng build --output-path docs --base-href /tipboard/
```

In `angular.json` set `"outputPath": "docs"`.
In GitHub: Settings → Pages → Source: `main` branch, `/docs` folder.

---

## 15. Supabase Setup Order

Complete this manually before writing any Angular code:

1. Create project at supabase.com — region: Sydney, plan: Free
2. SQL Editor → run table creation (users, weekly_schedule, bet_results)
3. SQL Editor → run RLS policies
4. SQL Editor → run seed data for weekly_schedule
5. SQL Editor → create views (v_leaderboard, v_round_scores)
6. Authentication → Users → Invite user → your email (admin account)
7. Settings → API → copy Project URL and anon key into Angular environment files

---

## 16. Build Order for Claude Code

Follow this sequence strictly to avoid dependency issues:

1. Scaffold Angular project — configure Tailwind, SCSS, and Google Fonts (Bebas Neue + JetBrains Mono)
2. Install `@supabase/supabase-js` — set up environment config
3. Build `core/` — `supabase.service.ts` and `auth.service.ts`
4. Build shared models (`user`, `round`, `bet-result`)
5. Build auth guard for `/admin` route
6. Build `/login` page
7. Build `/` leaderboard — podium, standings, rank movement, danger zone, upcoming banner
8. Build `/rounds` — heat map grid, sticky column, bonus highlights
9. Build `/race` — horse race SVG component
10. Build shared `round-result-card` component
11. Build `/admin` — score entry form, player management
12. Configure `angular.json` for GitHub Pages output and test build
