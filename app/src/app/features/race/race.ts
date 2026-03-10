import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

interface HorseData {
  user_id: string;
  name: string;
  net: number;
  positionPct: number;
  rank: number;
  isLeader: boolean;
  isLast: boolean;
  mobileXPct: number;
}

@Component({
  selector: 'app-race',
  imports: [],
  templateUrl: './race.html',
  styleUrl: './race.scss',
})
export class Race implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  horses = signal<HorseData[]>([]);
  animated = signal(false);
  seasonStarted = signal(false);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const leaderboard = await this.db.getLeaderboard();
      const seasonStarted = leaderboard.some(e => (e.total_net ?? 0) !== 0);
      this.seasonStarted.set(seasonStarted);

      const total = leaderboard.length;
      const nets = leaderboard.map(e => e.total_net ?? 0);
      const minNet = Math.min(...nets);
      const maxNet = Math.max(...nets);
      const range = maxNet - minNet;

      const horses: HorseData[] = leaderboard.map((entry, i) => {
        const net = entry.total_net ?? 0;
        // Range-based: spread horses 5–100% even when all scores are negative.
        // If everyone is equal (range === 0) or season not started, all sit at 0.
        const positionPct = !seasonStarted || range === 0
          ? 0
          : Math.round(((net - minNet) / range) * 95 + 5);
        return {
          user_id: entry.user_id,
          name: entry.name,
          net,
          positionPct,
          rank: i + 1,
          isLeader: i === 0,
          isLast: i === total - 1,
          mobileXPct: total <= 1 ? 50 : Math.round((i / Math.max(1, total - 1)) * 80 + 10),
        };
      });

      this.horses.set(horses);
      setTimeout(() => this.animated.set(true), 80);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load race data');
    } finally {
      this.loading.set(false);
    }
  }

  formatNet(net: number): string {
    if (net === 0 && !this.seasonStarted()) return '\u2014';
    return net >= 0 ? `+${net}` : `${net}`;
  }

  horseLeft(horse: HorseData): number {
    return this.animated() ? horse.positionPct : 0;
  }

  horseBottom(horse: HorseData): number {
    return this.animated() ? horse.positionPct : 0;
  }

  rankColor(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'default';
  }
}
