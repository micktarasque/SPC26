import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase.service';
import { Round } from '../../../shared/models/round.model';

const SLICE_COUNT = 10;
const SLICE_DEG   = 360 / SLICE_COUNT;  // 36°

const WHEEL_COLORS = [
  '#FF00A8', '#00F5FF', '#39FF14', '#FFD700',
  '#FF6B35', '#A855F7', '#FB923C', '#F472B6',
  '#06B6D4', '#84CC16',
];

const DEFAULT_SPORTS = [
  { sport: 'Cricket',      multiplier: 2.0 },
  { sport: 'AFL',          multiplier: 1.5 },
  { sport: 'NRL',          multiplier: 2.5 },
  { sport: 'Horse Racing', multiplier: 3.0 },
  { sport: 'Soccer',       multiplier: 1.5 },
  { sport: 'Tennis',       multiplier: 2.0 },
  { sport: 'Basketball',   multiplier: 1.5 },
  { sport: 'Golf',         multiplier: 2.5 },
  { sport: 'Boxing',       multiplier: 3.0 },
  { sport: 'Rugby Union',  multiplier: 2.0 },
];

export interface WheelSlot { sport: string; multiplier: number; color: string }

interface SliceSvg {
  path:  string;
  tx1: number; ty1: number; tf1: string;  // sport name
  tx2: number; ty2: number; tf2: string;  // multiplier
  slot:  WheelSlot;
}

function buildSlices(slots: WheelSlot[]): SliceSvg[] {
  const toRad = (d: number) => d * Math.PI / 180;
  const cx = 200, cy = 200, R = 178, R1 = 100, R2 = 148;
  return slots.map((slot, i) => {
    // Slice i is centered at the top (-90°) + i * SLICE_DEG
    const startDeg = -90 - SLICE_DEG / 2 + i * SLICE_DEG;
    const endDeg   = startDeg + SLICE_DEG;
    const midDeg   = -90 + i * SLICE_DEG;  // center of slice i

    const x1 = cx + R * Math.cos(toRad(startDeg));
    const y1 = cy + R * Math.sin(toRad(startDeg));
    const x2 = cx + R * Math.cos(toRad(endDeg));
    const y2 = cy + R * Math.sin(toRad(endDeg));
    const path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;

    // textRot = i * SLICE_DEG so the text reads horizontally when slice is at top
    const textRot = i * SLICE_DEG;
    const tx1 = cx + R1 * Math.cos(toRad(midDeg));
    const ty1 = cy + R1 * Math.sin(toRad(midDeg));
    const tx2 = cx + R2 * Math.cos(toRad(midDeg));
    const ty2 = cy + R2 * Math.sin(toRad(midDeg));
    const tf1 = `rotate(${textRot.toFixed(1)},${tx1.toFixed(1)},${ty1.toFixed(1)})`;
    const tf2 = `rotate(${textRot.toFixed(1)},${tx2.toFixed(1)},${ty2.toFixed(1)})`;

    return { path, tx1, ty1, tf1, tx2, ty2, tf2, slot };
  });
}

@Component({
  selector:    'app-wheel',
  imports:     [FormsModule],
  templateUrl: './wheel.html',
  styleUrl:    './wheel.scss',
})
export class Wheel implements OnInit {
  private readonly STORAGE_KEY = 'spc26_wheel_slots';

  loading  = signal(true);
  error    = signal<string | null>(null);

  slots  = signal<WheelSlot[]>([]);
  slices = computed(() => buildSlices(this.slots()));

  schedule    = signal<Round[]>([]);
  targetRound = signal<Round | null>(null);

  // Spin state
  spinning  = signal(false);
  wheelDeg  = signal(0);
  private deg = 0;

  result    = signal<WheelSlot | null>(null);
  shareMode = signal(false);

  // Config editing (plain array — no signal needed here)
  editMode     = signal(false);
  editSlotsArr: WheelSlot[] = [];

  // Round-save state
  savingRound = signal(false);
  roundSaved  = signal(false);
  roundError  = signal<string | null>(null);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    try {
      this.schedule.set(await this.db.getSchedule());
      const today = new Date().toISOString().split('T')[0];
      const next  = this.schedule().find(r => r.round_date >= today) ?? this.schedule()[this.schedule().length - 1];
      if (next) this.targetRound.set(next);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load schedule');
    } finally {
      this.loading.set(false);
    }

    // Load slots from localStorage or use defaults
    const saved = localStorage.getItem(this.STORAGE_KEY);
    let parsed: WheelSlot[] | null = null;
    try { parsed = saved ? JSON.parse(saved) : null; } catch {}
    this.slots.set(
      parsed && parsed.length === SLICE_COUNT
        ? parsed
        : DEFAULT_SPORTS.map((s, i) => ({ ...s, color: WHEEL_COLORS[i] }))
    );
  }

  onRoundChange(roundId: string) {
    const round = this.schedule().find(r => r.id === roundId) ?? null;
    this.targetRound.set(round);
    this.roundSaved.set(false);
    this.roundError.set(null);
  }

  spin() {
    if (this.spinning()) return;
    this.spinning.set(true);
    this.result.set(null);
    this.roundSaved.set(false);
    this.roundError.set(null);

    const targetIdx = Math.floor(Math.random() * SLICE_COUNT);
    // targetMod: rotation needed to bring slice i center to pointer (top)
    // Derived: R ≡ (360 - i * SLICE_DEG) % 360
    const targetMod  = (SLICE_COUNT - targetIdx) * SLICE_DEG % 360;
    const currentMod = ((this.deg % 360) + 360) % 360;
    const diff       = (targetMod - currentMod + 360) % 360;
    const spins      = 5 + Math.floor(Math.random() * 4);

    this.deg += spins * 360 + diff;
    this.wheelDeg.set(this.deg);

    setTimeout(() => {
      this.spinning.set(false);
      this.result.set(this.slots()[targetIdx]);
    }, 4500);
  }

  async saveToRound() {
    const round  = this.targetRound();
    const result = this.result();
    if (!round || !result) return;

    this.savingRound.set(true);
    this.roundError.set(null);
    try {
      await this.db.updateRound(round.id, {
        sport:     result.sport,
        bonus_pct: Math.round(result.multiplier * 100),
      });
      // Update local schedule so the warning badge reflects new state
      this.schedule.update(s => s.map(r => r.id === round.id
        ? { ...r, sport: result.sport, bonus_pct: Math.round(result.multiplier * 100) }
        : r
      ));
      this.targetRound.set({ ...round, sport: result.sport, bonus_pct: Math.round(result.multiplier * 100) });
      this.roundSaved.set(true);
      setTimeout(() => this.roundSaved.set(false), 3000);
    } catch (e: any) {
      this.roundError.set(e?.message ?? 'Save failed');
    } finally {
      this.savingRound.set(false);
    }
  }

  toggleShareMode() { this.shareMode.update(v => !v); }

  async tryShare() {
    const r = this.result();
    const rnd = this.targetRound();
    if (!r) return;
    const text = `🎡 THE WHEEL HAS SPOKEN!\n\nRound ${rnd?.round_number ?? '?'}: Bet on ${r.sport} this week!\n×${r.multiplier.toFixed(1)} MULTIPLIER\n\nGet your picks in 🔥`;
    if (navigator.share) {
      try { await navigator.share({ title: 'SPC26 Tip Board', text }); } catch {}
    } else {
      this.shareMode.set(true);
    }
  }

  // Config editor
  openEdit() {
    this.editSlotsArr = this.slots().map(s => ({ ...s }));
    this.editMode.set(true);
  }

  saveConfig() {
    const slots = this.editSlotsArr.map((s, i) => ({ ...s, color: WHEEL_COLORS[i] }));
    this.slots.set(slots);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(slots));
    this.editMode.set(false);
  }

  cancelEdit()   { this.editMode.set(false); }

  resetDefaults() {
    this.editSlotsArr = DEFAULT_SPORTS.map((s, i) => ({ ...s, color: WHEEL_COLORS[i] }));
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  }
}
