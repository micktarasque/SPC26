import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase.service';
import { User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  saving = signal(false);
  addError = signal<string | null>(null);

  users = signal<User[]>([]);
  newName = signal('');
  togglingId = signal<string | null>(null);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  private async loadUsers() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const users = await this.db.getUsers();
      this.users.set(users);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load players');
    } finally {
      this.loading.set(false);
    }
  }

  async addUser() {
    const name = this.newName().trim();
    if (!name) return;
    this.saving.set(true);
    this.addError.set(null);
    try {
      await this.db.addUser(name);
      this.newName.set('');
      await this.loadUsers();
    } catch (e: any) {
      this.addError.set(e?.message ?? 'Failed to add player');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(user: User) {
    this.togglingId.set(user.id);
    try {
      await this.db.setUserActive(user.id, !user.active);
      await this.loadUsers();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to update player');
    } finally {
      this.togglingId.set(null);
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.addUser();
  }
}
