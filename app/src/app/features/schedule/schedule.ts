import { Component, OnInit, computed, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Round } from '../../shared/models/round.model';

const SPORT_ICONS: Record<string, string> = {
  'Races':        '🏇',
  'Horse Racing': '🏇',
  'AFL':          '🏈',
  'NRL':          '🏉',
  'Rugby Union':  '🏉',
  'Soccer':       '⚽',
  'Cricket':      '🏏',
  'Golf':         '⛳',
  'Tennis':       '🎾',
  'Basketball':   '🏀',
  'Boxing':       '🥊',
  'Cycling':      '🚴',
  'E-Sports':     '🎮',
  'Table Tennis': '🏓',
};

@Component({
  selector: 'app-schedule',
  imports: [],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule implements OnInit {
  loading = signal(true);
  error   = signal<string | null>(null);
  schedule = signal<Round[]>([]);

  readonly today = new Date().toISOString().split('T')[0];

  upcoming = computed(() =>
    this.schedule().filter(r => r.round_date >= this.today)
  );

  past = computed(() =>
    this.schedule().filter(r => r.round_date < this.today)
  );

  nextRound = computed(() => this.upcoming()[0] ?? null);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      this.schedule.set(await this.db.getSchedule());
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load schedule');
    } finally {
      this.loading.set(false);
    }
  }

  sportIcon(sport: string | null): string {
    if (!sport) return '🎲';
    return SPORT_ICONS[sport] ?? '🎲';
  }

  multiplierLabel(r: Round): string {
    return `×${(r.bonus_pct / 100).toFixed(1)}`;
  }

  isBonus(r: Round): boolean {
    return r.bonus_pct > 100;
  }

  isNext(r: Round): boolean {
    return this.nextRound()?.id === r.id;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  }

  roundLabel(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }
}
