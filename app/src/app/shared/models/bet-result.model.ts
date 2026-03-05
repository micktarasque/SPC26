export interface BetResult {
  id: string;
  user_id: string;
  schedule_id: string;
  gross: number;
  apply_multiplier: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  total_bets: number;
  total_gross: number | null;
  total_net: number | null;
}
