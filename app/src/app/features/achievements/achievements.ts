import { Component, OnInit, signal, computed } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementDef, AchievementStats,
  AchievementCategory, AchievementRarity, checkAchievement,
  RARITY_COLOR, RARITY_LABEL,
} from '../../shared/achievements';

interface PlayerAch {
  user_id: string;
  name:    string;
  ids:     string[];  // achievement IDs earned
}

interface AchCard {
  def:       AchievementDef;
  earnedBy:  string[];   // player names
  unlocked:  boolean;
}

@Component({
  selector: 'app-achievements',
  imports: [],
  templateUrl: './achievements.html',
  styleUrl:    './achievements.scss',
})
export class Achievements implements OnInit {
  readonly TOTAL_ROUNDS = 28;

  loading = signal(true);
  error   = signal<string | null>(null);

  // All achievement cards with who earned them
  cards = signal<AchCard[]>([]);

  // Grouped by category for the template
  grouped = computed(() => {
    const cs = this.cards();
    return ACHIEVEMENT_CATEGORIES.map(cat => ({
      cat,
      cards: cs.filter(c => c.def.category === cat),
    }));
  });

  totalUnlocked = computed(() =>
    this.cards().filter(c => c.unlocked).length
  );

  // Expose helpers to template
  readonly RARITY_COLOR = RARITY_COLOR;
  readonly RARITY_LABEL = RARITY_LABEL;
  readonly TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const [leaderboard, roundScores] = await Promise.all([
        this.db.getLeaderboard(),
        this.db.getRoundScores(),
      ]);

      const total = leaderboard.length;

      // Build per-player AchievementStats
      const playerStats: { name: string; stats: AchievementStats }[] = leaderboard.map((entry, i) => {
        const scores = roundScores
          .filter(s => s.user_id === entry.user_id && s.gross !== null)
          .sort((a, b) => a.round_number - b.round_number);

        const grossValues = scores.map(s => s.gross as number);
        const wins = grossValues.filter(g => g > 0);

        // Streak scan (ascending for max, descending for current)
        let maxWinStreak = 0, maxLossStreak = 0;
        let curW = 0, curL = 0;
        let lossRun = 0, winRun = 0, hadSlump = false, slumpBuster = false;
        let currentStreak = 0;
        let streak_type: 'win' | 'loss' = 'win';

        for (const s of scores) {
          const isWin = s.gross! > 0;
          curW = isWin ? curW + 1 : 0;
          curL = isWin ? 0 : curL + 1;
          maxWinStreak  = Math.max(maxWinStreak, curW);
          maxLossStreak = Math.max(maxLossStreak, curL);
          winRun  = isWin ? winRun + 1  : 0;
          lossRun = isWin ? 0 : lossRun + 1;
          if (lossRun >= 3) hadSlump = true;
          if (hadSlump && winRun >= 2) slumpBuster = true;
        }

        // Current streak (descending)
        const recent = [...scores].sort((a, b) => b.round_number - a.round_number);
        if (recent.length > 0) {
          streak_type = recent[0].gross! > 0 ? 'win' : 'loss';
          for (const s of recent) {
            const isWin = s.gross! > 0;
            if ((streak_type === 'win' && isWin) || (streak_type === 'loss' && !isWin)) currentStreak++;
            else break;
          }
        }

        const multiplier_count = roundScores.filter(
          s => s.user_id === entry.user_id && s.apply_multiplier === true
        ).length;

        const win_rate = grossValues.length > 0
          ? Math.round((wins.length / grossValues.length) * 100) : null;

        return {
          name: entry.name,
          stats: {
            rank:             i + 1,
            totalPlayers:     total,
            win_rate,
            total_net:        entry.total_net,
            total_bets:       entry.total_bets,
            missed_rounds:    this.TOTAL_ROUNDS - entry.total_bets,
            totalRounds:      this.TOTAL_ROUNDS,
            streak:           currentStreak,
            streak_type,
            maxWinStreak,
            maxLossStreak,
            multiplier_count,
            best_round:       grossValues.length ? Math.max(...grossValues) : null,
            worst_round:      grossValues.length ? Math.min(...grossValues) : null,
            compBestRound:    null,  // filled after all players computed
            compWorstRound:   null,
            slumpBuster,
          } as AchievementStats,
        };
      });

      // Fill cross-player thresholds
      const allBest  = playerStats.map(p => p.stats.best_round).filter((v): v is number => v !== null);
      const allWorst = playerStats.map(p => p.stats.worst_round).filter((v): v is number => v !== null);
      const compBest  = allBest.length  ? Math.max(...allBest)  : null;
      const compWorst = allWorst.length ? Math.min(...allWorst) : null;
      playerStats.forEach(p => {
        p.stats.compBestRound  = compBest;
        p.stats.compWorstRound = compWorst;
      });

      // For each achievement, find earners
      const achCards: AchCard[] = ACHIEVEMENTS.map(def => {
        const earnedBy = playerStats
          .filter(p => checkAchievement(def.id, p.stats))
          .map(p => p.name);
        return { def, earnedBy, unlocked: earnedBy.length > 0 };
      });

      this.cards.set(achCards);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load achievements');
    } finally {
      this.loading.set(false);
    }
  }

  countUnlocked(cards: AchCard[]): number {
    return cards.filter(c => c.unlocked).length;
  }

  rarityBorderColor(rarity: AchievementRarity): string {
    return RARITY_COLOR[rarity];
  }

  rarityGlow(rarity: AchievementRarity): string {
    const c = RARITY_COLOR[rarity];
    return `0 0 20px ${c}33, inset 0 0 20px ${c}08`;
  }

  categoryIcon(cat: AchievementCategory): string {
    const map: Record<AchievementCategory, string> = {
      GLORY:      '🏆',
      SKILL:      '🎯',
      STREAK:     '🔥',
      STRATEGY:   '♟️',
      COMMITMENT: '💪',
      BANTER:     '😂',
    };
    return map[cat];
  }
}
