import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  session = signal<Session | null>(null);
  /** Resolves once the initial session check completes — await in guards to avoid race conditions. */
  readonly sessionReady: Promise<void>;

  constructor(private supabase: SupabaseService) {
    this.sessionReady = this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  get isAuthenticated(): boolean {
    return !!this.session();
  }

  async signIn(email: string, password: string) {
    return this.supabase.client.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.client.auth.signOut();
  }
}
