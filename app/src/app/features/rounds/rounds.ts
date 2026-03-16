import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { RoundScore } from '../../shared/models/round.model';

interface RoundCol {
  round_number: number;
  round_date: string;
  sport: string | null;
  special_event: string | null;
  bonus_pct: number;
  multiplier: number;
  isBonus: boolean;
  avgGross: number | null;
  winner: string | null;
  highestGross: number | null;
}

interface CellData {
  gross: number | null;
  apply_multiplier: boolean | null;
  net: number | null;
}

interface PlayerRow {
  user_id: string;
  name: string;
  cells: Map<number, CellData>;
  totalGross: number | null;
}

@Component({
  selector: 'app-rounds',
  imports: [],
  templateUrl: './rounds.html',
  styleUrl: './rounds.scss',
})
export class Rounds implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);

  roundCols = signal<RoundCol[]>([]);
  playerRows = signal<PlayerRow[]>([]);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const scores = await this.db.getRoundScores();
      this.processData(scores);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load data');
    } finally {
      this.loading.set(false);
    }
  }

  private processData(scores: RoundScore[]) {
    // ─── Build round metadata ───────────────────────────────────────────────
    const roundMeta = new Map<number, RoundScore>();
    const scoresByRound = new Map<number, RoundScore[]>();

    for (const s of scores) {
      if (!roundMeta.has(s.round_number)) roundMeta.set(s.round_number, s);
      const arr = scoresByRound.get(s.round_number) ?? [];
      arr.push(s);
      scoresByRound.set(s.round_number, arr);
    }

    const cols: RoundCol[] = Array.from(roundMeta.entries())
      .sort(([a], [b]) => a - b)
      .map(([rn, s]) => {
        const roundScores = scoresByRound.get(rn) ?? [];
        const nonNull = roundScores
          .filter(r => r.gross !== null)
          .map(r => r.gross as number);

        const avgGross =
          nonNull.length > 0
            ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length
            : null;

        let winner: string | null = null;
        let highestGross: number | null = null;
        for (const r of roundScores) {
          if (r.gross !== null && (highestGross === null || r.gross > highestGross)) {
            highestGross = r.gross;
            winner = r.name;
          }
        }

        return {
          round_number: rn,
          round_date: s.round_date,
          sport: s.sport,
          special_event: s.special_event,
          bonus_pct: s.bonus_pct,
          multiplier: s.bonus_pct / 100,
          isBonus: s.bonus_pct > 100,
          avgGross,
          winner,
          highestGross,
        };
      });

    // ─── Build player rows ──────────────────────────────────────────────────
    const playerMap = new Map<string, PlayerRow>();

    for (const s of scores) {
      if (!playerMap.has(s.user_id)) {
        playerMap.set(s.user_id, {
          user_id: s.user_id,
          name: s.name,
          cells: new Map(),
          totalGross: null,
        });
      }
      const row = playerMap.get(s.user_id)!;
      row.cells.set(s.round_number, {
        gross: s.gross,
        apply_multiplier: s.apply_multiplier,
        net: s.net,
      });
      if (s.gross !== null) {
        row.totalGross = (row.totalGross ?? 0) + s.gross;
      }
    }

    // Sort players by total gross descending (best to worst, nulls last)
    const rows = Array.from(playerMap.values()).sort(
      (a, b) => (b.totalGross ?? -Infinity) - (a.totalGross ?? -Infinity)
    );

    this.roundCols.set(cols);
    this.playerRows.set(rows);
  }

  getCell(player: PlayerRow, roundNumber: number): CellData {
    return player.cells.get(roundNumber) ?? { gross: null, apply_multiplier: null, net: null };
  }

  isAboveAvg(cell: CellData, col: RoundCol): boolean {
    return cell.gross !== null && col.avgGross !== null && cell.gross > col.avgGross;
  }

  isBelowAvg(cell: CellData, col: RoundCol): boolean {
    return cell.gross !== null && col.avgGross !== null && cell.gross < col.avgGross;
  }

  formatGross(gross: number | null): string {
    if (gross === null) return '\u2014';
    if (gross === 0) return '0';
    return gross > 0 ? `+${gross}` : `${gross}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase();
  }

  formatAvg(avg: number | null): string {
    if (avg === null) return '\u2014';
    return (avg >= 0 ? '+' : '') + avg.toFixed(1);
  }

  roundLabel(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }
}
