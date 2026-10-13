// GymXP game engine.
// Everything is derived from the raw log, so editing or deleting a past session
// recomputes XP, PRs, streaks and achievements consistently.
import type { AppData, Exercise, MuscleGroup, Session } from './types';
import { weekKey, addDays, today, parseDate } from './util';
import { holidayOn } from './holidays';
import { capacityFrom, emptyCapacity, HERO_IDS, HERO_TARGETS, HERO_VOLUME_WEEKS, HERO_STAGES, heroMuscle, ladderWork, scoreHero, type Capacity, type HeroMuscle, type HeroResult } from './hero';

export const RULES = {
  visitXp: 100, // first session of a calendar day
  setXp: 5, // per completed set
  volumeKgPerXp: 50, // 1 XP per 50 kg moved
  watchMinCap: 150, // 1 XP per workout minute, capped
  kcalPerXp: 10,
  kcalXpCap: 100,
  newExerciseXp: 15,
  weightPrXp: 40,
  e1rmPrXp: 25,
  weeklyGoalXp: 75,
  weighInXp: 10, // max one per week
  streakStepPct: 5, // +5% base XP per consecutive goal week…
  streakCapWeeks: 10, // …up to +50%
  rainXp: 50, // went to the gym while it was raining
  coldXp: 50, // ≤ 5 °C
  freezingXp: 50, // extra at ≤ 0 °C
  heatXp: 50, // ≥ 33 °C
  holidayXp: 100, // Argentine national holiday
};

// ---------- Levels ----------
// Total XP to reach a level grows as 650·(L−1)^1.9. Simulated at 3 solid workouts a week
// (incl. quests & seasons): 1 month ≈ level 5, 1 year ≈ 18, 3 years ≈ 32, 5 years ≈ 43.
// At ~2 a week with skipped weeks: 1 year ≈ 10, 5 years ≈ 24. Consistency is what pays.

const LEVEL_A = 650;
const LEVEL_P = 1.9;

/** Total XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.round(LEVEL_A * Math.max(0, level - 1) ** LEVEL_P);
}

export function levelForXp(xp: number): number {
  let level = Math.floor((Math.max(0, xp) / LEVEL_A) ** (1 / LEVEL_P)) + 1;
  // Guard against float rounding at exact boundaries.
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

export interface Rank {
  minLevel: number;
  minVisits: number; // ranks need XP *and* time in the gym
  title: string;
  color: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, minVisits: 0, title: 'Rookie', color: '#9aa3b2' },
  { minLevel: 2, minVisits: 3, title: 'Beginner', color: '#a3c4a8' },
  { minLevel: 4, minVisits: 10, title: 'Regular', color: '#7bd389' },
  { minLevel: 6, minVisits: 25, title: 'Committed', color: '#5fd0a0' },
  { minLevel: 8, minVisits: 40, title: 'Iron Apprentice', color: '#6fb1d6' },
  { minLevel: 10, minVisits: 60, title: 'Iron Adept', color: '#5a8dee' },
  { minLevel: 12, minVisits: 90, title: 'Bronze Lifter', color: '#cd8a4f' },
  { minLevel: 15, minVisits: 130, title: 'Silver Lifter', color: '#c7d0dc' },
  { minLevel: 18, minVisits: 180, title: 'Gold Lifter', color: '#f5c542' },
  { minLevel: 22, minVisits: 250, title: 'Platinum Lifter', color: '#7fe0d6' },
  { minLevel: 26, minVisits: 330, title: 'Diamond Lifter', color: '#8fd3ff' },
  { minLevel: 31, minVisits: 420, title: 'Athlete', color: '#9fe870' },
  { minLevel: 36, minVisits: 520, title: 'Elite', color: '#b388ff' },
  { minLevel: 41, minVisits: 640, title: 'Master', color: '#d17bff' },
  { minLevel: 47, minVisits: 780, title: 'Grandmaster', color: '#ff7ad9' },
  { minLevel: 53, minVisits: 900, title: 'Titan', color: '#ff7a59' },
  { minLevel: 60, minVisits: 1050, title: 'Olympian', color: '#ffd166' },
];

export function rankFor(level: number, visits: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.minLevel && visits >= x.minVisits) r = x;
  return r;
}

// Each rank is split into 4 divisions (★☆☆☆ → ★★★★), like League of Legends' IV→I /
// Rocket League's divisions. Progress through a rank is the SLOWER of your XP progress
// and your gym-visit progress toward the next rank, so stars can't be farmed with XP alone.
// Past Olympian (the top) you keep earning "service stars" (Battlefield-style): one per 2 levels.
export const DIVISIONS = 4;
const OLYMPIAN_LEVELS_PER_STAR = 2;

export interface LevelInfo {
  level: number;
  xp: number;
  into: number; // XP earned inside current level
  span: number; // XP size of current level
  pct: number;
  rank: Rank;
  nextRank?: Rank;
  /** 1..3 inside a normal rank; for the top rank: number of service stars earned (0+). */
  division: number;
  /** 0..1 progress through the whole rank (toward the next rank). */
  rankPct: number;
  /** 0..100 "rank points" toward the next division / star. */
  rp: number;
  /** Which requirement is holding the rank back right now. */
  limiter: 'xp' | 'visits' | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function levelInfo(xp: number, visits: number): LevelInfo {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const span = xpForLevel(level + 1) - base;
  const into = xp - base;
  const rank = rankFor(level, visits);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  let division: number, rankPct: number, rp: number, limiter: LevelInfo['limiter'] = null;
  if (nextRank) {
    const xpFrom = xpForLevel(rank.minLevel), xpTo = xpForLevel(nextRank.minLevel);
    const xpProg = clamp01((xp - xpFrom) / (xpTo - xpFrom));
    const visitProg = clamp01((visits - rank.minVisits) / (nextRank.minVisits - rank.minVisits));
    rankPct = Math.min(xpProg, visitProg);
    limiter = xpProg < visitProg ? 'xp' : 'visits';
    const d = Math.min(DIVISIONS - 1e-9, rankPct * DIVISIONS);
    division = Math.floor(d) + 1;
    rp = Math.floor((d - Math.floor(d)) * 100);
  } else {
    // Top rank: endless service stars
    const over = Math.max(0, level - rank.minLevel) + into / (span || 1);
    division = Math.floor(over / OLYMPIAN_LEVELS_PER_STAR);
    rankPct = 1;
    rp = Math.floor(((over % OLYMPIAN_LEVELS_PER_STAR) / OLYMPIAN_LEVELS_PER_STAR) * 100);
  }
  return { level, xp, into, span, pct: span ? into / span : 0, rank, nextRank, division, rankPct, rp, limiter };
}

/** "Silver Lifter ★★☆" (or "Olympian ★×4" past the top). */
export function rankLabel(info: LevelInfo, stars = true): string {
  if (!stars) return info.rank.title;
  if (!info.nextRank) return info.division ? `${info.rank.title} ★×${info.division}` : info.rank.title;
  return `${info.rank.title} ${'★'.repeat(info.division)}${'☆'.repeat(DIVISIONS - info.division)}`;
}

/** Comparable number for detecting division-ups: rank index × 100 + division. */
export const rankStep = (info: LevelInfo) => RANKS.indexOf(info.rank) * 100 + info.division;

/** What's still missing for the next rank, e.g. "level 8 · 12 more visits". */
export function nextRankNeeds(info: LevelInfo, visits: number): string {
  const r = info.nextRank;
  if (!r) return '';
  const parts: string[] = [];
  if (info.level < r.minLevel) parts.push(`level ${r.minLevel}`);
  if (visits < r.minVisits) parts.push(`${r.minVisits - visits} more visit${r.minVisits - visits === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

// ---------- Achievements ----------

export type AchievementCategory =
  | 'Visits' | 'Streaks' | 'Strength' | 'Records' | 'Volume' | 'Habits' | 'Explorer' | 'Sets'
  | 'Time' | 'Burn' | 'Weather' | 'Holidays' | 'Special' | 'Body' | 'Hero';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  icon: string;
  title: string;
  desc: string;
  xp: number;
  target?: number; // for progress bars
}

export interface UnlockedAchievement extends AchievementDef {
  date: string;
  sessionId?: string;
}

interface Tier { n: number; xp: number; title: string; desc?: string; icon?: string }

const VISIT_TIERS: Tier[] = [
  { n: 1, xp: 50, title: 'First Rep', icon: '🌱' },
  { n: 5, xp: 75, title: 'Getting Started', icon: '👟' },
  { n: 10, xp: 100, title: 'Double Digits', icon: '🔟' },
  { n: 25, xp: 200, title: 'Quarter Century', icon: '🎟️' },
  { n: 50, xp: 300, title: 'Half Century', icon: '💪' },
  { n: 75, xp: 400, title: 'Dedicated', icon: '🧱' },
  { n: 100, xp: 600, title: 'Centurion', icon: '🛡️' },
  { n: 150, xp: 750, title: 'Iron Habit', icon: '⚙️' },
  { n: 200, xp: 1000, title: 'Bicentennial', icon: '🏛️' },
  { n: 250, xp: 1250, title: 'Quarter Thousand', icon: '🎯' },
  { n: 300, xp: 1500, title: 'Spartan', icon: '⚔️' },
  { n: 400, xp: 2000, title: 'Unbreakable', icon: '💎' },
  { n: 500, xp: 2500, title: 'Half a Thousand', icon: '🏅' },
  { n: 750, xp: 3500, title: 'Gym Rat Royalty', icon: '👑' },
  { n: 1000, xp: 5000, title: 'The Thousand', icon: '🏆' },
  { n: 1500, xp: 7500, title: 'Living Legend', icon: '🌟' },
  { n: 2000, xp: 10000, title: 'Immortal', icon: '🔱' },
];

const VOLUME_TIERS: Tier[] = [
  { n: 1_000, xp: 50, title: '1 Tonne', desc: 'about a small car', icon: '🚗' },
  { n: 5_000, xp: 100, title: '5 Tonnes', desc: 'about an orca', icon: '🐋' },
  { n: 10_000, xp: 150, title: '10 Tonnes', desc: 'more than a T. rex', icon: '🦖' },
  { n: 25_000, xp: 250, title: '25 Tonnes', desc: 'about a loaded fire truck', icon: '🚒' },
  { n: 50_000, xp: 400, title: '50 Tonnes', desc: 'nearly a battle tank', icon: '🪖' },
  { n: 100_000, xp: 600, title: '100 Tonnes', desc: 'about a blue whale', icon: '🐳' },
  { n: 250_000, xp: 1000, title: '250 Tonnes', desc: 'more than the Statue of Liberty', icon: '🗽' },
  { n: 500_000, xp: 1500, title: '500 Tonnes', desc: 'nearly an A380 at take-off', icon: '✈️' },
  { n: 1_000_000, xp: 2500, title: '1,000 Tonnes', desc: 'about a train of loaded freight cars', icon: '🚂' },
  { n: 2_500_000, xp: 4000, title: '2,500 Tonnes', desc: 'about a small cargo ship', icon: '🚢' },
  { n: 7_300_000, xp: 7000, title: 'Eiffel Tower', desc: 'the weight of the Eiffel Tower (7,300 t)', icon: '🗼' },
];

const STREAK_TIERS: Tier[] = [
  { n: 2, xp: 100, title: 'Back to Back', icon: '🔥' },
  { n: 4, xp: 200, title: 'One Month Strong', icon: '🔥' },
  { n: 8, xp: 400, title: 'Two Months Strong', icon: '🔥' },
  { n: 12, xp: 600, title: 'Quarter Year', icon: '☄️' },
  { n: 26, xp: 1200, title: 'Half Year', icon: '🌋' },
  { n: 52, xp: 2500, title: 'Full Year', icon: '🌞' },
];

const PR_TIERS: Tier[] = [
  { n: 1, xp: 25, title: 'First PR', icon: '📈' },
  { n: 10, xp: 100, title: 'PR Hunter', icon: '🎯' },
  { n: 25, xp: 200, title: 'Record Breaker', icon: '💥' },
  { n: 50, xp: 300, title: 'Progress Machine', icon: '🚀' },
  { n: 100, xp: 500, title: 'Limit Breaker', icon: '⚡' },
  { n: 250, xp: 1000, title: 'Ever Stronger', icon: '🌠' },
];

const EXPLORER_TIERS: Tier[] = [
  { n: 5, xp: 50, title: 'Curious', icon: '🧭' },
  { n: 10, xp: 100, title: 'Explorer', icon: '🗺️' },
  { n: 20, xp: 200, title: 'Machine Collector', icon: '🧰' },
  { n: 30, xp: 300, title: 'Gym Cartographer', icon: '🧭' },
  { n: 40, xp: 400, title: 'Knows Every Machine', icon: '🎓' },
];

const SET_TIERS: Tier[] = [
  { n: 100, xp: 50, title: '100 Sets', icon: '🔁' },
  { n: 500, xp: 150, title: '500 Sets', icon: '🔁' },
  { n: 1000, xp: 300, title: '1,000 Sets', icon: '🔁' },
  { n: 2500, xp: 600, title: '2,500 Sets', icon: '🔁' },
  { n: 5000, xp: 1200, title: '5,000 Sets', icon: '🔁' },
  { n: 10000, xp: 2500, title: '10,000 Sets', icon: '🔁' },
];

const TIME_TIERS: Tier[] = [
  { n: 600, xp: 100, title: '10 Hours', icon: '⏱️' },
  { n: 3000, xp: 300, title: '50 Hours', icon: '⏱️' },
  { n: 6000, xp: 600, title: '100 Hours', icon: '⌛' },
  { n: 15000, xp: 1200, title: '250 Hours', icon: '⌛' },
  { n: 30000, xp: 2500, title: '500 Hours', icon: '🕰️' },
];

const BURN_TIERS: Tier[] = [
  { n: 10_000, xp: 100, title: 'Pizza Party', desc: '≈ 35 slices of pizza', icon: '🍕' },
  { n: 50_000, xp: 300, title: 'Furnace', desc: '≈ 25 days of eating', icon: '🔥' },
  { n: 100_000, xp: 600, title: 'Inferno', desc: '≈ 400 empanadas', icon: '🥟' },
  { n: 250_000, xp: 1500, title: 'Supernova', desc: '≈ 2,500 alfajores', icon: '☀️' },
];

const tierDefs = (prefix: string, category: AchievementCategory, tiers: Tier[], descFn: (t: Tier) => string): AchievementDef[] =>
  tiers.map((t) => ({ id: `${prefix}-${t.n}`, category, icon: t.icon ?? '🏅', title: t.title, desc: descFn(t), xp: t.xp, target: t.n }));

const fmt = (n: number) => n.toLocaleString('en-US');

// Barbell lifts used for strength standards (Smith machine & machines don't count).
export const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
export const SQUAT = 'Barbell_Squat';
export const DEADLIFT = 'Barbell_Deadlift';
export const PULLUP = 'Assisted_Pull-Up_Machine';

interface StrengthDef { id: string; ex: string; kg?: number; xbw?: number; icon: string; title: string; desc: string; xp: number }
const STRENGTH: StrengthDef[] = [
  { id: 'str-bench-60', ex: BENCH, kg: 60, icon: '🥉', title: 'One-Plate Bench', desc: 'Bench press 60 kg (a 20 kg plate each side)', xp: 150 },
  { id: 'str-bench-bw', ex: BENCH, xbw: 1, icon: '🪞', title: 'Bodyweight Bench', desc: 'Bench press your own bodyweight', xp: 300 },
  { id: 'str-bench-100', ex: BENCH, kg: 100, icon: '🥈', title: 'Two-Plate Bench', desc: 'Bench press 100 kg', xp: 500 },
  { id: 'str-bench-140', ex: BENCH, kg: 140, icon: '🥇', title: 'Three-Plate Bench', desc: 'Bench press 140 kg', xp: 1000 },
  { id: 'str-squat-100', ex: SQUAT, kg: 100, icon: '🦵', title: 'Two-Plate Squat', desc: 'Squat 100 kg', xp: 300 },
  { id: 'str-squat-1.5', ex: SQUAT, xbw: 1.5, icon: '🏋️', title: 'Squat 1.5× Bodyweight', desc: 'Squat one and a half times your bodyweight', xp: 500 },
  { id: 'str-squat-140', ex: SQUAT, kg: 140, icon: '🗿', title: 'Three-Plate Squat', desc: 'Squat 140 kg', xp: 700 },
  { id: 'str-dl-140', ex: DEADLIFT, kg: 140, icon: '⛓️', title: 'Three-Plate Deadlift', desc: 'Deadlift 140 kg', xp: 400 },
  { id: 'str-dl-2', ex: DEADLIFT, xbw: 2, icon: '🐂', title: 'Deadlift 2× Bodyweight', desc: 'Deadlift double your bodyweight', xp: 600 },
  { id: 'str-dl-180', ex: DEADLIFT, kg: 180, icon: '🦍', title: 'Four-Plate Deadlift', desc: 'Deadlift 180 kg', xp: 900 },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tierDefs('visits', 'Visits', VISIT_TIERS, (t) => `Go to the gym ${t.n === 1 ? 'for the first time' : `${fmt(t.n)} times`}`),
  ...tierDefs('streak', 'Streaks', STREAK_TIERS, (t) => `Hit your weekly goal ${t.n} weeks in a row`),
  ...STRENGTH.map((s) => ({ id: s.id, category: 'Strength' as const, icon: s.icon, title: s.title, desc: `${s.desc} (barbell, 1+ rep)`, xp: s.xp })),
  { id: 'str-pullup', category: 'Strength', icon: '🦸', title: 'First Real Pull-up', desc: 'A pull-up with zero assistance (assisted machine at 0 kg)', xp: 250 },
  { id: 'str-pullup-10', category: 'Strength', icon: '🕷️', title: 'Ten Strict Pull-ups', desc: '10 unassisted pull-ups in one set: superhero territory', xp: 600 },
  ...tierDefs('prs', 'Records', PR_TIERS, (t) => (t.n === 1 ? 'Set your first personal record' : `Set ${fmt(t.n)} personal records`)),
  { id: 'hab-overload', category: 'Records', icon: '📶', title: 'Progressive Overload', desc: 'Weight PR on the same exercise 3 sessions in a row', xp: 200 },
  ...tierDefs('volume', 'Volume', VOLUME_TIERS, (t) => `Lift ${fmt(t.n / 1000)} t in total: ${t.desc}`),
  { id: 'hab-comeback', category: 'Habits', icon: '🔄', title: 'Comeback Kid', desc: 'Return after 14+ days away. Welcome back!', xp: 75 },
  { id: 'hab-weekend', category: 'Habits', icon: '🏖️', title: 'Weekend Warrior', desc: 'Train Saturday AND Sunday of the same weekend', xp: 75 },
  { id: 'hab-monday', category: 'Habits', icon: '📆', title: 'Monday Club', desc: 'Train on 10 Mondays', xp: 100, target: 10 },
  { id: 'hab-legs', category: 'Habits', icon: '🍗', title: 'Never Skip Leg Day', desc: 'Train legs 8 weeks in a row', xp: 300, target: 8 },
  { id: 'hab-fullbody', category: 'Habits', icon: '🧩', title: 'Full Body Week', desc: 'Chest, back, shoulders, arms and legs in one week', xp: 100 },
  { id: 'hab-variety', category: 'Habits', icon: '🎨', title: 'Variety Pack', desc: '8+ different exercises in one workout', xp: 75 },
  { id: 'hab-reps', category: 'Habits', icon: '🏭', title: 'Rep Factory', desc: '500+ reps in one workout', xp: 100 },
  { id: 'hab-heart', category: 'Habits', icon: '❤️‍🔥', title: 'Heart of Steel', desc: 'Average 140+ bpm in a 45+ minute workout', xp: 100 },
  { id: 'hab-anniversary', category: 'Habits', icon: '🎂', title: 'Iron Anniversary', desc: 'Still training one year after your first workout', xp: 1000 },
  ...tierDefs('explorer', 'Explorer', EXPLORER_TIERS, (t) => `Train ${t.n} different exercises`),
  ...tierDefs('sets', 'Sets', SET_TIERS, (t) => `Complete ${fmt(t.n)} sets`),
  ...tierDefs('time', 'Time', TIME_TIERS, (t) => `Log ${fmt(t.n / 60)} hours of workouts from your watch`),
  ...tierDefs('burn', 'Burn', BURN_TIERS, (t) => `Burn ${fmt(t.n)} active kcal in total: ${t.desc}`),
  { id: 'wx-rain-1', category: 'Weather', icon: '🌧️', title: 'Rainy Day Warrior', desc: 'Train while it rains', xp: 75 },
  { id: 'wx-rain-10', category: 'Weather', icon: '⛈️', title: 'Storm Chaser', desc: 'Train in the rain 10 times', xp: 300, target: 10 },
  { id: 'wx-cold', category: 'Weather', icon: '🥶', title: 'Frost Fighter', desc: 'Train when it is 5 °C or colder', xp: 75 },
  { id: 'wx-freeze', category: 'Weather', icon: '🐻‍❄️', title: 'Polar Bear', desc: 'Train when it is 0 °C or below', xp: 150 },
  { id: 'wx-heat', category: 'Weather', icon: '🥵', title: 'Heatwave Hero', desc: 'Train when it is 33 °C or hotter', xp: 75 },
  { id: 'hol-1', category: 'Holidays', icon: '🎉', title: 'Patriot Pump', desc: 'Train on an Argentine national holiday', xp: 100 },
  { id: 'hol-5', category: 'Holidays', icon: '🧉', title: 'Feriado Fiend', desc: 'Train on 5 national holidays', xp: 250, target: 5 },
  { id: 'hol-10', category: 'Holidays', icon: '🗓️', title: 'Full Calendar', desc: 'Train on 10 different national holidays', xp: 750, target: 10 },
  { id: 'hol-newyear', category: 'Holidays', icon: '🎆', title: 'New Year, Same Me', desc: 'Train in the first week of January', xp: 100 },
  { id: 'hol-xmas', category: 'Holidays', icon: '🎄', title: 'Iron Navidad', desc: 'Train between Dec 24 and 26', xp: 100 },
  { id: 'special-marathon', category: 'Special', icon: '🏃', title: 'Marathon Session', desc: 'A workout of 90+ minutes', xp: 100 },
  { id: 'special-beast', category: 'Special', icon: '🦍', title: 'Volume Beast', desc: 'Move 10 t in a single session', xp: 150 },
  { id: 'special-early', category: 'Special', icon: '🌅', title: 'Early Bird', desc: 'Start a workout before 7:00', xp: 50 },
  { id: 'special-night', category: 'Special', icon: '🌙', title: 'Night Owl', desc: 'Start a workout at 21:00 or later', xp: 50 },
  { id: 'special-month', category: 'Special', icon: '📅', title: 'Iron Month', desc: 'Go 12+ days in one calendar month', xp: 300 },
  { id: 'special-double', category: 'Special', icon: '⚡', title: 'Triple PR', desc: 'Set 3+ records in one session', xp: 75 },
  { id: 'body-first', category: 'Body', icon: '⚖️', title: 'On the Scale', desc: 'Log your bodyweight for the first time', xp: 25 },
  { id: 'body-10', category: 'Body', icon: '📊', title: 'Tracking Pro', desc: 'Log your bodyweight 10 times', xp: 75, target: 10 },
  { id: 'body-goal', category: 'Body', icon: '🎯', title: 'Goal Weight', desc: 'Reach your goal bodyweight', xp: 500 },
  ...HERO_STAGES.slice(1).map((st, i) => ({ id: `hero-stage-${i + 1}`, category: 'Hero' as const, icon: st.icon, title: st.name, desc: `Reach ${Math.round(st.min * 100)}% of your Hero Physique goal`, xp: st.xp })),
  { id: 'hero-push-50', category: 'Hero', icon: '💪', title: '50 Push-ups', desc: '50 strict push-ups in one set', xp: 400 },
  { id: 'hero-dip-20', category: 'Hero', icon: '🔱', title: '20 Dips', desc: '20 strict dips in one set', xp: 400 },
  { id: 'hero-cindy-10', category: 'Hero', icon: '⏱️', title: 'Cindy: 10 Rounds', desc: '10+ rounds of Cindy in 20 minutes', xp: 150 },
  { id: 'hero-cindy-15', category: 'Hero', icon: '⏱️', title: 'Cindy: 15 Rounds', desc: '15+ rounds of Cindy in 20 minutes', xp: 300 },
  { id: 'hero-cindy-20', category: 'Hero', icon: '🏅', title: 'Cindy: 20 Rounds', desc: '20+ rounds of Cindy: advanced', xp: 600 },
  { id: 'hero-ladder', category: 'Hero', icon: '🪜', title: 'The Holland Ladder', desc: 'Finish all 19 rungs: 1,500 reps', xp: 1000 },
  { id: 'hero-ladder-45', category: 'Hero', icon: '🕸️', title: 'Ladder Under 45', desc: 'Finish the ladder in 45 minutes or less', xp: 1000 },
];

const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// ---------- Seasons (quarterly, like Rocket League / battle-pass seasons) ----------
// A fresh scoreboard every 3 months that rewards *current* consistency; the lifetime rank
// never resets. Tiers are relative to your weekly goal, so they stay honest.

export interface SeasonTier { name: string; icon: string; share: number; xp: number; color: string }
export const SEASON_TIERS: SeasonTier[] = [
  { name: 'Bronze', icon: '🥉', share: 0.25, xp: 50, color: '#cd8a4f' },
  { name: 'Silver', icon: '🥈', share: 0.5, xp: 100, color: '#c7d0dc' },
  { name: 'Gold', icon: '🥇', share: 0.7, xp: 200, color: '#f5c542' },
  { name: 'Platinum', icon: '💠', share: 0.85, xp: 300, color: '#7fe0d6' },
  { name: 'Diamond', icon: '💎', share: 0.95, xp: 500, color: '#8fd3ff' },
  { name: 'Champion', icon: '👑', share: 1, xp: 750, color: '#ffd166' }, // weekly goal hit EVERY week
];

export interface SeasonState {
  key: string; // 2026-Q4
  label: string; // Spring 2026 (southern hemisphere)
  start: string;
  end: string;
  weeks: number; // weeks (by Monday) in the season
  visits: number;
  goalWeeks: number;
  tier: number; // index into SEASON_TIERS, -1 = none yet
  targets: number[]; // visits needed per tier (Champion uses goalWeeks === weeks)
}

const SEASON_NAMES = ['Summer', 'Autumn', 'Winter', 'Spring']; // Jan–Mar … Oct–Dec in Argentina

export function seasonOf(date: string, goal: number): SeasonState {
  const y = Number(date.slice(0, 4));
  const q = Math.floor((Number(date.slice(5, 7)) - 1) / 3);
  const start = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const end = addDays(q === 3 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 4).padStart(2, '0')}-01`, -1);
  let weeks = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (parseDate(d).getDay() === 1) weeks++;
  return {
    key: `${y}-Q${q + 1}`, label: `${SEASON_NAMES[q]} ${y}`, start, end, weeks, visits: 0, goalWeeks: 0, tier: -1,
    targets: SEASON_TIERS.map((t) => Math.ceil(t.share * goal * weeks)),
  };
}

// ---------- Weekly quests (Destiny bounties / Fortnite weekly challenges) ----------
// Three per week, picked deterministically from the week + your history, all of them
// healthy habits. Small XP so they motivate without inflating levels.

export const QUEST_XP = 50;
export const QUEST_ALL_BONUS = 50;

interface WeekStats {
  visits: number; sets: number; volume: number; prs: number; legs: number; groups: Set<MuscleGroup>;
  weighIns: number; maxMinutes: number; weekend: number; newEx: number; maxExInSession: number; visitsByThu: number;
  calisReps: number; backSets: number; chestSets: number; benchmark: number;
}
interface QuestCtx { goal: number; avgVol: number; seen: number; exTotal: number; hasWatch: boolean; visits: number; benchRecent: boolean }
interface QuestDef {
  id: string; icon: string;
  title: (c: QuestCtx) => string;
  target: (c: QuestCtx) => number;
  value: (s: WeekStats) => number;
  eligible: (c: QuestCtx) => boolean;
}
const MAJOR: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'];
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

const QUESTS: QuestDef[] = [
  { id: 'pr', icon: '🏆', title: () => 'Set a personal record', target: () => 1, value: (s) => s.prs, eligible: (c) => c.seen >= 3 },
  { id: 'legs', icon: '🦵', title: () => 'Train legs', target: () => 1, value: (s) => s.legs, eligible: () => true },
  { id: 'fullbody', icon: '🧩', title: () => 'Hit chest, back, shoulders, arms and legs', target: () => 5, value: (s) => MAJOR.filter((g) => s.groups.has(g)).length, eligible: (c) => c.goal >= 2 },
  { id: 'sets', icon: '🔁', title: (c) => `Complete ${c.goal * 15} sets`, target: (c) => c.goal * 15, value: (s) => s.sets, eligible: () => true },
  { id: 'volume', icon: '📈', title: (c) => `Move ${roundTo(c.avgVol * 1.05, 100).toLocaleString('en-US')} kg (5% above your recent average)`, target: (c) => roundTo(c.avgVol * 1.05, 100), value: (s) => s.volume, eligible: (c) => c.avgVol > 0 },
  { id: 'weighin', icon: '⚖️', title: () => 'Log your bodyweight', target: () => 1, value: (s) => s.weighIns, eligible: () => true },
  { id: 'explore', icon: '🧭', title: () => "Try an exercise you've never done", target: () => 1, value: (s) => s.newEx, eligible: (c) => c.seen >= 3 && c.seen < c.exTotal },
  { id: 'long', icon: '⏱️', title: () => 'One workout of 60+ minutes', target: () => 60, value: (s) => s.maxMinutes, eligible: (c) => c.hasWatch },
  { id: 'weekend', icon: '🏖️', title: () => 'Train on Saturday or Sunday', target: () => 1, value: (s) => s.weekend, eligible: () => true },
  { id: 'variety', icon: '🎨', title: () => 'Do 6+ different exercises in one workout', target: () => 6, value: (s) => s.maxExInSession, eligible: (c) => c.seen >= 6 },
  { id: 'calisthenics', icon: '🤸', title: () => 'Do 50 reps of pull-ups, dips or push-ups (assisted counts)', target: () => 50, value: (s) => s.calisReps, eligible: () => true },
  { id: 'vtaper', icon: '📐', title: () => 'V-taper week: at least as many back sets as chest sets (6+ back)', target: () => 1, value: (s) => (s.backSets >= 6 && s.backSets >= s.chestSets ? 1 : 0), eligible: (c) => c.goal >= 2 },
  { id: 'benchmark', icon: '🕷️', title: () => 'Test a Hero benchmark: the Ladder or Cindy (scaled is fine)', target: () => 1, value: (s) => s.benchmark, eligible: (c) => c.visits >= 8 && !c.benchRecent },
  { id: 'early', icon: '⚡', title: () => 'Reach your weekly goal by Thursday', target: (c) => c.goal, value: (s) => s.visitsByThu, eligible: (c) => c.goal <= 4 },
];

export interface QuestStatus { id: string; icon: string; title: string; target: number; value: number; done: boolean; xp: number }

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickQuests(week: string, c: QuestCtx): QuestStatus[] {
  let seed = hashStr(`gymxp:${week}`);
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0), seed / 2 ** 32);
  const pool = QUESTS.filter((q) => q.eligible(c)).map((q) => ({ q, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, 3);
  return pool.map(({ q }) => ({ id: q.id, icon: q.icon, title: q.title(c), target: q.target(c), value: 0, done: false, xp: QUEST_XP }));
}

const emptyWeek = (): WeekStats => ({ visits: 0, sets: 0, volume: 0, prs: 0, legs: 0, groups: new Set(), weighIns: 0, maxMinutes: 0, weekend: 0, newEx: 0, maxExInSession: 0, visitsByThu: 0, calisReps: 0, backSets: 0, chestSets: 0, benchmark: 0 });

// ---------- Machine mastery (Battlefield weapon service stars) ----------
export const MASTERY = [
  { n: 5, name: 'Bronze', icon: '🥉' },
  { n: 15, name: 'Silver', icon: '🥈' },
  { n: 30, name: 'Gold', icon: '🥇' },
  { n: 60, name: 'Platinum', icon: '💠' },
  { n: 100, name: 'Diamond', icon: '💎' },
  { n: 200, name: 'Master', icon: '👑' },
];

/** Mastery tier for an exercise from how many sessions you've done it. */
export function masteryOf(sessions: number) {
  let tier = -1;
  MASTERY.forEach((m, i) => { if (sessions >= m.n) tier = i; });
  const next = MASTERY[tier + 1];
  const from = tier >= 0 ? MASTERY[tier].n : 0;
  return { tier, current: tier >= 0 ? MASTERY[tier] : null, next, pct: next ? (sessions - from) / (next.n - from) : 1 };
}

// ---------- Engine ----------

export interface XpItem {
  label: string;
  xp: number;
  kind: 'base' | 'bonus' | 'pr' | 'achievement';
}

export interface PR {
  exerciseId: string;
  kind: 'weight' | 'e1rm' | 'assist' | 'reps' | 'rounds' | 'rungs' | 'time';
  value: number;
  prev: number;
}

export interface SessionResult {
  id: string;
  date: string;
  xp: number;
  items: XpItem[];
  volume: number;
  sets: number;
  prs: PR[];
  newExercises: string[];
  streakWeeks: number;
  multiplier: number;
  xpBefore: number;
  xpAfter: number;
  visitsBefore: number;
  visitsAfter: number;
  holiday?: string;
  achievements: UnlockedAchievement[];
}

export interface ExerciseBest {
  maxKg: number; // heaviest set (raw kg; for assisted: least assistance; for the ladder: best full time in minutes)
  maxReps: number; // most reps in one set (rounds for Cindy, rungs for the ladder)
  maxRepsDate: string;
  maxKgDate: string;
  maxE1rm: number;
  maxE1rmDate: string;
  sessions: number;
  lastDate: string;
}

export interface ExerciseHistoryPoint {
  date: string;
  sessionId: string;
  bestKg: number;
  bestE1rm: number;
  volume: number;
  sets: { kg: number; reps: number }[];
}

export interface GameState {
  totalXp: number;
  level: LevelInfo;
  sessions: Map<string, SessionResult>;
  weighIns: Map<string, number>; // weight entry id -> xp
  unlocked: UnlockedAchievement[];
  unlockedIds: Set<string>;
  progress: Record<string, number>; // metric values for locked achievements
  visits: number;
  totalVolume: number;
  totalSets: number;
  totalMinutes: number;
  totalKcal: number;
  prCount: number;
  exercisesTried: number;
  bests: Map<string, ExerciseBest>;
  history: Map<string, ExerciseHistoryPoint[]>;
  maxPullups: number; // most unassisted pull-ups in one set
  hero: HeroResult;
  heroBodyweightKnown: boolean;
  bodyweight: number; // latest logged, 0 if none
  weekStreak: number; // current streak (weeks hitting goal), counting this week if already hit
  bestWeekStreak: number;
  thisWeekVisits: number;
  timeline: { date: string; xp: number }[]; // cumulative XP after each day with activity
  quests: QuestStatus[]; // this week's
  seasons: SeasonState[]; // oldest first
  season: SeasonState; // the current one
}

export function e1rm(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0) return 0;
  return kg * (1 + Math.min(reps, 30) / 30);
}

export function sortSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => !s.deleted)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.createdAt - b.createdAt);
}

/** Bodyweight on or before a date (closest earlier entry, else the first ever entry). */
function bodyweightLookup(data: AppData): (date: string) => number {
  const ws = data.weights.filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date));
  return (date: string) => {
    let bw = ws[0]?.kg ?? 0;
    for (const w of ws) {
      if (w.date <= date) bw = w.kg;
      else break;
    }
    return bw;
  };
}

export function effectiveLoad(ex: Exercise | undefined, kg: number, bw: number): number {
  if (ex?.assisted) return Math.max(0, bw - kg);
  if (ex?.bwFactor) return kg * (ex.vestMult ?? 1) + ex.bwFactor * bw;
  return kg * (ex?.loadFactor ?? 1);
}

export function computeGame(data: AppData, exMap: Map<string, Exercise>): GameState {
  const goal = Math.max(1, data.profile.weeklyGoal || 3);
  const bwAt = bodyweightLookup(data);
  const sessions = sortSessions(data.sessions);
  const weights = data.weights.filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt);

  type Ev = { date: string; order: number; kind: 's'; s: Session } | { date: string; order: number; kind: 'w'; w: (typeof weights)[number] };
  const events: Ev[] = [
    ...weights.map((w, i) => ({ date: w.date, order: i, kind: 'w' as const, w })),
    ...sessions.map((s, i) => ({ date: s.date, order: 100000 + i, kind: 's' as const, s })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let totalXp = 0;
  const results = new Map<string, SessionResult>();
  const weighIns = new Map<string, number>();
  const unlocked: UnlockedAchievement[] = [];
  const unlockedIds = new Set<string>();
  const visitDays = new Set<string>();
  const weekVisits = new Map<string, number>();
  const goalWeeks = new Set<string>();
  const monthVisits = new Map<string, number>();
  const weighInWeeks = new Set<string>();
  const seen = new Set<string>();
  const bests = new Map<string, ExerciseBest>();
  const history = new Map<string, ExerciseHistoryPoint[]>();
  const timeline: { date: string; xp: number }[] = [];
  const weekGroups = new Map<string, Set<MuscleGroup>>();
  const legWeeks = new Set<string>();
  const prStreak = new Map<string, number>();
  const holidayNames = new Set<string>();
  let totalVolume = 0, totalSets = 0, totalMinutes = 0, totalKcal = 0, prCount = 0, weighInCount = 0, bestStreak = 0;
  let mondays = 0, rainDays = 0, holidayDays = 0, bestLegStreak = 0;
  // --- Hero Physique tracking ---
  const hero = { pull: emptyCapacity(), dip: emptyCapacity(), push: emptyCapacity(), core: emptyCapacity(), cindy: 0, ladderRungs: 0, ladderMin: 0 };
  const benchmarkWeeks = new Set<string>();
  const weekMuscle = new Map<string, Record<HeroMuscle, number>>();
  const muscleSets = (wk: string) => {
    let m = weekMuscle.get(wk);
    if (!m) { m = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0 }; weekMuscle.set(wk, m); }
    return m;
  };
  const strength = new Map<string, { base: number; best: number; sessions: number }>();
  const bump = (c: Capacity, strict: number, e: { est: number; frac: number }) => {
    c.strict = Math.max(c.strict, strict);
    c.est = Math.max(c.est, e.est);
    c.frac = Math.max(c.frac, e.frac, strict >= 1 ? 1 : 0);
  };
  const NONE = { est: 0, frac: 0 };
  const heroSet = (id: string, ex: Exercise | undefined, kg: number, r: number, bwRaw: number) => {
    const bw = bwRaw || 70;
    if (HERO_IDS.pull.includes(id)) bump(hero.pull, r, kg > 0 ? capacityFrom(e1rm(bw + kg, r), bw) : NONE);
    else if (id === HERO_IDS.pullAssist) kg <= 0 ? bump(hero.pull, r, NONE) : bump(hero.pull, 0, capacityFrom(e1rm(Math.max(0, bw - kg), r), bw));
    else if (HERO_IDS.dip.includes(id)) bump(hero.dip, r, kg > 0 ? capacityFrom(e1rm(0.9 * bw + kg, r), 0.9 * bw) : NONE);
    else if (id === HERO_IDS.dipAssist) kg <= 0 ? bump(hero.dip, r, NONE) : bump(hero.dip, 0, capacityFrom(e1rm(Math.max(0, bw - kg), r), bw));
    else if (HERO_IDS.push.includes(id)) bump(hero.push, r, kg > 0 ? capacityFrom(e1rm(0.64 * bw + kg, r), 0.64 * bw) : NONE);
    else if (HERO_IDS.pushEstimate[id]) bump(hero.push, 0, capacityFrom(e1rm(effectiveLoad(ex, kg, bw), r) * HERO_IDS.pushEstimate[id], 0.64 * bw));
    else if (HERO_IDS.core.includes(id)) bump(hero.core, r, NONE);
  };
  const strengthGain = () => {
    const lifts = [...strength.values()].filter((x) => x.sessions >= 4 && x.base > 0).sort((a, b) => b.sessions - a.sessions).slice(0, 6);
    if (lifts.length < 2) return { gain: null, n: lifts.length };
    const g = lifts.map((x) => x.best / x.base - 1).sort((a, b) => a - b);
    const mid = Math.floor(g.length / 2);
    return { gain: g.length % 2 ? g[mid] : (g[mid - 1] + g[mid]) / 2, n: lifts.length };
  };
  const heroSnapshot = (endWk: string, bw: number): HeroResult => {
    const avg: Record<HeroMuscle, number> = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0 };
    const credit: Record<HeroMuscle, number> = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0 };
    // 12-week window: muscle is built by months of enough volume, not one good week
    for (let i = 0; i < HERO_VOLUME_WEEKS; i++) {
      const w = weekMuscle.get(addDays(endWk, -7 * i));
      if (w) for (const k of Object.keys(avg) as HeroMuscle[]) {
        avg[k] += w[k] / HERO_VOLUME_WEEKS;
        credit[k] += Math.min(w[k], HERO_TARGETS.setsPerMuscle) / HERO_VOLUME_WEEKS; // a huge week can't make up for missed ones
      }
    }
    const sg = strengthGain();
    return scoreHero({
      bodyweight: bw || 70, bodyweightKnown: bw > 0, pull: hero.pull, dip: hero.dip, push: hero.push, core: hero.core,
      cindyRounds: hero.cindy, ladderRungs: hero.ladderRungs, ladderBestMinutes: hero.ladderMin,
      weeklySets: avg, weeklyCredit: credit, strengthGain: sg.gain, strengthLifts: sg.n, gymDays: visitDays.size,
    });
  };
  let lastVisit: string | undefined;
  const firstVisit = sessions[0]?.date;
  const firstWeight = weights[0]?.kg;

  const unlock = (id: string, date: string, sink: XpItem[] | null, sessionId?: string) => {
    if (unlockedIds.has(id)) return 0;
    const def = ACH_BY_ID.get(id);
    if (!def) return 0;
    unlockedIds.add(id);
    unlocked.push({ ...def, date, sessionId });
    sink?.push({ label: `${def.icon} ${def.title}`, xp: def.xp, kind: 'achievement' });
    return def.xp;
  };
  const checkTiers = (prefix: string, tiers: Tier[], value: number, date: string, sink: XpItem[] | null, sessionId?: string) => {
    let xp = 0;
    for (const t of tiers) if (value >= t.n) xp += unlock(`${prefix}-${t.n}`, date, sink, sessionId);
    return xp;
  };
  const consecutive = (set: Set<string>, wk: string) => {
    let n = 0;
    for (let w = wk; set.has(w); w = addDays(w, -7)) n++;
    return n;
  };
  const pushTimeline = (date: string) => {
    const last = timeline[timeline.length - 1];
    if (last && last.date === date) last.xp = totalXp;
    else timeline.push({ date, xp: totalXp });
  };

  // --- seasons & weekly quests ---
  const seasons = new Map<string, SeasonState>();
  const seasonFor = (date: string) => {
    const fresh = seasonOf(date, goal);
    let ss = seasons.get(fresh.key);
    if (!ss) { ss = fresh; seasons.set(ss.key, ss); }
    return ss;
  };
  const weekVolume = new Map<string, number>();
  let hasWatch = false;
  let curWeek = '';
  let week = emptyWeek();
  let quests: QuestStatus[] = [];
  const questCtx = (beforeWeek: string): QuestCtx => {
    const recent = [...weekVolume.entries()].filter(([k, v]) => k < beforeWeek && v > 0).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
    const avgVol = recent.length >= 2 ? recent.reduce((a, [, v]) => a + v, 0) / recent.length : 0;
    const benchRecent = [0, 1, 2, 3].some((i) => benchmarkWeeks.has(addDays(beforeWeek, -7 * (i + 1))));
    return { goal, avgVol, seen: seen.size, exTotal: exMap.size, hasWatch, visits: visitDays.size, benchRecent };
  };
  const enterWeek = (wk: string) => {
    if (wk === curWeek) return;
    curWeek = wk;
    week = emptyWeek();
    quests = pickQuests(wk, questCtx(wk));
  };
  const checkQuests = (award: (label: string, v: number) => void) => {
    for (const q of quests) {
      q.value = QUESTS.find((d) => d.id === q.id)!.value(week);
      if (!q.done && q.value >= q.target) {
        q.done = true;
        award(`${q.icon} Quest: ${q.title}`, QUEST_XP);
        if (quests.every((x) => x.done)) award('🎯 All weekly quests cleared', QUEST_ALL_BONUS);
      }
    }
  };

  for (const ev of events) {
    if (ev.kind === 'w') {
      const w = ev.w;
      weighInCount++;
      let xp = 0;
      const wk = weekKey(w.date);
      enterWeek(wk);
      week.weighIns++;
      checkQuests((_, v) => { xp += v; });
      if (!weighInWeeks.has(wk)) { weighInWeeks.add(wk); xp += RULES.weighInXp; }
      xp += unlock('body-first', w.date, null);
      if (weighInCount >= 10) xp += unlock('body-10', w.date, null);
      const goalKg = data.profile.goalWeightKg;
      if (goalKg && firstWeight !== undefined && firstWeight !== goalKg) {
        const reached = firstWeight > goalKg ? w.kg <= goalKg : w.kg >= goalKg;
        if (reached) xp += unlock('body-goal', w.date, null);
      }
      weighIns.set(w.id, xp);
      totalXp += xp;
      pushTimeline(w.date);
      continue;
    }

    const s = ev.s;
    const items: XpItem[] = [];
    const xpBefore = totalXp;
    const visitsBefore = visitDays.size;
    const bw = bwAt(s.date);
    const wk = weekKey(s.date);
    enterWeek(wk);
    const dow = parseDate(s.date).getDay(); // 0 = Sunday

    // --- base XP ---
    let base = 0;
    const firstOfDay = !visitDays.has(s.date);
    const gapDays = lastVisit ? Math.round((parseDate(s.date).getTime() - parseDate(lastVisit).getTime()) / 86400000) : 0;
    if (firstOfDay) {
      visitDays.add(s.date);
      weekVisits.set(wk, (weekVisits.get(wk) ?? 0) + 1);
      const mk = s.date.slice(0, 7);
      monthVisits.set(mk, (monthVisits.get(mk) ?? 0) + 1);
      if (dow === 1) mondays++;
      items.push({ label: 'Gym visit', xp: RULES.visitXp, kind: 'base' });
      base += RULES.visitXp;
    }

    let sets = 0;
    let volume = 0;
    let reps = 0;
    const prs: PR[] = [];
    const newExercises: string[] = [];
    const groups = weekGroups.get(wk) ?? new Set<MuscleGroup>();
    weekGroups.set(wk, groups);
    const strengthHits: { ex: string; kg: number }[] = [];
    for (const log of s.exercises) {
      const ex = exMap.get(log.exerciseId);
      const done = log.sets.filter((x) => x.reps > 0);
      if (!done.length) continue;
      const bench = ex?.benchmark;
      const bodyweightEx = !!ex?.bwFactor && !bench;
      if (ex && !bench) groups.add(ex.group === 'Glutes' ? 'Legs' : ex.group);
      sets += done.length;
      let exVol = 0, bestKg = ex?.assisted ? Infinity : 0, bestE = 0, bestReps = 0, effE = 0, fullLadderMin = 0;
      for (const st of done) {
        bestReps = Math.max(bestReps, st.reps);
        if (bench === 'ladder') {
          const w = ladderWork(st.reps);
          reps += w.reps;
          exVol += w.bwUnits * (bw || 70);
          if (st.reps >= 19 && st.kg > 0) fullLadderMin = fullLadderMin ? Math.min(fullLadderMin, st.kg) : st.kg;
          continue;
        }
        reps += bench === 'cindy' ? st.reps * 30 : st.reps;
        const load = effectiveLoad(ex, st.kg, bw || (ex?.bwFactor || ex?.assisted ? 70 : 0));
        exVol += load * st.reps;
        effE = Math.max(effE, e1rm(load, st.reps));
        if (ex?.assisted) bestKg = Math.min(bestKg, st.kg);
        else { bestKg = Math.max(bestKg, st.kg); bestE = Math.max(bestE, bodyweightEx ? e1rm(load, st.reps) : e1rm(st.kg, st.reps)); }
        heroSet(log.exerciseId, ex, st.kg, st.reps, bw);
        if (HERO_IDS.pull.includes(log.exerciseId) || HERO_IDS.dip.includes(log.exerciseId) || HERO_IDS.push.includes(log.exerciseId) || log.exerciseId === HERO_IDS.pullAssist || log.exerciseId === HERO_IDS.dipAssist) week.calisReps += st.reps;
      }
      if (bench) {
        benchmarkWeeks.add(wk);
        week.benchmark = 1;
        if (bench === 'cindy') hero.cindy = Math.max(hero.cindy, bestReps);
        else {
          hero.ladderRungs = Math.max(hero.ladderRungs, Math.min(19, bestReps));
          if (fullLadderMin) hero.ladderMin = hero.ladderMin ? Math.min(hero.ladderMin, fullLadderMin) : fullLadderMin;
        }
      } else if (ex) {
        const hm = heroMuscle(ex.group);
        if (hm) muscleSets(wk)[hm] += done.length;
        if (ex.group === 'Back') week.backSets += done.length;
        if (ex.group === 'Chest') week.chestSets += done.length;
      }
      volume += exVol;
      if (!ex?.assisted && !bench) strengthHits.push({ ex: log.exerciseId, kg: bestKg });
      if (!bench && effE > 0) {
        const t = strength.get(log.exerciseId);
        if (!t) strength.set(log.exerciseId, { base: effE, best: effE, sessions: 1 });
        else { t.best = Math.max(t.best, effE); t.sessions++; }
      }

      const prev = bests.get(log.exerciseId);
      let weightPr = false;
      if (!seen.has(log.exerciseId)) {
        seen.add(log.exerciseId);
        newExercises.push(log.exerciseId);
        bests.set(log.exerciseId, {
          maxKg: bench === 'ladder' ? fullLadderMin : bestKg, maxKgDate: s.date, maxE1rm: bestE, maxE1rmDate: s.date,
          maxReps: bestReps, maxRepsDate: s.date, sessions: 1, lastDate: s.date,
        });
      } else if (prev) {
        if (bench) {
          if (bestReps > prev.maxReps) {
            prs.push({ exerciseId: log.exerciseId, kind: bench === 'cindy' ? 'rounds' : 'rungs', value: bestReps, prev: prev.maxReps });
            weightPr = true;
          } else if (bench === 'ladder' && fullLadderMin && (!prev.maxKg || fullLadderMin < prev.maxKg)) {
            prs.push({ exerciseId: log.exerciseId, kind: 'time', value: fullLadderMin, prev: prev.maxKg });
            prev.maxKg = fullLadderMin; prev.maxKgDate = s.date; weightPr = true;
          }
        } else if (bodyweightEx) {
          if (bestKg > prev.maxKg && bestKg > 0) {
            prs.push({ exerciseId: log.exerciseId, kind: 'weight', value: bestKg, prev: prev.maxKg });
            prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
          } else if (bestReps > prev.maxReps) {
            prs.push({ exerciseId: log.exerciseId, kind: 'reps', value: bestReps, prev: prev.maxReps });
            weightPr = true;
          }
          if (bestE > prev.maxE1rm) { prev.maxE1rm = bestE; prev.maxE1rmDate = s.date; }
        } else if (ex?.assisted) {
          if (bestKg < prev.maxKg) {
            prs.push({ exerciseId: log.exerciseId, kind: 'assist', value: bestKg, prev: prev.maxKg });
            prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
          }
        } else if (bestKg > prev.maxKg && bestKg > 0) {
          prs.push({ exerciseId: log.exerciseId, kind: 'weight', value: bestKg, prev: prev.maxKg });
          prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
        }
        if (!ex?.assisted && !bench && !bodyweightEx && bestE > prev.maxE1rm + 0.01) {
          if (!weightPr) prs.push({ exerciseId: log.exerciseId, kind: 'e1rm', value: bestE, prev: prev.maxE1rm });
          prev.maxE1rm = bestE; prev.maxE1rmDate = s.date;
        }
        if (bestReps > prev.maxReps) { prev.maxReps = bestReps; prev.maxRepsDate = s.date; }
        prev.sessions++;
        prev.lastDate = s.date;
      }
      prStreak.set(log.exerciseId, weightPr ? (prStreak.get(log.exerciseId) ?? 0) + 1 : 0);
      const h = history.get(log.exerciseId) ?? [];
      h.push({ date: s.date, sessionId: s.id, bestKg: bestKg === Infinity ? 0 : bestKg, bestE1rm: bestE, volume: exVol, sets: done.map((d) => ({ kg: d.kg, reps: d.reps })) });
      history.set(log.exerciseId, h);
    }
    if (groups.has('Legs')) legWeeks.add(wk);

    if (sets) {
      items.push({ label: `${sets} set${sets === 1 ? '' : 's'}`, xp: sets * RULES.setXp, kind: 'base' });
      base += sets * RULES.setXp;
    }
    const volXp = Math.floor(volume / RULES.volumeKgPerXp);
    if (volXp) { items.push({ label: `${Math.round(volume).toLocaleString('en-US')} kg moved`, xp: volXp, kind: 'base' }); base += volXp; }

    const minutes = s.watch?.durationMin ?? 0;
    if (minutes > 0) {
      const m = Math.min(Math.round(minutes), RULES.watchMinCap);
      items.push({ label: `${Math.round(minutes)} min workout`, xp: m, kind: 'base' });
      base += m;
    }
    const kcal = s.watch?.kcal ?? 0;
    if (kcal > 0) {
      const k = Math.min(Math.round(kcal / RULES.kcalPerXp), RULES.kcalXpCap);
      items.push({ label: `${Math.round(kcal)} active kcal`, xp: k, kind: 'base' });
      base += k;
    }

    // --- streak multiplier: consecutive goal weeks before this week ---
    const streakWeeks = consecutive(goalWeeks, addDays(wk, -7));
    const pct = Math.min(streakWeeks, RULES.streakCapWeeks) * RULES.streakStepPct;
    const multiplier = 1 + pct / 100;
    let xp = base;
    if (pct > 0 && base > 0) {
      const bonus = Math.round((base * pct) / 100);
      items.push({ label: `🔥 ${streakWeeks}-week streak +${pct}%`, xp: bonus, kind: 'bonus' });
      xp += bonus;
    }

    // --- conditions bonuses (once per day) ---
    const holiday = holidayOn(s.date);
    const temp = s.weather?.tempC;
    const rain = !!s.weather?.rain;
    if (firstOfDay) {
      const bonus = (label: string, v: number) => { items.push({ label, xp: v, kind: 'bonus' }); xp += v; };
      if (holiday) { bonus(`🧉 Feriado: ${holiday}`, RULES.holidayXp); holidayDays++; holidayNames.add(holiday.replace(' (trasladado)', '')); }
      if (rain) { bonus('🌧️ Trained in the rain', RULES.rainXp); rainDays++; }
      if (temp !== undefined && temp <= 5) bonus(`🥶 Cold day (${temp} °C)`, RULES.coldXp);
      if (temp !== undefined && temp <= 0) bonus('❄️ Freezing!', RULES.freezingXp);
      if (temp !== undefined && temp >= 33) bonus(`🥵 Heatwave (${temp} °C)`, RULES.heatXp);
    }

    for (const id of newExercises) {
      items.push({ label: `New exercise: ${exMap.get(id)?.name ?? 'Unknown'}`, xp: RULES.newExerciseXp, kind: 'bonus' });
      xp += RULES.newExerciseXp;
    }
    for (const pr of prs) {
      const name = exMap.get(pr.exerciseId)?.name ?? 'Unknown';
      const v = pr.kind === 'e1rm' ? RULES.e1rmPrXp : RULES.weightPrXp;
      const what = pr.kind === 'weight' ? `${pr.value} kg` : pr.kind === 'assist' ? `less assist (${pr.value} kg)` : pr.kind === 'reps' ? `${pr.value} reps`
        : pr.kind === 'rounds' ? `${pr.value} rounds` : pr.kind === 'rungs' ? `${pr.value} rungs` : pr.kind === 'time' ? `${pr.value} min` : 'best set';
      items.push({ label: `🏆 PR ${name}: ${what}`, xp: v, kind: 'pr' });
      xp += v;
    }
    prCount += prs.length;

    // weekly goal reached with this visit
    const season = seasonFor(s.date);
    if (firstOfDay) season.visits++;
    if (firstOfDay && weekVisits.get(wk) === goal) {
      goalWeeks.add(wk);
      seasonFor(wk).goalWeeks++;
      items.push({ label: `✅ Weekly goal (${goal}×) reached`, xp: RULES.weeklyGoalXp, kind: 'bonus' });
      xp += RULES.weeklyGoalXp;
    }
    for (let i = season.tier + 1; i < SEASON_TIERS.length; i++) {
      const t = SEASON_TIERS[i];
      const ok = t.name === 'Champion' ? season.goalWeeks >= season.weeks : season.visits >= season.targets[i];
      if (!ok) break;
      season.tier = i;
      items.push({ label: `${t.icon} ${season.label} season: ${t.name}`, xp: t.xp, kind: 'bonus' });
      xp += t.xp;
    }

    // weekly quests
    if (firstOfDay) {
      week.visits++;
      if (dow >= 1 && dow <= 4) week.visitsByThu++;
      if (dow === 0 || dow === 6) week.weekend = 1;
    }
    week.sets += sets;
    week.volume += volume;
    week.prs += prs.length;
    week.newEx += newExercises.length;
    week.maxMinutes = Math.max(week.maxMinutes, minutes);
    week.maxExInSession = Math.max(week.maxExInSession, s.exercises.filter((e) => e.sets.some((x) => x.reps > 0)).length);
    for (const g of groups) week.groups.add(g);
    if (groups.has('Legs')) week.legs = 1;
    weekVolume.set(wk, (weekVolume.get(wk) ?? 0) + volume);
    if (minutes > 0) hasWatch = true;
    checkQuests((label, v) => { items.push({ label, xp: v, kind: 'bonus' }); xp += v; });

    totalVolume += volume;
    totalSets += sets;
    totalMinutes += minutes;
    totalKcal += kcal;

    // --- achievements ---
    const achStart = unlocked.length;
    const A = (id: string) => { xp += unlock(id, s.date, items, s.id); };
    xp += checkTiers('visits', VISIT_TIERS, visitDays.size, s.date, items, s.id);
    xp += checkTiers('volume', VOLUME_TIERS, totalVolume, s.date, items, s.id);
    const curStreak = consecutive(goalWeeks, wk);
    bestStreak = Math.max(bestStreak, curStreak);
    xp += checkTiers('streak', STREAK_TIERS, curStreak, s.date, items, s.id);
    xp += checkTiers('prs', PR_TIERS, prCount, s.date, items, s.id);
    xp += checkTiers('explorer', EXPLORER_TIERS, seen.size, s.date, items, s.id);
    xp += checkTiers('sets', SET_TIERS, totalSets, s.date, items, s.id);
    xp += checkTiers('time', TIME_TIERS, totalMinutes, s.date, items, s.id);
    xp += checkTiers('burn', BURN_TIERS, totalKcal, s.date, items, s.id);
    // strength standards
    for (const st of STRENGTH) {
      const hit = strengthHits.find((h) => h.ex === st.ex);
      if (!hit) continue;
      if ((st.kg !== undefined && hit.kg >= st.kg) || (st.xbw !== undefined && bw > 0 && hit.kg >= st.xbw * bw)) A(st.id);
    }
    if (hero.pull.strict >= 1) A('str-pullup');
    if (hero.pull.strict >= 10) A('str-pullup-10');
    if (hero.push.strict >= 50) A('hero-push-50');
    if (hero.dip.strict >= 20) A('hero-dip-20');
    if (hero.cindy >= 10) A('hero-cindy-10');
    if (hero.cindy >= 15) A('hero-cindy-15');
    if (hero.cindy >= 20) A('hero-cindy-20');
    if (hero.ladderRungs >= 19) A('hero-ladder');
    if (hero.ladderMin && hero.ladderMin <= 45) A('hero-ladder-45');
    const heroNow = heroSnapshot(wk, bw);
    HERO_STAGES.forEach((st, i) => { if (i > 0 && heroNow.pct >= st.min) A(`hero-stage-${i}`); });
    if ([...prStreak.values()].some((v) => v >= 3)) A('hab-overload');
    // habits
    if (firstOfDay && gapDays >= 14 && visitsBefore >= 3) A('hab-comeback');
    if (dow === 0 && visitDays.has(addDays(s.date, -1))) A('hab-weekend');
    if (mondays >= 10) A('hab-monday');
    const legStreak = consecutive(legWeeks, wk);
    bestLegStreak = Math.max(bestLegStreak, legStreak);
    if (legStreak >= 8) A('hab-legs');
    if ((['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] as MuscleGroup[]).every((g) => groups.has(g))) A('hab-fullbody');
    if (s.exercises.filter((e) => e.sets.some((x) => x.reps > 0)).length >= 8) A('hab-variety');
    if (reps >= 500) A('hab-reps');
    if ((s.watch?.avgHr ?? 0) >= 140 && minutes >= 45) A('hab-heart');
    if (firstVisit && s.date >= addDays(firstVisit, 365)) A('hab-anniversary');
    // weather & holidays
    if (rainDays >= 1) A('wx-rain-1');
    if (rainDays >= 10) A('wx-rain-10');
    if (temp !== undefined && temp <= 5) A('wx-cold');
    if (temp !== undefined && temp <= 0) A('wx-freeze');
    if (temp !== undefined && temp >= 33) A('wx-heat');
    if (holidayDays >= 1) A('hol-1');
    if (holidayDays >= 5) A('hol-5');
    if (holidayNames.size >= 10) A('hol-10');
    const md = s.date.slice(5);
    if (md >= '01-01' && md <= '01-07') A('hol-newyear');
    if (md >= '12-24' && md <= '12-26') A('hol-xmas');
    // special
    if (minutes >= 90) A('special-marathon');
    if (volume >= 10000) A('special-beast');
    if (s.startTime && s.startTime < '07:00') A('special-early');
    if (s.startTime && s.startTime >= '21:00') A('special-night');
    if ((monthVisits.get(s.date.slice(0, 7)) ?? 0) >= 12) A('special-month');
    if (prs.length >= 3) A('special-double');

    totalXp += xp;
    if (firstOfDay) lastVisit = s.date;
    results.set(s.id, {
      id: s.id, date: s.date, xp, items, volume, sets, prs, newExercises, streakWeeks, multiplier,
      xpBefore, xpAfter: totalXp, visitsBefore, visitsAfter: visitDays.size, holiday,
      achievements: unlocked.slice(achStart),
    });
    pushTimeline(s.date);
  }

  // current streak as of today
  const thisWeek = weekKey(today());
  const thisWeekVisits = weekVisits.get(thisWeek) ?? 0;
  const weekStreak = goalWeeks.has(thisWeek) ? consecutive(goalWeeks, thisWeek) : consecutive(goalWeeks, addDays(thisWeek, -7));
  const thisWeekQuests = curWeek === thisWeek ? quests : pickQuests(thisWeek, questCtx(thisWeek));
  const curSeasonKey = seasonOf(today(), goal).key;

  const progress: Record<string, number> = {};
  const metric: Record<string, number> = {
    visits: visitDays.size, volume: totalVolume, streak: bestStreak, prs: prCount,
    explorer: seen.size, sets: totalSets, time: totalMinutes, burn: totalKcal,
  };
  for (const a of ACHIEVEMENTS) {
    const prefix = a.id.split('-')[0];
    if (a.target && prefix in metric) progress[a.id] = metric[prefix];
  }
  Object.assign(progress, {
    'body-10': weighInCount, 'hab-monday': mondays, 'hab-legs': bestLegStreak,
    'wx-rain-10': rainDays, 'hol-5': holidayDays, 'hol-10': holidayNames.size,
  });

  return {
    totalXp,
    level: levelInfo(totalXp, visitDays.size),
    sessions: results,
    weighIns,
    unlocked,
    unlockedIds,
    progress,
    visits: visitDays.size,
    totalVolume,
    totalSets,
    totalMinutes,
    totalKcal,
    prCount,
    exercisesTried: seen.size,
    bests,
    history,
    maxPullups: hero.pull.strict,
    hero: heroSnapshot(weekMuscle.has(thisWeek) ? thisWeek : addDays(thisWeek, -7), weights[weights.length - 1]?.kg ?? 0),
    heroBodyweightKnown: weights.length > 0,
    bodyweight: weights[weights.length - 1]?.kg ?? 0,
    weekStreak,
    bestWeekStreak: bestStreak,
    thisWeekVisits,
    timeline,
    quests: thisWeekQuests,
    seasons: [...seasons.values()].sort((a, b) => a.key.localeCompare(b.key)),
    season: seasons.get(curSeasonKey) ?? seasonOf(today(), goal),
  };
}

/** Next milestone in the "Visits" family, for the dashboard. */
export function nextVisitMilestone(visits: number): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.category === 'Visits' && (a.target ?? 0) > visits);
}
