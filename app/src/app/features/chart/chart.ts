import { Component, OnInit, signal, computed } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

const COLORS = [
  '#00F5FF', '#FF00A8', '#39FF14', '#FFD700',
  '#FF6B35', '#A855F7', '#FB923C', '#F472B6',
];

const TOTAL = 28;

// SVG viewport constants
const VBW = 1120, VBH = 460;
const PL = 70, PR = 24, PT = 44, PB = 56;
const CW = VBW - PL - PR;   // 1026
const CH = VBH - PT - PB;   // 360

interface PSeries {
  uid:   string;
  name:  string;
  color: string;
  round: (number | null)[];  // [0..27] net per round
  cum:   (number | null)[];  // [0..27] cumulative net
  pred:  number[];           // [0..27] predicted cumulative
  last:  number;             // 0-indexed last played round (-1 if none)
}

interface Bar  { key: string; x: number; y: number; w: number; h: number; color: string; tip: string }
interface Line { key: string; d: string; color: string; dash: boolean; op: number }
interface Tick { y: number; label: string }
interface XLbl { x: number; label: string }
interface ChartData { bars: Bar[]; lines: Line[]; yTicks: Tick[]; xLabels: XLbl[]; y0: number }

@Component({
  selector: 'app-chart',
  imports: [],
  templateUrl: './chart.html',
  styleUrl:    './chart.scss',
})
export class Chart implements OnInit {
  readonly VB    = `0 0 ${VBW} ${VBH}`;
  readonly CHARTX = PL;
  readonly CHARTY = PT;
  readonly CW    = CW;
  readonly CH    = CH;
  readonly TOTAL = TOTAL;

  loading  = signal(true);
  error    = signal<string | null>(null);
  series   = signal<PSeries[]>([]);
  hidden   = signal<Set<string>>(new Set());
  showPred = signal(true);

  // Stored after load so computed() can read them reactively
  private minV = signal(0);
  private maxV = signal(0);

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

    // ── Bars ─────────────────────────────────────────────────────
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

    // ── Lines ────────────────────────────────────────────────────
    // Draw predictions first so actual lines render on top
    const lines: Line[] = [];

    for (const ps of all) {
      if (hide.has(ps.uid)) continue;
      // Prediction (dashed) drawn first
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

    // ── Y ticks ──────────────────────────────────────────────────
    const step = this.niceStep((maxV - minV) / 6);
    const yTicks: Tick[] = [];
    for (let v = Math.ceil(minV / step) * step; v <= maxV + 0.001; v += step) {
      yTicks.push({ y: yS(v), label: (v > 0 ? '+' : '') + Math.round(v) });
    }

    // ── X labels (every other round) ────────────────────────────
    const xLabels: XLbl[] = [];
    for (let r = 1; r <= TOTAL; r++) {
      if (r === 1 || r % 4 === 0) xLabels.push({ x: xS(r), label: `R${r}` });
    }

    return { bars, lines, yTicks, xLabels, y0 };
  });

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      const [lb, rs] = await Promise.all([
        this.db.getLeaderboard(),
        this.db.getRoundScores(),
      ]);

      const built: PSeries[] = lb.map((entry, i) => {
        const rMap = new Map<number, number>();
        for (const s of rs) {
          if (s.user_id === entry.user_id && s.net !== null) {
            rMap.set(s.round_number, s.net as number);
          }
        }

        const roundArr: (number | null)[] = Array(TOTAL).fill(null);
        for (const [rn, net] of rMap) {
          if (rn >= 1 && rn <= TOTAL) roundArr[rn - 1] = net;
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
          uid: entry.user_id,
          name: entry.name,
          color: COLORS[i % COLORS.length],
          round: roundArr,
          cum: cumArr,
          pred: [],
          last,
        };
      });

      built.forEach((s, i) => { s.pred = this.predict(s, i); });

      // Compute Y range across all values
      const vals: number[] = [0];
      for (const s of built) {
        s.round.forEach(v => { if (v !== null) vals.push(v); });
        s.cum.forEach(v => { if (v !== null) vals.push(v); });
        s.pred.forEach(v => vals.push(v));
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
    // Fill actuals
    for (let i = 0; i <= s.last; i++) {
      result[i] = (s.cum[i] ?? (i > 0 ? result[i - 1] : 0));
    }

    // 😂 Special prediction for Michael Dolton — flatlines just above zero all season
    if (s.name.toLowerCase().includes('dolton')) {
      let cum = s.last >= 0 ? (s.cum[s.last] ?? 0) : 0;
      for (let i = Math.max(0, s.last + 1); i < TOTAL; i++) {
        // Slowly decay toward +1 (barely above axis) with tiny wobble
        cum = cum * 0.88 + 0.5 * 0.12 + Math.sin(i * 1.1) * 0.3;
        result[i] = Math.round(cum * 10) / 10;
      }
      return result;
    }

    const played = s.round.filter(v => v !== null) as number[];
    const avg = played.length ? played.reduce((a, b) => a + b, 0) / played.length : 0;
    const amp = Math.max(4, Math.abs(avg) * 1.4 + 5);
    const phase = idx * 1.618;        // golden ratio offset keeps players distinct
    const freq  = 0.20 + idx * 0.09; // different oscillation per player

    // Extrapolate
    let cum = s.last >= 0 ? (s.cum[s.last] ?? 0) : 0;
    for (let i = Math.max(0, s.last + 1); i < TOTAL; i++) {
      const noise = Math.sin((i + 1) * freq + phase) * amp
                  + Math.sin((i + 1) * freq * 2.3 + phase * 1.5) * amp * 0.4;
      cum += avg * 0.75 + noise;
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
}
