import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { User } from '../../shared/models/user.model';
import {
  ACHIEVEMENTS, AchievementDef, AchievementStats,
  checkAchievement, RARITY_COLOR,
} from '../../shared/achievements';

interface PlayerCard {
  rank:             number;
  user_id:          string;
  name:             string;
  active:           boolean;
  total_bets:       number;
  total_gross:      number | null;
  total_net:        number | null;
  win_rate:         number | null;
  best_round:       number | null;
  worst_round:      number | null;
  avg_gross:        number | null;
  missed_rounds:    number;
  streak:           number;
  streak_type:      'win' | 'loss';
  maxWinStreak:     number;
  maxLossStreak:    number;
  slumpBuster:      boolean;
  multiplier_count: number;
  last5:            (number | null)[];
  title:            string;
  achievements:     string[];
}

@Component({
  selector: 'app-players',
  imports: [],
  templateUrl: './players.html',
  styleUrl: './players.scss',
})
export class Players implements OnInit {
  readonly TOTAL_ROUNDS = 28;

  loading    = signal(true);
  error      = signal<string | null>(null);
  players    = signal<PlayerCard[]>([]);
  expandedId = signal<string | null>(null);

  // Expose achievement definitions to the template
  readonly ACHIEVEMENTS = ACHIEVEMENTS;

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const [leaderboard, users, roundScores] = await Promise.all([
        this.db.getLeaderboard(),
        this.db.getUsers(),
        this.db.getRoundScores(),
      ]);

      const activeMap = new Map<string, boolean>(
        users.map((u: User) => [u.id, u.active])
      );

      // Highest round number where any score has been entered (null = not yet played)
      const roundsElapsed = roundScores
        .filter(s => s.gross !== null)
        .reduce((max, s) => Math.max(max, s.round_number), 0);

      const cards: PlayerCard[] = leaderboard.map((entry, i) => {
        const scores = roundScores
          .filter(s => s.user_id === entry.user_id && s.gross !== null)
          .sort((a, b) => a.round_number - b.round_number);

        const grossValues = scores.map(s => s.gross as number);
        const wins = grossValues.filter(g => g > 0);

        // Current streak (from most recent round backwards)
        const recent = [...scores].sort((a, b) => b.round_number - a.round_number);
        let streak = 0;
        let streak_type: 'win' | 'loss' = 'win';
        if (recent.length > 0) {
          streak_type = recent[0].gross! > 0 ? 'win' : 'loss';
          for (const s of recent) {
            const isWin = s.gross! > 0;
            if ((streak_type === 'win' && isWin) || (streak_type === 'loss' && !isWin)) streak++;
            else break;
          }
        }

        // Max win/loss streaks + slump buster (scan ascending)
        let maxWinStreak = 0, maxLossStreak = 0;
        let curW = 0, curL = 0;
        let lossRun = 0, winRun = 0, hadSlump = false, slumpBuster = false;
        for (const s of scores) {
          const isWin = s.gross! > 0;
          if (isWin) {
            curW++; curL = 0;
            maxWinStreak = Math.max(maxWinStreak, curW);
            lossRun = 0; winRun++;
            if (hadSlump && winRun >= 2) slumpBuster = true;
          } else {
            curL++; curW = 0;
            maxLossStreak = Math.max(maxLossStreak, curL);
            winRun = 0; lossRun++;
            if (lossRun >= 3) hadSlump = true;
          }
        }

        // Last 5 form
        const last5raw = grossValues.slice(-5);
        const last5: (number | null)[] = Array(5 - last5raw.length).fill(null).concat(last5raw);

        const multiplier_count = roundScores.filter(
          s => s.user_id === entry.user_id && s.apply_multiplier === true
        ).length;

        const win_rate = grossValues.length > 0
          ? Math.round((wins.length / grossValues.length) * 100)
          : null;
        const avg_gross = grossValues.length > 0
          ? Math.round((grossValues.reduce((a, b) => a + b, 0) / grossValues.length) * 10) / 10
          : null;

        return {
          rank: i + 1,
          user_id: entry.user_id,
          name: entry.name,
          active: activeMap.get(entry.user_id) ?? true,
          total_bets: entry.total_bets,
          total_gross: entry.total_gross,
          total_net: entry.total_net,
          win_rate,
          best_round:    grossValues.length > 0 ? Math.max(...grossValues) : null,
          worst_round:   grossValues.length > 0 ? Math.min(...grossValues) : null,
          avg_gross,
          missed_rounds: roundsElapsed - entry.total_bets,
          streak,
          streak_type,
          maxWinStreak,
          maxLossStreak,
          slumpBuster,
          multiplier_count,
          last5,
          title:        '',  // filled below
          achievements: [],  // filled below
        };
      });

      // Assign titles
      const total = cards.length;
      cards.forEach(p => { p.title = this.assignTitle(p, cards, total); });

      // Compute cross-player achievement thresholds
      const allBest  = cards.map(c => c.best_round).filter((v): v is number => v !== null);
      const allWorst = cards.map(c => c.worst_round).filter((v): v is number => v !== null);
      const compBestRound  = allBest.length  ? Math.max(...allBest)  : null;
      const compWorstRound = allWorst.length ? Math.min(...allWorst) : null;

      // Assign achievements
      cards.forEach(p => {
        const stats: AchievementStats = {
          rank:             p.rank,
          totalPlayers:     cards.length,
          win_rate:         p.win_rate,
          total_net:        p.total_net,
          total_bets:       p.total_bets,
          missed_rounds:    p.missed_rounds,
          roundsElapsed:    roundsElapsed,
          totalRounds:      this.TOTAL_ROUNDS,
          streak:           p.streak,
          streak_type:      p.streak_type,
          maxWinStreak:     p.maxWinStreak,
          maxLossStreak:    p.maxLossStreak,
          multiplier_count: p.multiplier_count,
          best_round:       p.best_round,
          worst_round:      p.worst_round,
          compBestRound,
          compWorstRound,
          slumpBuster:      p.slumpBuster,
        };
        p.achievements = ACHIEVEMENTS
          .filter(a => checkAchievement(a.id, stats))
          .map(a => a.id);
      });

      this.players.set(cards);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load player data');
    } finally {
      this.loading.set(false);
    }
  }

  private assignTitle(p: PlayerCard, all: PlayerCard[], total: number): string {
    if (p.rank === 1)                                          return '👑 THE CHAMPION';
    if (p.rank === total && total > 1)                         return '🪵 WOODEN SPOON';
    if (p.win_rate !== null && p.win_rate >= 70)               return '🎯 SHARPSHOOTER';
    if (p.streak >= 4 && p.streak_type === 'win')              return '🔥 ON FIRE';
    if (p.streak >= 4 && p.streak_type === 'loss')             return '❄️ IN A SLUMP';
    if (p.multiplier_count >= 3)                               return '⚡ BONUS HUNTER';
    if (p.missed_rounds >= 6)                                  return '👻 THE GHOST';
    if (p.rank === 2)                                          return '🥈 THE CHALLENGER';
    if (p.rank === 3)                                          return '🥉 THE CONTENDER';
    if (p.win_rate !== null && p.win_rate < 35 && p.total_bets >= 5) return '😬 ALWAYS HOPEFUL';
    return '⚔️ IN THE HUNT';
  }

  toggleExpand(id: string) {
    this.expandedId.update(curr => curr === id ? null : id);
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }

  // Achievement helpers for template
  getAchievement(id: string): AchievementDef {
    return ACHIEVEMENTS.find(a => a.id === id)!;
  }

  badgeGlow(id: string): string {
    const a = this.getAchievement(id);
    const col = RARITY_COLOR[a.rarity];
    return `0 0 8px ${col}88`;
  }

  formatNet(net: number | null): string {
    if (net === null) return '—';
    return net >= 0 ? `+${net}` : `${net}`;
  }

  formatAvg(avg: number | null): string {
    if (avg === null) return '—';
    return avg >= 0 ? `+${avg}` : `${avg}`;
  }

  rankLabel(rank: number): string {
    const mod100 = rank % 100;
    const mod10  = rank % 10;
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

  streakLabel(p: PlayerCard): string {
    if (p.streak === 0) return '—';
    const icon = p.streak_type === 'win' ? '🔥' : '❄️';
    return `${p.streak}× ${icon}`;
  }

  winRateColor(rate: number | null): string {
    if (rate === null) return 'var(--color-muted)';
    if (rate >= 60)    return 'var(--color-win)';
    if (rate < 40)     return 'var(--color-loss)';
    return 'var(--color-text)';
  }

  avgColor(avg: number | null): string {
    if (avg === null) return 'var(--color-muted)';
    if (avg > 0)      return 'var(--color-win)';
    if (avg < 0)      return 'var(--color-loss)';
    return 'var(--color-muted)';
  }

  netLeaderPct(p: PlayerCard, players: PlayerCard[]): number {
    const leader = players[0]?.total_net ?? 0;
    if (leader <= 0 || p.total_net === null) return 0;
    return Math.max(0, Math.min(100, Math.round(((p.total_net ?? 0) / leader) * 100)));
  }
}
