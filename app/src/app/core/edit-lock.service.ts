import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Lightweight client-side gate for editing actions (score entry + wheel saves).
 * This is a convenience speed-bump, NOT real security — anyone can read the PIN
 * from the bundle. Write protection at the data layer is enforced by Supabase RLS.
 */
@Injectable({ providedIn: 'root' })
export class EditLockService {
  private readonly STORAGE_KEY = 'spc26_edit_unlocked';

  readonly unlocked = signal<boolean>(
    sessionStorage.getItem(this.STORAGE_KEY) === '1'
  );

  /** Returns true if editing is allowed; otherwise prompts for the PIN. */
  requireUnlock(): boolean {
    if (this.unlocked()) return true;
    const entered = window.prompt('Enter edit PIN to make changes:');
    if (entered === null) return false; // cancelled
    if (entered.trim() === environment.editPin) {
      this.setUnlocked();
      return true;
    }
    window.alert('Incorrect PIN.');
    return false;
  }

  private setUnlocked() {
    this.unlocked.set(true);
    sessionStorage.setItem(this.STORAGE_KEY, '1');
  }

  lock() {
    this.unlocked.set(false);
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}
