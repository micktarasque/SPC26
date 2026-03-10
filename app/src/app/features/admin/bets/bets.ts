import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase.service';
import { Round } from '../../../shared/models/round.model';
import { User } from '../../../shared/models/user.model';
import { BetResult } from '../../../shared/models/bet-result.model';

// TODO(review): On mobile (< 600px) the multiplier toggle and action buttons are hidden
// (bets.scss). Auto-save on blur still works for gross entry, but the ⚡×2 multiplier
// cannot be set on mobile. Consider a mobile-friendly inline toggle or swipe action.

interface ScoreRow {
  user: User;
  gross: string;
  applyMultiplier: boolean;
  saving: boolean;
  saveError: string | null;
  saved: boolean;
  pending: boolean;
}

@Component({
  selector: 'app-bets',
  imports: [FormsModule],
  templateUrl: './bets.html',
  styleUrl: './bets.scss',
})
export class Bets implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal<string | null>(null);

  schedule = signal<Round[]>([]);
  selectedRound = signal<Round | null>(null);

  loadingScores = signal(false);
  scoresError = signal<string | null>(null);
  rows = signal<ScoreRow[]>([]);

  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const schedule = await this.db.getSchedule();
      this.schedule.set(schedule);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load schedule');
    } finally {
      this.loading.set(false);
    }
  }

  async selectRound(round: Round) {
    this.selectedRound.set(round);
    this.loadingScores.set(true);
    this.scoresError.set(null);
    try {
      const [users, betResults] = await Promise.all([
        this.db.getUsers(),
        this.db.getBetResults(round.id),
      ]);

      const activeUsers = users.filter(u => u.active);
      const resultMap = new Map<string, BetResult>(
        betResults.map(r => [r.user_id, r])
      );

      const rows: ScoreRow[] = activeUsers.map(user => {
        const existing = resultMap.get(user.id);
        return {
          user,
          gross: existing ? String(existing.gross) : '',
          applyMultiplier: existing?.apply_multiplier ?? false,
          saving: false,
          saveError: null,
          saved: false,
          pending: false,
        };
      });

      this.rows.set(rows);
    } catch (e: any) {
      this.scoresError.set(e?.message ?? 'Failed to load scores');
    } finally {
      this.loadingScores.set(false);
    }
  }

  backToRounds() {
    this.selectedRound.set(null);
    this.rows.set([]);
    this.scoresError.set(null);
  }

  ngOnDestroy() {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  async saveRow(row: ScoreRow) {
    const round = this.selectedRound();
    if (!round) return;
    const grossNum = parseFloat(row.gross);
    if (row.gross.trim() === '' || isNaN(grossNum)) return;

    row.saving = true;
    row.saveError = null;
    row.saved = false;
    this.rows.update(r => [...r]);

    try {
      await this.db.upsertBetResult({
        user_id: row.user.id,
        schedule_id: round.id,
        gross: grossNum,
        apply_multiplier: row.applyMultiplier,
      });
      row.saved = true;
      this.rows.update(r => [...r]);
      setTimeout(() => {
        row.saved = false;
        this.rows.update(r => [...r]);
      }, 2000);
    } catch (e: any) {
      row.saveError = e?.message ?? 'Save failed';
      this.rows.update(r => [...r]);
    } finally {
      row.saving = false;
      this.rows.update(r => [...r]);
    }
  }

  async deleteRow(row: ScoreRow) {
    const round = this.selectedRound();
    if (!round) return;

    row.saving = true;
    row.saveError = null;
    this.rows.update(r => [...r]);

    try {
      await this.db.deleteBetResult(row.user.id, round.id);
      row.gross = '';
      row.applyMultiplier = false;
      row.saved = false;
      this.rows.update(r => [...r]);
    } catch (e: any) {
      row.saveError = e?.message ?? 'Delete failed';
      this.rows.update(r => [...r]);
    } finally {
      row.saving = false;
      this.rows.update(r => [...r]);
    }
  }

  onGrossChange(row: ScoreRow, value: number | null) {
    row.gross = (value !== null && value !== undefined) ? String(value) : '';
    this.scheduleAutoSave(row);
  }

  onBlur(row: ScoreRow) {
    const key = row.user.id;
    const timer = this.debounceTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
      row.pending = false;
      this.saveRow(row);
    }
  }

  onMultiplierChange(row: ScoreRow) {
    this.scheduleAutoSave(row);
  }

  private scheduleAutoSave(row: ScoreRow) {
    const key = row.user.id;
    clearTimeout(this.debounceTimers.get(key));
    row.pending = true;
    row.saved = false;
    this.rows.update(r => [...r]);
    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      row.pending = false;
      this.saveRow(row);
    }, 1000));
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  }

  isBonus(round: Round): boolean {
    return round.bonus_pct > 100;
  }

  hasGross(row: ScoreRow): boolean {
    return row.gross.trim() !== '' && !isNaN(parseFloat(row.gross));
  }
}
