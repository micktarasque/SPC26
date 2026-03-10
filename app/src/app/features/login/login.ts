import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/admin/bets']);
    }
  }

  async onSubmit() {
    this.error.set(null);
    this.loading.set(true);
    try {
      const { error } = await this.auth.signIn(this.email, this.password);
      if (error) {
        this.error.set(error.message);
      } else {
        this.router.navigate(['/admin/bets']);
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Login failed');
    } finally {
      this.loading.set(false);
    }
  }
}
