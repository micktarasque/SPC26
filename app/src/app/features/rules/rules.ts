import { Component } from '@angular/core';

export interface RuleSection {
  title: string;
  icon: string;
  rules: string[];
}

@Component({
  selector: 'app-rules',
  imports: [],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
})
export class Rules {
  readonly sections: RuleSection[] = [
    {
      title: 'THE COMPETITION',
      icon: '🏆',
      rules: [
        'Season runs 28 March – 3 October 2026 across 28 weekly rounds.',
        'Each player contributes $300 for the season (~$10–$15 per round).',
        'Most cumulative net points at the end of the season wins.',
        'Players must be active (enrolled by admin) to appear on the leaderboard.',
      ],
    },
    {
      title: 'THE WHEEL',
      icon: '🎡',
      rules: [
        'Each week, admin spins the Wheel Spinner to reveal the sport and multiplier.',
        'The wheel has 10 sport slices, each with a multiplier between ×1.0 and ×3.0.',
        'The sport result is posted to the group before the round opens.',
        'Sports can include: AFL, NRL, Horse Racing, Cricket, Soccer, Tennis, Golf, Basketball, Boxing, Rugby Union.',
      ],
    },
    {
      title: 'PLACING BETS',
      icon: '💸',
      rules: [
        'Bet on the designated sport for that round only.',
        'You must place your bet before the round\'s event starts.',
        'Missing a round scores zero gross for that round — no result entered.',
        'Admin enters gross return results into the system after each round closes.',
      ],
    },
    {
      title: 'THE MULTIPLIER',
      icon: '⚡',
      rules: [
        'Each round has a multiplier (×1.0–×3.0) set by the wheel spin.',
        'You can opt in to activate the multiplier on your bet for that round.',
        'Net = Gross × Multiplier (if activated), or just Gross (if not).',
        'Activating the multiplier amplifies both wins AND losses — use wisely.',
        'The multiplier toggle (ON/OFF) is set by admin when entering your result.',
      ],
    },
    {
      title: 'SCORING',
      icon: '📊',
      rules: [
        'Gross = raw return from your bet (positive = profit, negative = loss, zero = no return).',
        'Net = your gross adjusted by the round multiplier if activated.',
        'Cumulative net across all rounds determines your leaderboard position.',
        'A null result means no bet was placed or scores haven\'t been entered yet — it does not count as zero.',
        'Streaks, win rates, and achievements are calculated from entered results only.',
      ],
    },
    {
      title: 'ACHIEVEMENTS',
      icon: '🎖️',
      rules: [
        'Achievements unlock automatically based on your real-time stats.',
        'There are 18 achievements across 6 categories: Glory, Skill, Streak, Strategy, Commitment, and Banter.',
        'Achievements are displayed on your player card and on the Achievements page.',
        'Some achievements are extremely rare — brag rights fully earned.',
      ],
    },
  ];
}
