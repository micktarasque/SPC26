export interface Round {
  id: string;
  round_number: number;
  round_date: string;
  sport: string | null;
  special_event: string | null;
  bet_amount_pct: number;
  bonus_pct: number;
}

export interface RoundScore {
  user_id: string;
  name: string;
  schedule_id: string;
  round_number: number;
  round_date: string;
  sport: string | null;
  special_event: string | null;
  bonus_pct: number;
  bet_amount_pct: number;
  gross: number | null;
  apply_multiplier: boolean | null;
  net: number | null;
}
