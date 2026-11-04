// GymXP game engine. docs/GAME_DESIGN.md explains why the rules are what they are.
// Everything is derived from the raw log, so editing or deleting a past session
// recomputes stars, levels, records, streaks and trophies consistently.
import type { AppData, Exercise, MuscleGroup, Profile, Session, SetEntry } from './types';
import { FEATURES } from './features';
import { weekKey, addDays, today, parseDate } from './util';
import { holidayOn } from './holidays';
import { capacityFrom, emptyCapacity, HERO_IDS, HERO_TARGETS, HERO_VOLUME_WEEKS, HERO_STAGES, heroMuscle, ladderWork, scoreHero, type Capacity, type HeroMuscle, type HeroResult } from './hero';
import { ACH_BY_ID, ACHIEVEMENTS, ALLSTAR_TIERS, BURN_TIERS, EXPLORER_TIERS, GAIN_TIERS, MEDAL_TIERS, PERFECT_TIERS, PR_TIERS, SET_TIERS, STREAK_TIERS, STRENGTH, TIME_TIERS, VISIT_TIERS, VOLUME_TIERS, type AchievementDef, type Tier, type UnlockedAchievement } from './trophies';

export const RULES = {
  workSets: 10, // ★ Do the work: completed sets in one gym day…
  workMinutes: 30, // …or logged minutes, for a cardio day
  recordCap: 3, // +1 star per record, at most this many per workout
  perfectGoalCap: 5, // goals above this pay like it: nothing should reward skipping rest days
  importedStarCap: 960, // level 31, Gold Lifter: imported history is a head start, not a shortcut
  challengeStars: 2,
  surpriseStars: 1, // comeback, rain, cold, heat or feriado, once per gym day
  seasonMedalStars: 3,
  startShields: 1,
  maxShields: 2,
  perfectWeeksPerShield: 4,
};

// ---------- Levels and ranks ----------
// Reaching level n takes n² − 1 total stars, so the next level always costs 2n + 1.

export const starsForLevel = (level: number) => level * level - 1;

export const levelForStars = (stars: number) => Math.max(1, Math.floor(Math.sqrt(Math.max(0, stars) + 1)));

export interface Rank {
  minLevel: number;
  title: string;
  color: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, title: 'Rookie', color: '#9aa3b2' },
  { minLevel: 2, title: 'Beginner', color: '#a3c4a8' },
  { minLevel: 4, title: 'Regular', color: '#7bd389' },
  { minLevel: 6, title: 'Committed', color: '#5fd0a0' },
  { minLevel: 8, title: 'Iron Apprentice', color: '#6fb1d6' },
  { minLevel: 10, title: 'Iron Adept', color: '#5a8dee' },
  { minLevel: 15, title: 'Bronze Lifter', color: '#cd8a4f' },
  { minLevel: 21, title: 'Silver Lifter', color: '#c7d0dc' },
  { minLevel: 31, title: 'Gold Lifter', color: '#f5c542' },
  { minLevel: 38, title: 'Platinum Lifter', color: '#7fe0d6' },
  { minLevel: 45, title: 'Diamond Lifter', color: '#8fd3ff' },
  { minLevel: 53, title: 'Athlete', color: '#9fe870' },
  { minLevel: 61, title: 'Elite', color: '#b388ff' },
  { minLevel: 70, title: 'Master', color: '#d17bff' },
  { minLevel: 84, title: 'Grandmaster', color: '#ff7ad9' },
  { minLevel: 100, title: 'Titan', color: '#ff7a59' },
  { minLevel: 112, title: 'Demigod', color: '#ffa45c' },
  { minLevel: 125, title: 'Olympian', color: '#ffd166' },
];

export function rankFor(level: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.minLevel) r = x;
  return r;
}

export interface LevelInfo {
  level: number;
  stars: number;
  into: number; // stars earned inside the current level
  span: number; // stars the current level costs
  pct: number;
  rank: Rank;
  nextRank?: Rank;
}

export function levelInfo(stars: number): LevelInfo {
  const level = levelForStars(stars);
  const base = starsForLevel(level);
  const span = starsForLevel(level + 1) - base;
  const rank = rankFor(level);
  return { level, stars, into: stars - base, span, pct: (stars - base) / span, rank, nextRank: RANKS[RANKS.indexOf(rank) + 1] };
}

// ---------- Streak, flames and Perfect Weeks ----------
// The streak only asks for one workout a week. The weekly goal pays separately as a Perfect
// Week, and the longer the streak, the more a Perfect Week pays.

export interface Flame { min: number; name: string; mult: number }

export const FLAMES: Flame[] = [
  { min: 0, name: 'Spark', mult: 1 },
  { min: 4, name: 'Flame', mult: 1.5 },
  { min: 12, name: 'Blaze', mult: 2 },
  { min: 26, name: 'Inferno', mult: 2.5 },
  { min: 52, name: 'Eternal', mult: 3 },
];

export function flameFor(weeks: number): Flame {
  let f = FLAMES[0];
  for (const x of FLAMES) if (weeks >= x.min) f = x;
  return f;
}

export const perfectWeekStars = (goal: number, streakWeeks: number) => Math.round(Math.min(goal, RULES.perfectGoalCap) * flameFor(streakWeeks).mult);

/** The weekly goal in force for a week (Monday). Changing it never rewrites past weeks. */
export function goalAt(p: Profile, week: string): number {
  let goal = p.goalHistory?.[0]?.goal ?? p.weeklyGoal;
  for (const h of p.goalHistory ?? []) if (h.from <= week) goal = h.goal;
  return Math.max(1, goal || 3);
}

/** Set a new weekly goal. With workouts already logged it takes effect next Monday. */
export function withWeeklyGoal(p: Profile, goal: number, date: string, hasWorkouts: boolean): Profile {
  if (!hasWorkouts) return { ...p, weeklyGoal: goal, goalHistory: undefined };
  const week = weekKey(date);
  const past = (p.goalHistory?.length ? p.goalHistory : [{ from: '', goal: p.weeklyGoal }]).filter((h) => h.from <= week);
  const current = past[past.length - 1].goal;
  return { ...p, weeklyGoal: goal, goalHistory: current === goal ? past : [...past, { from: addDays(week, 7), goal }] };
}

// ---------- Beat your last ----------

export interface Beat {
  exerciseId: string;
  beat: boolean;
  first: boolean; // first time on this exercise: sets the baseline, counts as a beat
  kg: number; // change in top weight (positive = better, so less assistance on assisted machines)
  reps: number; // change in total reps (seconds for holds, best rounds or rungs for benchmarks)
}

/** More weight, or the same weight and more reps, compared with the last time. */
export function compareToLast(ex: Exercise | undefined, exerciseId: string, sets: SetEntry[], last: SetEntry[] | undefined): Beat {
  if (!last?.length) return { exerciseId, beat: true, first: true, kg: 0, reps: 0 };
  const kgs = sets.map((s) => s.kg), lastKgs = last.map((s) => s.kg);
  if (ex?.benchmark) {
    const best = Math.max(...sets.map((s) => s.reps)), lastBest = Math.max(...last.map((s) => s.reps));
    const faster = ex.benchmark === 'ladder' && best >= 19 && lastBest >= 19 ? Math.max(0, Math.min(...lastKgs) - Math.min(...kgs)) : 0;
    return { exerciseId, beat: best > lastBest || faster > 0, first: false, kg: faster, reps: best - lastBest };
  }
  const kg = ex?.assisted ? Math.min(...lastKgs) - Math.min(...kgs) : Math.max(...kgs) - Math.max(...lastKgs);
  const reps = sets.reduce((n, s) => n + s.reps, 0) - last.reduce((n, s) => n + s.reps, 0);
  return { exerciseId, beat: kg > 0 || (kg === 0 && reps > 0), first: false, kg, reps };
}

/** ★3 needs at least half the day's exercises beaten, rounded up. */
export const beatsNeeded = (exercises: number) => Math.ceil(exercises / 2);

// ---------- Seasons (calendar quarters) ----------
// A fresh scoreboard every 3 months, counted in Perfect Weeks. Levels never reset.

export interface SeasonTier { name: string; icon: string; need?: number; color: string } // no `need`: every week of the season

export const SEASON_TIERS: SeasonTier[] = [
  { name: 'Bronze', icon: '🥉', need: 4, color: '#cd8a4f' },
  { name: 'Silver', icon: '🥈', need: 7, color: '#c7d0dc' },
  { name: 'Gold', icon: '🥇', need: 10, color: '#f5c542' },
  { name: 'Platinum', icon: '💠', need: 12, color: '#7fe0d6' },
  { name: 'Champion', icon: '👑', color: '#ffd166' },
];

export interface SeasonState {
  key: string; // 2026-Q4
  label: string; // Spring 2026 (southern hemisphere)
  start: string;
  end: string;
  weeks: number; // weeks (by Monday) in the season
  perfect: number; // Perfect Weeks so far
  tier: number; // index into SEASON_TIERS, -1 = none yet
}

export const seasonTarget = (t: SeasonTier, s: Pick<SeasonState, 'weeks'>) => t.need ?? s.weeks;

const SEASON_NAMES = ['Summer', 'Autumn', 'Winter', 'Spring']; // Jan–Mar … Oct–Dec in Argentina

const seasonWeeks = new Map<string, number>(); // walking a quarter day by day is the engine's slowest step

export function seasonOf(date: string): SeasonState {
  const y = Number(date.slice(0, 4));
  const q = Math.floor((Number(date.slice(5, 7)) - 1) / 3);
  const key = `${y}-Q${q + 1}`;
  const start = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const end = addDays(q === 3 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 4).padStart(2, '0')}-01`, -1);
  let weeks = seasonWeeks.get(key);
  if (weeks === undefined) {
    weeks = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (parseDate(d).getDay() === 1) weeks++;
    seasonWeeks.set(key, weeks);
  }
  return { key, label: `${SEASON_NAMES[q]} ${y}`, start, end, weeks, perfect: 0, tier: -1 };
}

// ---------- Weekly challenge ----------
// One per week, picked deterministically from the week and your history.

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
  { id: 'benchmark', icon: '🕷️', title: () => 'Test a Hero benchmark: the Ladder or Cindy (scaled is fine)', target: () => 1, value: (s) => s.benchmark, eligible: (c) => FEATURES.hero && c.visits >= 8 && !c.benchRecent },
  { id: 'early', icon: '⚡', title: () => 'Reach your weekly goal by Thursday', target: (c) => c.goal, value: (s) => s.visitsByThu, eligible: (c) => c.goal <= 4 },
];

export interface QuestStatus { id: string; icon: string; title: string; target: number; value: number; done: boolean; stars: number }

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Each quest gets its own hash, so changing the pool never reshuffles other weeks.
function pickChallenge(week: string, c: QuestCtx): QuestStatus | null {
  let pick: QuestDef | null = null;
  let best = Infinity;
  for (const q of QUESTS) {
    if (!q.eligible(c)) continue;
    const h = hashStr(`gymxp:${week}:${q.id}`);
    if (h < best) [pick, best] = [q, h];
  }
  return pick && { id: pick.id, icon: pick.icon, title: pick.title(c), target: pick.target(c), value: 0, done: false, stars: RULES.challengeStars };
}

const emptyWeek = (): WeekStats => ({ visits: 0, sets: 0, volume: 0, prs: 0, legs: 0, groups: new Set(), weighIns: 0, maxMinutes: 0, weekend: 0, newEx: 0, maxExInSession: 0, visitsByThu: 0, calisReps: 0, backSets: 0, chestSets: 0, benchmark: 0 });

// ---------- Machine medals (Battlefield weapon mastery) ----------
// +1 point per workout on a machine, +2 more when you beat your last time on it.

export const MEDALS = [
  { n: 10, name: 'Bronze', icon: '🥉' },
  { n: 30, name: 'Silver', icon: '🥈' },
  { n: 75, name: 'Gold', icon: '🥇' },
  { n: 150, name: 'Platinum', icon: '💠' },
  { n: 300, name: 'Diamond', icon: '💎' },
  { n: 600, name: 'Master', icon: '👑' },
];

export function medalOf(points: number) {
  let tier = -1;
  MEDALS.forEach((m, i) => { if (points >= m.n) tier = i; });
  const next = MEDALS[tier + 1];
  const from = tier >= 0 ? MEDALS[tier].n : 0;
  return { tier, current: tier >= 0 ? MEDALS[tier] : null, next, pct: next ? (points - from) / (next.n - from) : 1 };
}

// ---------- Engine ----------

export interface StarItem {
  label: string;
  stars: number;
  kind: 'workout' | 'record' | 'perfect' | 'season' | 'challenge' | 'surprise' | 'trophy';
}

export interface PR {
  exerciseId: string;
  kind: 'weight' | 'e1rm' | 'assist' | 'reps' | 'rounds' | 'rungs' | 'time' | 'hold';
  value: number;
  prev: number;
}

export interface MedalUp { exerciseId: string; name: string; icon: string }

export interface SessionResult {
  id: string;
  date: string;
  stars: number; // every star this workout earned, bonuses included
  dayStars: number; // the 1–3 rating of this gym day
  checks: { show: boolean; work: boolean; beat: boolean };
  firstEver: boolean; // the first workout ever earns all 3 stars
  beats: Beat[];
  items: StarItem[];
  volume: number;
  sets: number;
  prs: PR[];
  newExercises: string[];
  streakWeeks: number;
  perfectWeek: boolean;
  medalUps: MedalUp[];
  starsBefore: number;
  starsAfter: number;
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
  points: number; // machine medal points
  gain: number | null; // strength gained since the first session (0.37 = +37 %)
}

export interface ExerciseHistoryPoint {
  date: string;
  sessionId: string;
  bestKg: number;
  bestE1rm: number;
  volume: number;
  sets: { kg: number; reps: number }[];
}

export interface StreakState {
  weeks: number; // current streak, shield-protected weeks don't add to it
  best: number;
  shields: number;
  flame: Flame;
  lastBreak?: { weeks: number; week: string }; // the most recent streak that ended, and when
}

export interface GameState {
  totalStars: number;
  level: LevelInfo;
  sessions: Map<string, SessionResult>;
  unlocked: UnlockedAchievement[];
  unlockedIds: Set<string>;
  progress: Record<string, number>; // metric values for locked trophies
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
  streak: StreakState;
  perfectWeeks: number;
  perfectThisWeek: boolean;
  weekGoal: number; // the goal in force this week
  thisWeekVisits: number;
  timeline: { date: string; stars: number }[]; // cumulative stars after each day with activity
  challenge: QuestStatus | null; // this week's
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

/** Timed holds (plank) count one rep of volume per this many seconds held. */
export const HOLD_SECONDS_PER_REP = 3;

export function effectiveLoad(ex: Exercise | undefined, kg: number, bw: number): number {
  if (ex?.assisted) return Math.max(0, bw - kg);
  if (ex?.bwFactor) return kg * (ex.vestMult ?? 1) + ex.bwFactor * bw;
  return kg * (ex?.loadFactor ?? 1);
}

interface DayState { stars: number; sets: number; minutes: number; exercises: Set<string>; beaten: Set<string>; firstEver: boolean }

export function computeGame(data: AppData, exMap: Map<string, Exercise>): GameState {
  const bwAt = bodyweightLookup(data);
  const sessions = sortSessions(data.sessions);
  const weights = data.weights.filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt);

  type Ev = { date: string; order: number; kind: 's'; s: Session } | { date: string; order: number; kind: 'w'; w: (typeof weights)[number] };
  const events: Ev[] = [
    ...weights.map((w, i) => ({ date: w.date, order: i, kind: 'w' as const, w })),
    ...sessions.map((s, i) => ({ date: s.date, order: 100000 + i, kind: 's' as const, s })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let totalStars = 0, importedStars = 0;
  const results = new Map<string, SessionResult>();
  const unlocked: UnlockedAchievement[] = [];
  const unlockedIds = new Set<string>();
  const visitDays = new Set<string>();
  const days = new Map<string, DayState>();
  const weekVisits = new Map<string, number>();
  const monthVisits = new Map<string, number>();
  const seen = new Set<string>();
  const bests = new Map<string, ExerciseBest>();
  const history = new Map<string, ExerciseHistoryPoint[]>();
  const lastSets = new Map<string, SetEntry[]>();
  const timeline: { date: string; stars: number }[] = [];
  const weekGroups = new Map<string, Set<MuscleGroup>>();
  const legWeeks = new Set<string>();
  const prStreak = new Map<string, number>();
  const holidayNames = new Set<string>();
  let totalVolume = 0, totalSets = 0, totalMinutes = 0, totalKcal = 0, prCount = 0, weighInCount = 0;
  let rainDays = 0, holidayDays = 0, bestLegStreak = 0, threeStarDays = 0, bestPoints = 0, bestGain = 0, bestSeasonTier = -1;
  const monthVolume = new Map<string, number>();

  // --- streak ---
  let streak = 0, bestStreak = 0, shields = RULES.startShields, perfectWeeks = 0, lastActiveWeek = '';
  let lastBreak: StreakState['lastBreak'];
  const perfectSet = new Set<string>();
  // Empty weeks since the last workout: a shield covers each one, without one the streak ends.
  const settleGaps = (upTo: string) => {
    if (!lastActiveWeek) return;
    for (let w = addDays(lastActiveWeek, 7); w < upTo; w = addDays(w, 7)) {
      if (shields > 0) shields--;
      else if (streak > 0) {
        lastBreak = { weeks: streak, week: w };
        streak = 0;
      }
    }
  };

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

  const unlock = (id: string, date: string, sink: StarItem[] | null, sessionId?: string) => {
    if (unlockedIds.has(id)) return 0;
    const def = ACH_BY_ID.get(id);
    if (!def) return 0;
    unlockedIds.add(id);
    unlocked.push({ ...def, date, sessionId });
    sink?.push({ label: `${def.icon} ${def.title}`, stars: def.stars, kind: 'trophy' });
    return def.stars;
  };
  const checkTiers = (prefix: string, tiers: Tier[], value: number, date: string, sink: StarItem[] | null, sessionId?: string) => {
    let stars = 0;
    for (const t of tiers) if (value >= t.n) stars += unlock(`${prefix}-${t.n}`, date, sink, sessionId);
    return stars;
  };
  const consecutive = (set: Set<string>, wk: string) => {
    let n = 0;
    for (let w = wk; set.has(w); w = addDays(w, -7)) n++;
    return n;
  };
  const pushTimeline = (date: string) => {
    const last = timeline[timeline.length - 1];
    if (last && last.date === date) last.stars = totalStars;
    else timeline.push({ date, stars: totalStars });
  };

  // --- seasons & the weekly challenge ---
  const seasons = new Map<string, SeasonState>();
  const seasonFor = (date: string) => {
    const fresh = seasonOf(date);
    let ss = seasons.get(fresh.key);
    if (!ss) { ss = fresh; seasons.set(ss.key, ss); }
    return ss;
  };
  const weekVolume = new Map<string, number>();
  let hasWatch = false;
  let curWeek = '';
  let week = emptyWeek();
  let challenge: QuestStatus | null = null;
  const questCtx = (beforeWeek: string): QuestCtx => {
    const recent = [...weekVolume.entries()].filter(([k, v]) => k < beforeWeek && v > 0).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
    const avgVol = recent.length >= 2 ? recent.reduce((a, [, v]) => a + v, 0) / recent.length : 0;
    const benchRecent = [0, 1, 2, 3].some((i) => benchmarkWeeks.has(addDays(beforeWeek, -7 * (i + 1))));
    return { goal: goalAt(data.profile, beforeWeek), avgVol, seen: seen.size, exTotal: exMap.size, hasWatch, visits: visitDays.size, benchRecent };
  };
  const enterWeek = (wk: string) => {
    if (wk === curWeek) return;
    curWeek = wk;
    week = emptyWeek();
    challenge = pickChallenge(wk, questCtx(wk));
  };
  const checkChallenge = (award: (label: string, stars: number) => void) => {
    const c = challenge;
    if (!c) return;
    c.value = QUESTS.find((d) => d.id === c.id)!.value(week);
    if (!c.done && c.value >= c.target) {
      c.done = true;
      award(`${c.icon} Challenge: ${c.title}`, c.stars);
    }
  };

  for (const ev of events) {
    if (ev.kind === 'w') {
      const w = ev.w;
      weighInCount++;
      let stars = 0;
      enterWeek(weekKey(w.date));
      week.weighIns++;
      checkChallenge((_, v) => { stars += v; });
      stars += unlock('body-first', w.date, null);
      if (weighInCount >= 10) stars += unlock('body-10', w.date, null);
      const goalKg = data.profile.goalWeightKg;
      if (goalKg && firstWeight !== undefined && firstWeight !== goalKg) {
        const reached = firstWeight > goalKg ? w.kg <= goalKg : w.kg >= goalKg;
        if (reached) stars += unlock('body-goal', w.date, null);
      }
      totalStars += stars;
      pushTimeline(w.date);
      continue;
    }

    const s = ev.s;
    const items: StarItem[] = [];
    const starsBefore = totalStars;
    const visitsBefore = visitDays.size;
    const bw = bwAt(s.date);
    const wk = weekKey(s.date);
    enterWeek(wk);
    const dow = parseDate(s.date).getDay(); // 0 = Sunday
    const goal = goalAt(data.profile, wk);

    // --- showing up: the gym day, the week, the streak ---
    const firstOfDay = !visitDays.has(s.date);
    const firstEver = visitsBefore === 0 && !s.estimated;
    const gapDays = lastVisit ? Math.round((parseDate(s.date).getTime() - parseDate(lastVisit).getTime()) / 86400000) : 0;
    const missedAWeek = !!lastVisit && !weekVisits.has(wk) && !weekVisits.has(addDays(wk, -7));
    if (firstOfDay) {
      visitDays.add(s.date);
      weekVisits.set(wk, (weekVisits.get(wk) ?? 0) + 1);
      const mk = s.date.slice(0, 7);
      monthVisits.set(mk, (monthVisits.get(mk) ?? 0) + 1);
      if (wk !== lastActiveWeek) {
        settleGaps(wk);
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        lastActiveWeek = wk;
      }
    }

    let day = days.get(s.date);
    if (!day) { day = { stars: 0, sets: 0, minutes: 0, exercises: new Set(), beaten: new Set(), firstEver }; days.set(s.date, day); }

    let sets = 0;
    let volume = 0;
    let reps = 0;
    let maxSetLoad = 0, maxShortSet = 0, lightWeight = false, strongCarry = false; // for the legend challenges
    const prs: PR[] = [];
    const beats: Beat[] = [];
    const medalUps: MedalUp[] = [];
    const newExercises: string[] = [];
    const groups = weekGroups.get(wk) ?? new Set<MuscleGroup>();
    weekGroups.set(wk, groups);
    const strengthHits: { ex: string; kg: number }[] = [];
    for (const log of s.exercises) {
      const ex = exMap.get(log.exerciseId);
      const done = log.sets.filter((x) => x.reps > 0);
      if (!done.length) continue;
      const cmp = compareToLast(ex, log.exerciseId, done, lastSets.get(log.exerciseId));
      lastSets.set(log.exerciseId, done);
      beats.push(cmp);
      const earnsBeat = cmp.beat && !s.estimated; // imported workouts are guesses
      day.exercises.add(log.exerciseId);
      if (earnsBeat) day.beaten.add(log.exerciseId);

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
        const load = effectiveLoad(ex, st.kg, bw || (ex?.bwFactor || ex?.assisted ? 70 : 0));
        if (ex?.hold) { // seconds, not reps: no rep count or strength estimate, gentle volume
          exVol += load * (st.reps / HOLD_SECONDS_PER_REP);
          bestKg = Math.max(bestKg, st.kg);
          if (log.exerciseId === 'Farmers_Walk' && st.kg >= 30 && st.reps >= 60) strongCarry = true;
          continue;
        }
        reps += bench === 'cindy' ? st.reps * 30 : st.reps;
        exVol += load * st.reps;
        if (!bench) {
          maxSetLoad = Math.max(maxSetLoad, load * st.reps);
          if (st.reps <= 5) maxShortSet = Math.max(maxShortSet, load * st.reps);
          if (load >= 100 && st.reps >= 12) lightWeight = true;
        }
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
          maxReps: bestReps, maxRepsDate: s.date, sessions: 1, lastDate: s.date, points: 0, gain: null,
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
        } else if (bodyweightEx || ex?.hold) {
          if (bestKg > prev.maxKg && bestKg > 0) {
            prs.push({ exerciseId: log.exerciseId, kind: 'weight', value: bestKg, prev: prev.maxKg });
            prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
          } else if (bestReps > prev.maxReps) {
            prs.push({ exerciseId: log.exerciseId, kind: ex?.hold ? 'hold' : 'reps', value: bestReps, prev: prev.maxReps });
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
      // --- machine medal ---
      const best = bests.get(log.exerciseId);
      if (best) {
        const tierBefore = medalOf(best.points).tier;
        best.points += 1 + (earnsBeat ? 2 : 0);
        const m = medalOf(best.points);
        if (m.tier > tierBefore && m.current) medalUps.push({ exerciseId: log.exerciseId, name: m.current.name, icon: m.current.icon });
        const t = strength.get(log.exerciseId);
        best.gain = t && t.base > 0 ? t.best / t.base - 1 : null;
        bestPoints = Math.max(bestPoints, best.points);
        if (best.sessions >= 5 && best.gain !== null) bestGain = Math.max(bestGain, best.gain * 100);
      }
      prStreak.set(log.exerciseId, weightPr ? (prStreak.get(log.exerciseId) ?? 0) + 1 : 0);
      const h = history.get(log.exerciseId) ?? [];
      h.push({ date: s.date, sessionId: s.id, bestKg: bestKg === Infinity ? 0 : bestKg, bestE1rm: bestE, volume: exVol, sets: done.map((d) => ({ kg: d.kg, reps: d.reps })) });
      history.set(log.exerciseId, h);
    }
    if (groups.has('Legs')) legWeeks.add(wk);

    const minutes = s.watch?.durationMin ?? 0;
    const kcal = s.watch?.kcal ?? 0;

    // --- workout stars: a gym day earns 1–3, and a second workout can only add to them ---
    day.sets += sets;
    day.minutes += minutes;
    const checks = day.firstEver
      ? { show: true, work: true, beat: true }
      : { show: true, work: day.sets >= RULES.workSets || day.minutes >= RULES.workMinutes, beat: day.exercises.size > 0 && day.beaten.size >= beatsNeeded(day.exercises.size) };
    const earnedNow = 1 + (checks.work ? 1 : 0) + (checks.beat ? 1 : 0);
    const gained = Math.max(0, earnedNow - day.stars);
    if (day.stars < 3 && earnedNow === 3) threeStarDays++;
    day.stars = Math.max(day.stars, earnedNow);
    let stars = gained;
    if (gained) items.push({ label: 'Workout', stars: gained, kind: 'workout' });

    // --- records ---
    prs.forEach((pr, i) => {
      const name = exMap.get(pr.exerciseId)?.name ?? 'Unknown';
      const what = pr.kind === 'weight' ? `${pr.value} kg` : pr.kind === 'assist' ? `less assist (${pr.value} kg)` : pr.kind === 'reps' ? `${pr.value} reps` : pr.kind === 'hold' ? `${pr.value} s`
        : pr.kind === 'rounds' ? `${pr.value} rounds` : pr.kind === 'rungs' ? `${pr.value} rungs` : pr.kind === 'time' ? `${pr.value} min` : 'best set';
      const paid = !s.estimated && i < RULES.recordCap ? 1 : 0;
      items.push({ label: `🏆 ${name}: ${what}`, stars: paid, kind: 'record' });
      stars += paid;
    });
    prCount += prs.length;

    // --- one surprise star per gym day ---
    const holiday = holidayOn(s.date);
    const temp = s.weather?.tempC;
    const rain = !!s.weather?.rain;
    if (firstOfDay) {
      if (holiday) { holidayDays++; holidayNames.add(holiday.replace(' (trasladado)', '')); }
      if (rain) rainDays++;
      const surprise = missedAWeek ? '🔄 Welcome back' : holiday ? `🧉 Feriado: ${holiday}` : rain ? '🌧️ Trained in the rain'
        : temp !== undefined && temp <= 0 ? `❄️ Freezing (${temp} °C)` : temp !== undefined && temp <= 5 ? `🥶 Cold day (${temp} °C)` : temp !== undefined && temp >= 33 ? `🥵 Heatwave (${temp} °C)` : '';
      if (surprise) {
        items.push({ label: surprise, stars: RULES.surpriseStars, kind: 'surprise' });
        stars += RULES.surpriseStars;
      }
    }

    // --- Perfect Week, shields and the season medal ---
    let perfectWeek = false;
    if (firstOfDay && weekVisits.get(wk) === goal) {
      perfectWeek = true;
      perfectWeeks++;
      perfectSet.add(wk);
      if (perfectWeeks % RULES.perfectWeeksPerShield === 0) shields = Math.min(RULES.maxShields, shields + 1);
      const pay = perfectWeekStars(goal, streak);
      items.push({ label: `🔥 Perfect Week · ${streak}-week streak ×${flameFor(streak).mult}`, stars: pay, kind: 'perfect' });
      stars += pay;
      const season = seasonFor(wk);
      season.perfect++;
      for (let i = season.tier + 1; i < SEASON_TIERS.length; i++) {
        const t = SEASON_TIERS[i];
        if (season.perfect < seasonTarget(t, season)) break;
        season.tier = i;
        items.push({ label: `${t.icon} ${season.label} season: ${t.name}`, stars: RULES.seasonMedalStars, kind: 'season' });
        stars += RULES.seasonMedalStars;
      }
      bestSeasonTier = Math.max(bestSeasonTier, season.tier);
    }

    // --- weekly challenge ---
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
    checkChallenge((label, v) => { items.push({ label, stars: v, kind: 'challenge' }); stars += v; });

    totalVolume += volume;
    monthVolume.set(s.date.slice(0, 7), (monthVolume.get(s.date.slice(0, 7)) ?? 0) + volume);
    totalSets += sets;
    totalMinutes += minutes;
    totalKcal += kcal;

    // --- trophies ---
    const achStart = unlocked.length;
    const A = (id: string) => { stars += unlock(id, s.date, items, s.id); };
    stars += checkTiers('visits', VISIT_TIERS, visitDays.size, s.date, items, s.id);
    stars += checkTiers('volume', VOLUME_TIERS, totalVolume, s.date, items, s.id);
    stars += checkTiers('streak', STREAK_TIERS, streak, s.date, items, s.id);
    stars += checkTiers('prs', PR_TIERS, prCount, s.date, items, s.id);
    stars += checkTiers('explorer', EXPLORER_TIERS, seen.size, s.date, items, s.id);
    stars += checkTiers('sets', SET_TIERS, totalSets, s.date, items, s.id);
    stars += checkTiers('time', TIME_TIERS, totalMinutes, s.date, items, s.id);
    stars += checkTiers('burn', BURN_TIERS, totalKcal, s.date, items, s.id);
    stars += checkTiers('perfect', PERFECT_TIERS, perfectWeeks, s.date, items, s.id);
    stars += checkTiers('allstar', ALLSTAR_TIERS, threeStarDays, s.date, items, s.id);
    stars += checkTiers('medal', MEDAL_TIERS, bestPoints, s.date, items, s.id);
    stars += checkTiers('gain', GAIN_TIERS, bestGain, s.date, items, s.id);
    if (bestSeasonTier >= SEASON_TIERS.findIndex((t) => t.name === 'Gold')) A('season-gold');
    if (bestSeasonTier >= SEASON_TIERS.length - 1) A('season-champion');
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
    if (FEATURES.hero) {
      if (hero.cindy >= 10) A('hero-cindy-10');
      if (hero.cindy >= 15) A('hero-cindy-15');
      if (hero.cindy >= 20) A('hero-cindy-20');
      if (hero.ladderRungs >= 19) A('hero-ladder');
      if (hero.ladderMin && hero.ladderMin <= 45) A('hero-ladder-45');
      const heroNow = heroSnapshot(wk, bw);
      HERO_STAGES.forEach((st, i) => { if (i > 0 && heroNow.pct >= st.min) A(`hero-stage-${i}`); });
    }
    if ([...prStreak.values()].some((v) => v >= 3)) A('hab-overload');
    // habits
    if (firstOfDay && gapDays >= 14 && visitsBefore >= 3) A('hab-comeback');
    if (dow === 0 && visitDays.has(addDays(s.date, -1))) A('hab-weekend');
    const legStreak = consecutive(legWeeks, wk);
    bestLegStreak = Math.max(bestLegStreak, legStreak);
    if (legStreak >= 8) A('hab-legs');
    if ((['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] as MuscleGroup[]).every((g) => groups.has(g))) A('hab-fullbody');
    if (s.exercises.filter((e) => e.sets.some((x) => x.reps > 0)).length >= 8) A('hab-variety');
    if (reps >= 500) A('hab-reps');
    if ((s.watch?.avgHr ?? 0) >= 140 && minutes >= 45) A('hab-heart');
    if (firstVisit && s.date >= addDays(firstVisit, 365)) A('hab-anniversary');
    if (firstVisit && s.date >= addDays(firstVisit, 1826)) A('hab-anniversary-5');
    if (firstVisit && s.date >= addDays(firstVisit, 3652)) A('hab-anniversary-10');
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
    // legend challenges, for real workouts only
    if (!s.estimated) {
      if (day.sets >= 20) A('leg-arnold-pump');
      if ((weekVisits.get(wk) ?? 0) >= 6) A('leg-arnold-split');
      if (consecutive(perfectSet, wk) >= 7) A('leg-arnold-seven');
      if (lightWeight) A('leg-ronnie-light');
      if (week.prs >= 8) A('leg-ronnie-records');
      if ([...seasons.values()].filter((x) => x.tier >= 0).length >= 8) A('leg-ronnie-eight');
      if (maxSetLoad >= 500) A('leg-eddie-500');
      if (volume >= 5000) A('leg-eddie-ten');
      if (week.volume >= 25000) A('leg-eddie-week');
      if (strongCarry) A('leg-thor-carry');
      if (maxShortSet >= 501) A('leg-thor-501');
      if ((monthVolume.get(s.date.slice(0, 7)) ?? 0) >= 100000) A('leg-thor-mountain');
    }

    // Past the cap, imported workouts still count for your streak and trophies but stop paying stars.
    if (s.estimated) {
      let left = Math.min(stars, Math.max(0, RULES.importedStarCap - importedStars));
      importedStars += left;
      stars = left;
      for (const it of items) { it.stars = Math.min(it.stars, left); left -= it.stars; }
    }

    totalStars += stars;
    if (firstOfDay) lastVisit = s.date;
    results.set(s.id, {
      id: s.id, date: s.date, stars, dayStars: day.stars, checks, firstEver: day.firstEver, beats, items, volume, sets, prs, newExercises,
      streakWeeks: streak, perfectWeek, medalUps, starsBefore, starsAfter: totalStars, visitsBefore, visitsAfter: visitDays.size, holiday,
      achievements: unlocked.slice(achStart),
    });
    pushTimeline(s.date);
  }

  // Where things stand today: weeks that passed with no workout are settled now.
  const thisWeek = weekKey(today());
  settleGaps(thisWeek);
  const curSeason = seasonOf(thisWeek);

  const progress: Record<string, number> = {};
  const metric: Record<string, number> = {
    visits: visitDays.size, volume: totalVolume, streak: bestStreak, prs: prCount,
    explorer: seen.size, sets: totalSets, time: totalMinutes, burn: totalKcal,
    perfect: perfectWeeks, allstar: threeStarDays, medal: bestPoints, gain: Math.floor(bestGain),
  };
  for (const a of ACHIEVEMENTS) {
    const prefix = a.id.split('-')[0];
    if (a.target && prefix in metric) progress[a.id] = metric[prefix];
  }
  Object.assign(progress, {
    'body-10': weighInCount, 'hab-legs': bestLegStreak,
    'wx-rain-10': rainDays, 'hol-5': holidayDays, 'hol-10': holidayNames.size,
  });

  return {
    totalStars,
    level: levelInfo(totalStars),
    sessions: results,
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
    streak: { weeks: streak, best: bestStreak, shields, flame: flameFor(streak), lastBreak },
    perfectWeeks,
    perfectThisWeek: perfectSet.has(thisWeek),
    weekGoal: goalAt(data.profile, thisWeek),
    thisWeekVisits: weekVisits.get(thisWeek) ?? 0,
    timeline,
    challenge: curWeek === thisWeek ? challenge : pickChallenge(thisWeek, questCtx(thisWeek)),
    seasons: [...seasons.values()].sort((a, b) => a.key.localeCompare(b.key)),
    season: seasons.get(curSeason.key) ?? curSeason,
  };
}

/** Next milestone in the "Visits" family, for the dashboard. */
export function nextVisitMilestone(visits: number): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.category === 'Visits' && (a.target ?? 0) > visits);
}
