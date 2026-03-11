import { Component, OnInit, signal, computed } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

const COLORS = [
  '#00F5FF', '#FF00A8', '#39FF14', '#FFD700',
  '#FF6B35', '#A855F7', '#FB923C', '#F472B6',
];

const TOTAL = 28;

// ── Main chart SVG constants ──────────────────────────────────────────────────
const VBW = 1120, VBH = 460;
const PL = 70, PR = 24, PT = 44, PB = 56;
const CW = VBW - PL - PR;   // 1026
const CH = VBH - PT - PB;   // 360

// ── Team chart SVG constants ──────────────────────────────────────────────────
const TM_VBW = 1120, TM_VBH = 300;
const TM_PL = 70, TM_PR = 24, TM_PT = 40, TM_PB = 50;
const TM_CW = TM_VBW - TM_PL - TM_PR;   // 1026
const TM_CH = TM_VBH - TM_PT - TM_PB;   // 210

interface PSeries {
  uid:        string;
  name:       string;
  color:      string;
  round:      (number | null)[];   // [0..27] net per round
  grossRound: (number | null)[];   // [0..27] gross per round (for team tracker)
  cum:        (number | null)[];   // [0..27] cumulative net
  pred:       number[];            // [0..27] predicted cumulative
  last:       number;              // 0-indexed last played round (-1 if none)
}

interface Bar       { key: string; x: number; y: number; w: number; h: number; color: string; tip: string }
interface Line      { key: string; d: string; color: string; dash: boolean; op: number }
interface Tick      { y: number; label: string }
interface XLbl      { x: number; label: string }
interface ChartData { bars: Bar[]; lines: Line[]; yTicks: Tick[]; xLabels: XLbl[]; y0: number }

interface TeamChartData {
  actualPath:      string;
  breakevenPath:   string;
  fillPath:        string;
  yTicks:          { y: number; label: string }[];
  xLabels:         { x: number; label: string }[];
  y0:              number;
  lastCum:         number;
  totalInvestment: number;
  currentBreakeven: number;
  surplus:         number;
  lastPlayed:      number;
  isAhead:         boolean;
  pctRecovered:    number;
}

@Component({
  selector: 'app-chart',
  imports: [],
  templateUrl: './chart.html',
  styleUrl:    './chart.scss',
})
export class Chart implements OnInit {
  // Main chart template constants
  readonly VB      = `0 0 ${VBW} ${VBH}`;
  readonly CHARTX  = PL;
  readonly CHARTY  = PT;
  readonly CW      = CW;
  readonly CH      = CH;
  readonly TOTAL   = TOTAL;

  // Team chart template constants
  readonly TVB     = `0 0 ${TM_VBW} ${TM_VBH}`;
  readonly TMCHARTX = TM_PL;
  readonly TMCHARTY = TM_PT;
  readonly TMCW    = TM_CW;
  readonly TMCH    = TM_CH;

  readonly INVESTMENT_PER_PLAYER = 300;

  loading  = signal(true);
  error    = signal<string | null>(null);
  series   = signal<PSeries[]>([]);
  hidden   = signal<Set<string>>(new Set());
  showPred = signal(true);

  // Stored after load so computed() can read them reactively
  private minV = signal(0);
  private maxV = signal(0);

  // ── Main chart ──────────────────────────────────────────────────────────────
  chart = computed<ChartData | null>(() => {
    const all  = this.series();
    const hide = this.hidden();
    const pred = this.showPred();
    const minV = this.minV();
    const maxV = this.maxV();
    if (!all.length) return null;

    const visible = all.filter(s => !hide.has(s.uid));
    const N = Math.max(1, visible.length);
    const slotW = CW / TOTAL;
    const barW  = Math.max(2, Math.min(9, Math.floor((slotW - 5) / N)));
    const gap   = 1;
    const groupW = N * barW + (N - 1) * gap;
    const range = maxV - minV || 1;
    const yS = (v: number) => PT + CH - ((v - minV) / range) * CH;
    const xS = (r: number) => PL + ((r - 0.5) / TOTAL) * CW;  // r is 1-indexed
    const y0 = yS(0);

    // ── Bars ──────────────────────────────────────────────────────────────────
    const bars: Bar[] = [];
    for (let ri = 0; ri < TOTAL; ri++) {
      const r  = ri + 1;
      const cx = xS(r);
      const gx = cx - groupW / 2;
      visible.forEach((ps, idx) => {
        const score = ps.round[ri];
        if (score === null) return;
        const y1 = yS(score);
        bars.push({
          key:   `${ps.uid}-${r}`,
          x:     Math.round(gx + idx * (barW + gap)),
          y:     Math.min(y0, y1),
          w:     barW,
          h:     Math.max(2, Math.abs(y1 - y0)),
          color: ps.color,
          tip:   `${ps.name}  R${r}: ${score >= 0 ? '+' : ''}${score}`,
        });
      });
    }

    // ── Lines: predictions first, then actuals on top ──────────────────────
    const lines: Line[] = [];

    for (const ps of all) {
      if (hide.has(ps.uid)) continue;
      // Prediction (dashed)
      if (pred) {
        const pp: string[] = [];
        const start = Math.max(0, ps.last);
        for (let i = start; i < TOTAL; i++) {
          pp.push(`${pp.length ? 'L' : 'M'}${xS(i + 1).toFixed(1)},${yS(ps.pred[i]).toFixed(1)}`);
        }
        if (pp.length > 1) {
          lines.push({ key: `p-${ps.uid}`, d: pp.join(' '), color: ps.color, dash: true, op: 0.40 });
        }
      }
      // Actual cumulative (solid)
      const ap: string[] = [];
      for (let i = 0; i <= ps.last; i++) {
        if (ps.cum[i] !== null) {
          ap.push(`${ap.length ? 'L' : 'M'}${xS(i + 1).toFixed(1)},${yS(ps.cum[i] as number).toFixed(1)}`);
        }
      }
      if (ap.length) {
        lines.push({ key: `a-${ps.uid}`, d: ap.join(' '), color: ps.color, dash: false, op: 0.9 });
      }
    }

    // ── Y ticks ───────────────────────────────────────────────────────────────
    const step = this.niceStep((maxV - minV) / 6);
    const yTicks: Tick[] = [];
    for (let v = Math.ceil(minV / step) * step; v <= maxV + 0.001; v += step) {
      yTicks.push({ y: yS(v), label: (v > 0 ? '+' : '') + Math.round(v) });
    }

    // ── X labels (every 4th round) ────────────────────────────────────────────
    const xLabels: XLbl[] = [];
    for (let r = 1; r <= TOTAL; r++) {
      if (r === 1 || r % 4 === 0) xLabels.push({ x: xS(r), label: `R${r}` });
    }

    return { bars, lines, yTicks, xLabels, y0 };
  });

  // ── Team investment tracker ─────────────────────────────────────────────────
  teamChart = computed<TeamChartData | null>(() => {
    const all = this.series();
    if (!all.length) return null;

    const totalInvestment = all.length * this.INVESTMENT_PER_PLAYER;

    // Accumulate per-round team gross (sum across all players who have a score that round)
    const actualPts: { round: number; cum: number }[] = [];
    let teamCum = 0;
    for (let ri = 0; ri < TOTAL; ri++) {
      let roundTotal: number | null = null;
      for (const ps of all) {
        if (ps.grossRound[ri] !== null) {
          roundTotal = (roundTotal ?? 0) + ps.grossRound[ri]!;
        }
      }
      if (roundTotal !== null) {
        teamCum += roundTotal;
        actualPts.push({ round: ri + 1, cum: Math.round(teamCum * 10) / 10 });
      }
    }
    if (!actualPts.length) return null;

    const lastPlayed = actualPts[actualPts.length - 1].round;
    const currentBreakeven = Math.round(((lastPlayed / TOTAL) * totalInvestment) * 10) / 10;
    const surplus = Math.round((teamCum - currentBreakeven) * 10) / 10;

    // Y scale: cover [0..totalInvestment] plus actual range with headroom
    const cumValues = actualPts.map(p => p.cum);
    const yMinRaw = Math.min(0, ...cumValues);
    const yMaxRaw = Math.max(totalInvestment, ...cumValues);
    const span    = yMaxRaw - yMinRaw || 100;
    const yMin    = yMinRaw - span * 0.10;
    const yMax    = yMaxRaw + span * 0.10;
    const yRange  = yMax - yMin;

    const yS = (v: number) => TM_PT + TM_CH - ((v - yMin) / yRange) * TM_CH;
    const xS = (r: number) => TM_PL + ((r - 0.5) / TOTAL) * TM_CW;

    // Paths
    const actualPath = actualPts
      .map((p, i) => `${i ? 'L' : 'M'}${xS(p.round).toFixed(1)},${yS(p.cum).toFixed(1)}`)
      .join(' ');

    const breakevenPath = Array.from({ length: TOTAL }, (_, i) => {
      const r  = i + 1;
      const bv = (r / TOTAL) * totalInvestment;
      return `${i ? 'L' : 'M'}${xS(r).toFixed(1)},${yS(bv).toFixed(1)}`;
    }).join(' ');

    // Fill polygon: forward along actual, backward along breakeven at same x positions
    const forward  = actualPts.map((p, i) => `${i ? 'L' : 'M'}${xS(p.round).toFixed(1)},${yS(p.cum).toFixed(1)}`).join(' ');
    const backward = [...actualPts].reverse()
      .map(p => `L${xS(p.round).toFixed(1)},${yS((p.round / TOTAL) * totalInvestment).toFixed(1)}`)
      .join(' ');
    const fillPath = `${forward} ${backward} Z`;

    // Y ticks
    const step = this.niceStep((yMax - yMin) / 5);
    const yTicks: { y: number; label: string }[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 0.001; v += step) {
      yTicks.push({ y: yS(v), label: `$${Math.round(v)}` });
    }

    // X labels
    const xLabels: { x: number; label: string }[] = [];
    for (let r = 1; r <= TOTAL; r++) {
      if (r === 1 || r % 4 === 0) xLabels.push({ x: xS(r), label: `R${r}` });
    }

    return {
      actualPath,
      breakevenPath,
      fillPath,
      yTicks,
      xLabels,
      y0: yS(0),
      lastCum: teamCum,
      totalInvestment,
      currentBreakeven,
      surplus,
      lastPlayed,
      isAhead:      surplus >= 0,
      pctRecovered: Math.round((teamCum / totalInvestment) * 100),
    };
  });

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const [lb, rs] = await Promise.all([
        this.db.getLeaderboard(),
        this.db.getRoundScores(),
      ]);

      const built: PSeries[] = lb.map((entry, i) => {
        // Net per round (for main chart bars/lines)
        const netMap   = new Map<number, number>();
        // Gross per round (for team investment tracker)
        const grossMap = new Map<number, number>();

        for (const s of rs) {
          if (s.user_id === entry.user_id) {
            if (s.net   !== null) netMap.set(s.round_number,   s.net   as number);
            if (s.gross !== null) grossMap.set(s.round_number, s.gross as number);
          }
        }

        const roundArr: (number | null)[]      = Array(TOTAL).fill(null);
        const grossRoundArr: (number | null)[] = Array(TOTAL).fill(null);
        for (let rn = 1; rn <= TOTAL; rn++) {
          if (netMap.has(rn))   roundArr[rn - 1]      = netMap.get(rn)!;
          if (grossMap.has(rn)) grossRoundArr[rn - 1] = grossMap.get(rn)!;
        }

        const cumArr: (number | null)[] = Array(TOTAL).fill(null);
        let cum = 0, last = -1;
        for (let i = 0; i < TOTAL; i++) {
          if (roundArr[i] !== null) {
            cum += roundArr[i] as number;
            cumArr[i] = Math.round(cum * 10) / 10;
            last = i;
          }
        }

        return {
          uid:        entry.user_id,
          name:       entry.name,
          color:      COLORS[i % COLORS.length],
          round:      roundArr,
          grossRound: grossRoundArr,
          cum:        cumArr,
          pred:       [],
          last,
        };
      });

      built.forEach((s, i) => { s.pred = this.predict(s, i); });

      // Compute Y range across all values
      const vals: number[] = [0];
      for (const s of built) {
        s.round.forEach(v => { if (v !== null) vals.push(v); });
        s.cum.forEach(v =>   { if (v !== null) vals.push(v); });
        s.pred.forEach(v =>  vals.push(v));
      }
      const span = Math.max(...vals) - Math.min(...vals) || 20;
      this.minV.set(Math.min(...vals) - span * 0.10);
      this.maxV.set(Math.max(...vals) + span * 0.10);

      this.series.set(built);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load chart data');
    } finally {
      this.loading.set(false);
    }
  }

  private predict(s: PSeries, idx: number): number[] {
    const result = new Array<number>(TOTAL).fill(0);
    // Fill actuals up to last played round
    for (let i = 0; i <= s.last; i++) {
      result[i] = (s.cum[i] ?? (i > 0 ? result[i - 1] : 0));
    }

    // 😂 Special prediction for Michael Dolton — flatlines just above zero all season
    if (s.name.toLowerCase().includes('dolton')) {
      let cum = s.last >= 0 ? (s.cum[s.last] ?? 0) : 0;
      for (let i = Math.max(0, s.last + 1); i < TOTAL; i++) {
        cum = cum * 0.88 + 0.5 * 0.12 + Math.sin(i * 1.1) * 0.3;
        result[i] = Math.round(cum * 10) / 10;
      }
      return result;
    }

    const played = s.round.filter(v => v !== null) as number[];
    const avg    = played.length ? played.reduce((a, b) => a + b, 0) / played.length : 0;
    // 90% trend + 10% variability: noise amplitude ≈ 12% of |avg|, minimum 1.0
    const noiseAmp = Math.max(1.0, Math.abs(avg) * 0.12);
    const phase = idx * 1.618;          // golden ratio offset keeps players distinct
    const freq  = 0.20 + idx * 0.09;   // different oscillation per player

    let cum = s.last >= 0 ? (s.cum[s.last] ?? 0) : 0;
    for (let i = Math.max(0, s.last + 1); i < TOTAL; i++) {
      const noise = (
        Math.sin((i + 1) * freq + phase)        * 0.7 +
        Math.sin((i + 1) * freq * 1.9 + phase * 1.7) * 0.3
      ) * noiseAmp;
      cum += avg + noise;
      result[i] = Math.round(cum * 10) / 10;
    }
    return result;
  }

  private niceStep(raw: number): number {
    const mag  = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
    const norm = raw / mag;
    const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return nice * mag;
  }

  toggleHide(uid: string) {
    this.hidden.update(s => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  }

  togglePred() { this.showPred.update(v => !v); }

  isHidden(uid: string): boolean { return this.hidden().has(uid); }

  formatSurplus(tc: TeamChartData): string {
    const sign = tc.isAhead ? '+' : '-';
    return `${sign}$${Math.abs(tc.surplus)}`;
  }
}
