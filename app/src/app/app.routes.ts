import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/leaderboard/leaderboard').then(m => m.Leaderboard)
  },
  {
    path: 'rounds',
    loadComponent: () => import('./features/rounds/rounds').then(m => m.Rounds)
  },
  {
    path: 'race',
    loadComponent: () => import('./features/race/race').then(m => m.Race)
  },
  {
    path: 'players',
    loadComponent: () => import('./features/players/players').then(m => m.Players)
  },
  {
    path: 'chart',
    loadComponent: () => import('./features/chart/chart').then(m => m.Chart)
  },
  {
    path: 'achievements',
    loadComponent: () => import('./features/achievements/achievements').then(m => m.Achievements)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then(m => m.Login)
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./features/admin/users/users').then(m => m.Users),
    canActivate: [authGuard]
  },
  {
    path: 'admin/bets',
    loadComponent: () => import('./features/admin/bets/bets').then(m => m.Bets),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    redirectTo: 'admin/bets'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
