export type AchievementRarity   = 'common' | 'uncommon' | 'rare' | 'legendary';
export type AchievementCategory = 'GLORY' | 'SKILL' | 'STREAK' | 'STRATEGY' | 'COMMITMENT' | 'BANTER';

export interface AchievementDef {
  id:       string;
  icon:     string;
  name:     string;
  desc:     string;
  category: AchievementCategory;
  rarity:   AchievementRarity;
}

export interface AchievementStats {
  rank:             number;
  totalPlayers:     number;
  win_rate:         number | null;
  total_net:        number | null;
  total_bets:       number;
  missed_rounds:    number;   // roundsElapsed - total_bets
  roundsElapsed:    number;   // highest round with any entered score
  totalRounds:      number;
  streak:           number;
  streak_type:      'win' | 'loss';
  maxWinStreak:     number;
  maxLossStreak:    number;
  multiplier_count: number;
  best_round:       number | null;
  worst_round:      number | null;
  compBestRound:    number | null;
  compWorstRound:   number | null;
  slumpBuster:      boolean;
}

export function checkAchievement(id: string, s: AchievementStats): boolean {
  switch (id) {
    case 'champion':       return s.rank === 1;
    case 'podium':         return s.rank <= 3;
    case 'sharpshooter':   return (s.win_rate ?? 0) >= 70 && s.total_bets >= 5;
    case 'big_winner':     return s.best_round !== null && s.compBestRound !== null
                               && s.best_round >= s.compBestRound;
    case 'hat_trick':      return s.maxWinStreak >= 3;
    case 'on_fire':        return s.maxWinStreak >= 4;
    case 'inferno':        return s.maxWinStreak >= 6;
    case 'bonus_hunter':   return s.multiplier_count >= 3;
    case 'all_in':         return s.multiplier_count >= 5;
    case 'iron_man':       return s.missed_rounds === 0 && s.roundsElapsed >= 5;
    case 'committed':      return s.total_bets >= 20;
    case 'participation':  return s.total_bets >= 1;
    case 'wooden_spoon':   return s.rank === s.totalPlayers && s.totalPlayers > 1;
    case 'ice_cold':       return s.maxLossStreak >= 4;
    case 'the_ghost':      return s.missed_rounds >= 6;
    case 'always_hopeful': return (s.win_rate ?? 100) < 35 && s.total_bets >= 5;
    case 'crater':         return s.worst_round !== null && s.compWorstRound !== null
                               && s.worst_round <= s.compWorstRound;
    case 'slump_buster':   return s.slumpBuster;
    default:               return false;
  }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── GLORY ──────────────────────────────────────────────────────────────────
  { id: 'champion',      icon: '👑', name: 'THE CHAMPION',    category: 'GLORY',      rarity: 'legendary', desc: 'Lead the leaderboard — the best in the comp'             },
  { id: 'podium',        icon: '🏅', name: 'PODIUM FINISH',   category: 'GLORY',      rarity: 'rare',      desc: 'Sit in the top 3 on the leaderboard'                     },
  // ── SKILL ──────────────────────────────────────────────────────────────────
  { id: 'sharpshooter',  icon: '🎯', name: 'SHARPSHOOTER',   category: 'SKILL',      rarity: 'rare',      desc: 'Maintain a 70% or higher win rate'                       },
  { id: 'big_winner',    icon: '💰', name: 'HIGH ROLLER',     category: 'SKILL',      rarity: 'rare',      desc: 'Record the best single-round result in the entire comp'  },
  // ── STREAK ─────────────────────────────────────────────────────────────────
  { id: 'hat_trick',     icon: '⭐', name: 'HAT TRICK',       category: 'STREAK',     rarity: 'common',    desc: 'Win 3 rounds in a row at any point in the season'        },
  { id: 'on_fire',       icon: '🔥', name: 'ON FIRE',         category: 'STREAK',     rarity: 'uncommon',  desc: 'Win 4 rounds in a row at any point in the season'        },
  { id: 'inferno',       icon: '💥', name: 'INFERNO',         category: 'STREAK',     rarity: 'legendary', desc: 'Win 6 rounds in a row — certified absolute unit'         },
  // ── STRATEGY ───────────────────────────────────────────────────────────────
  { id: 'bonus_hunter',  icon: '⚡', name: 'BONUS HUNTER',   category: 'STRATEGY',   rarity: 'uncommon',  desc: 'Activate the round multiplier 3 or more times'           },
  { id: 'all_in',        icon: '🎰', name: 'ALL IN',          category: 'STRATEGY',   rarity: 'rare',      desc: 'Activate the round multiplier 5+ times — no fear'       },
  // ── COMMITMENT ─────────────────────────────────────────────────────────────
  { id: 'participation', icon: '🌈', name: 'SHOWING UP',      category: 'COMMITMENT', rarity: 'common',    desc: 'Play at least 1 round — you showed up, that counts'     },
  { id: 'committed',     icon: '💪', name: 'COMMITTED',       category: 'COMMITMENT', rarity: 'common',    desc: 'Play 20 or more rounds this season'                      },
  { id: 'iron_man',      icon: '🦾', name: 'IRON MAN',        category: 'COMMITMENT', rarity: 'rare',      desc: 'Play every single round without missing one'             },
  // ── BANTER ─────────────────────────────────────────────────────────────────
  { id: 'wooden_spoon',  icon: '🪵', name: 'WOODEN SPOON',   category: 'BANTER',     rarity: 'uncommon',  desc: 'Prop up the leaderboard in last place'                   },
  { id: 'ice_cold',      icon: '❄️', name: 'ICE COLD',       category: 'BANTER',     rarity: 'common',    desc: 'Lose 4 or more rounds in a row at any point'             },
  { id: 'the_ghost',     icon: '👻', name: 'THE GHOST',       category: 'BANTER',     rarity: 'uncommon',  desc: 'Miss 6 or more rounds this season'                       },
  { id: 'always_hopeful',icon: '😬', name: 'ALWAYS HOPEFUL', category: 'BANTER',     rarity: 'common',    desc: 'Under 35% win rate but keep turning up — respect'        },
  { id: 'crater',        icon: '💀', name: 'CRATER',          category: 'BANTER',     rarity: 'uncommon',  desc: 'Record the worst single round in the entire competition' },
  { id: 'slump_buster',  icon: '📈', name: 'SLUMP BUSTER',   category: 'BANTER',     rarity: 'rare',      desc: 'End a 3+ loss streak with back-to-back wins'             },
];

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'GLORY', 'SKILL', 'STREAK', 'STRATEGY', 'COMMITMENT', 'BANTER',
];

export const RARITY_COLOR: Record<AchievementRarity, string> = {
  legendary: '#FFD700',
  rare:      '#00F5FF',
  uncommon:  '#A855F7',
  common:    '#8B7AAD',
};

export const RARITY_LABEL: Record<AchievementRarity, string> = {
  legendary: 'LEGENDARY',
  rare:      'RARE',
  uncommon:  'UNCOMMON',
  common:    'COMMON',
};
