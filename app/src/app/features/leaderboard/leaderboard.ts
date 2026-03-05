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

  players = signal<PlayerRow[]>([]);
  nextRound = signal<Round | null>(null);
  schedule = signal<Round[]>([]);
  completedRoundCount = signal(0);

  readonly totalRounds = 28;

  rounds = computed(() =>
    Array.from({ length: this.totalRounds }, (_, i) => ({
      number: i + 1,
      done: i < this.completedRoundCount(),
    }))
  );

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

      // Count rounds that have at least one result
      const completedRounds = new Set(
        roundScores.filter(r => r.gross !== null).map(r => r.round_number)
      ).size;

      this.players.set(players);
      this.nextRound.set(nextRound);
      this.schedule.set(schedule);
      this.completedRoundCount.set(completedRounds);
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

  rankLabel(rank: number): string {
    return ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'][rank - 1] ?? `${rank}TH`;
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
}
