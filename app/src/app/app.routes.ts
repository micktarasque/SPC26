import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/leaderboard/leaderboard').then(m => m.Leaderboard)
  },
  {
    path: 'entry',
    loadComponent: () => import('./features/entry/entry').then(m => m.Entry)
  },
  {
    path: 'schedule',
    loadComponent: () => import('./features/schedule/schedule').then(m => m.Schedule)
  },
  {
    path: 'wheel',
    loadComponent: () => import('./features/wheel/wheel').then(m => m.Wheel)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
