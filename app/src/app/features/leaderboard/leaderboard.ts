// TODO(review): Spec §12 shared components not yet built:
//   - shared/components/round-result-card/ — screenshottable round summary card
//   - Per-player stats panel (click/tap on player row)
//   - Group-wide stats widget (group win rate, season progress, tightest/biggest swing)
// TODO(review): Spec §13 — Leaderboard row stagger animation (80ms delay per row) not
//   implemented. Add animation-delay via @for $index to each .score-row.

import { Component, OnInit, signal, computed } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { LeaderboardEntry } from '../../shared/models/bet-result.model';
import { Round, RoundScore } from '../../shared/models/round.model';

interface PlayerRow extends LeaderboardEntry {
  rank: number;
  streak: number;
  streakType: 'win' | 'loss';
}

@Component({
  selector: 'app-leaderboard',
  imports: [],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);

  players    = signal<PlayerRow[]>([]);
  nextRound  = signal<Round | null>(null);
  schedule   = signal<Round[]>([]);
  roundScores = signal<RoundScore[]>([]);
  completedRoundCount = signal(0);

  readonly totalRounds = 28;

  rounds = computed(() =>
    Array.from({ length: this.totalRounds }, (_, i) => ({
      number: i + 1,
      done: i < this.completedRoundCount(),
    }))
  );

  // ─── Cockpit panel computed stats ─────────────────────────────────────────────

  groupWinRate = computed(() => {
    const played = this.roundScores().filter(s => s.gross !== null);
    if (played.length === 0) return null;
    const wins = played.filter(s => (s.gross ?? 0) > 0).length;
    return Math.round((wins / played.length) * 100);
  });

  seasonPct = computed(() =>
    Math.round((this.completedRoundCount() / this.totalRounds) * 100)
  );

  p2Gap = computed(() => {
    const p = this.players();
    if (p.length < 2 || p[0].total_net === null || p[1].total_net === null) return null;
    return (p[0].total_net ?? 0) - (p[1].total_net ?? 0);
  });

  dangerPlayers = computed(() => {
    const p = this.players();
    if (p.length === 0) return [];
    return p.length >= 2 ? [p[p.length - 1], p[p.length - 2]] : [p[p.length - 1]];
  });

  bestRound = computed(() => {
    const scored = this.roundScores().filter(s => s.gross !== null);
    if (!scored.length) return null;
    const best = scored.reduce((a, b) => b.gross! > a.gross! ? b : a);
    const player = this.players().find(p => p.user_id === best.user_id);
    return { name: player?.name ?? '?', gross: best.gross!, round: best.round_number };
  });

  worstRound = computed(() => {
    const scored = this.roundScores().filter(s => s.gross !== null);
    if (!scored.length) return null;
    const worst = scored.reduce((a, b) => b.gross! < a.gross! ? b : a);
    const player = this.players().find(p => p.user_id === worst.user_id);
    return { name: player?.name ?? '?', gross: worst.gross!, round: worst.round_number };
  });

  topStreak = computed(() => {
    const winners = this.players().filter(pl => pl.streak > 0 && pl.streakType === 'win');
    if (!winners.length) return null;
    return winners.reduce((a, b) => b.streak > a.streak ? b : a);
  });

  mostWins = computed(() => {
    const winCounts = new Map<string, number>();
    for (const s of this.roundScores()) {
      if (s.gross !== null && s.gross > 0) {
        winCounts.set(s.user_id, (winCounts.get(s.user_id) ?? 0) + 1);
      }
    }
    let bestUid = '';
    let bestCount = 0;
    for (const [uid, count] of winCounts) {
      if (count > bestCount) { bestUid = uid; bestCount = count; }
    }
    if (!bestUid) return null;
    const player = this.players().find(p => p.user_id === bestUid);
    return player ? { name: player.name, count: bestCount } : null;
  });

  heatMap = computed(() => {
    const players = this.players();
    const scores = this.roundScores();
    const lookup = new Map<string, number>();
    for (const s of scores) {
      if (s.gross !== null) lookup.set(`${s.user_id}:${s.round_number}`, s.gross);
    }
    const rounds = [...new Set(
      scores.filter(s => s.gross !== null).map(s => s.round_number)
    )].sort((a, b) => a - b);
    return {
      rounds,
      rows: players.map(p => ({
        name: p.name,
        cells: rounds.map(rn => lookup.has(`${p.user_id}:${rn}`) ? (lookup.get(`${p.user_id}:${rn}`) ?? null) : null)
      }))
    };
  });

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const [leaderboard, roundScores, nextRound, schedule] = await Promise.all([
        this.db.getLeaderboard(),
        this.db.getRoundScores(),
        this.db.getNextRound(),
        this.db.getSchedule(),
      ]);

      const streakMap = this.computeStreaks(roundScores);

      const players: PlayerRow[] = leaderboard.map((entry, i) => ({
        ...entry,
        rank: i + 1,
        ...( streakMap.get(entry.user_id) ?? { streak: 0, streakType: 'win' as const }),
      }));

      const completedRounds = new Set(
        roundScores.filter(r => r.gross !== null).map(r => r.round_number)
      ).size;

      this.players.set(players);
      this.nextRound.set(nextRound);
      this.schedule.set(schedule);
      this.completedRoundCount.set(completedRounds);
      this.roundScores.set(roundScores);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load data');
    } finally {
      this.loading.set(false);
    }
  }

  private computeStreaks(scores: RoundScore[]): Map<string, { streak: number; streakType: 'win' | 'loss' }> {
    const map = new Map<string, { streak: number; streakType: 'win' | 'loss' }>();
    const byPlayer = new Map<string, RoundScore[]>();

    for (const s of scores) {
      if (s.gross === null) continue;
      const arr = byPlayer.get(s.user_id) ?? [];
      arr.push(s);
      byPlayer.set(s.user_id, arr);
    }

    for (const [userId, rows] of byPlayer) {
      const sorted = rows.sort((a, b) => b.round_number - a.round_number);
      const type: 'win' | 'loss' = sorted[0].gross! > 0 ? 'win' : 'loss';
      let count = 0;
      for (const r of sorted) {
        const isWin = r.gross! > 0;
        if ((type === 'win' && isWin) || (type === 'loss' && !isWin)) count++;
        else break;
      }
      map.set(userId, { streak: count, streakType: type });
    }

    return map;
  }

  // ─── Template helpers ─────────────────────────────────────────────────────────

  rankLabel(rank: number): string {
    const mod100 = rank % 100;
    const mod10 = rank % 10;
    const suffix =
      mod100 >= 11 && mod100 <= 13 ? 'TH'
      : mod10 === 1 ? 'ST'
      : mod10 === 2 ? 'ND'
      : mod10 === 3 ? 'RD'
      : 'TH';
    return `${rank}${suffix}`;
  }

  rankColor(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'default';
  }

  formatNet(net: number | null): string {
    if (net === null) return '—';
    return net >= 0 ? `+${net}` : `${net}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase();
  }

  repeat(n: number): number[] {
    return Array(Math.min(n, 5)).fill(0);
  }

  lastRounds(userId: string, n: number): (number | null)[] {
    const played = this.roundScores()
      .filter(s => s.user_id === userId && s.gross !== null)
      .sort((a, b) => a.round_number - b.round_number);
    const last = played.slice(-n).map(s => s.gross);
    const padded: (number | null)[] = Array(n - last.length).fill(null).concat(last);
    return padded;
  }

  roundBarClass(gross: number | null): string {
    if (gross === null) return 'ck-bar--null';
    return gross > 0 ? 'ck-bar--win' : 'ck-bar--loss';
  }

  roundBarLabel(gross: number | null): string {
    if (gross === null) return '·';
    return gross > 0 ? 'W' : 'L';
  }

  playerWinRate(userId: string): number | null {
    const played = this.roundScores().filter(s => s.user_id === userId && s.gross !== null);
    if (!played.length) return null;
    const wins = played.filter(s => s.gross! > 0).length;
    return Math.round((wins / played.length) * 100);
  }
}
