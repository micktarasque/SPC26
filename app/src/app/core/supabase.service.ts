import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { LeaderboardEntry, BetResult } from '../shared/models/bet-result.model';
import { Round, RoundScore } from '../shared/models/round.model';
import { User } from '../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  // ─── Leaderboard ──────────────────────────────────────────────────────────

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.client
      .from('v_leaderboard')
      .select('*');
    if (error) throw error;
    return data ?? [];
  }

  // ─── Round Scores ──────────────────────────────────────────────────────────

  async getRoundScores(): Promise<RoundScore[]> {
    const { data, error } = await this.client
      .from('v_round_scores')
      .select('*')
      .order('round_number', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  // ─── Schedule ─────────────────────────────────────────────────────────────

  async getSchedule(): Promise<Round[]> {
    const { data, error } = await this.client
      .from('weekly_schedule')
      .select('*')
      .order('round_number', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getNextRound(): Promise<Round | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.client
      .from('weekly_schedule')
      .select('*')
      .gte('round_date', today)
      .order('round_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async getUsers(): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async addUser(name: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .insert({ name });
    if (error) throw error;
  }

  async setUserActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from('users')
      .update({ active })
      .eq('id', id);
    if (error) throw error;
  }

  // ─── Bet Results ──────────────────────────────────────────────────────────

  async getBetResults(scheduleId?: string): Promise<BetResult[]> {
    let query = this.client.from('bet_results').select('*');
    if (scheduleId) query = query.eq('schedule_id', scheduleId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async upsertBetResult(result: {
    user_id: string;
    schedule_id: string;
    gross: number;
    apply_multiplier: boolean;
  }): Promise<void> {
    const { error } = await this.client
      .from('bet_results')
      .upsert(result, { onConflict: 'user_id,schedule_id' });
    if (error) throw error;
  }

  async updateRound(id: string, updates: Partial<Pick<Round, 'sport' | 'special_event' | 'bonus_pct'>>): Promise<void> {
    const { error } = await this.client
      .from('weekly_schedule')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async deleteBetResult(userId: string, scheduleId: string): Promise<void> {
    const { error } = await this.client
      .from('bet_results')
      .delete()
      .eq('user_id', userId)
      .eq('schedule_id', scheduleId);
    if (error) throw error;
  }
}
