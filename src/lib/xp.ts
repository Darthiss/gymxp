// GymXP game engine.
// Everything is derived from the raw log, so editing or deleting a past session
// recomputes XP, PRs, streaks and achievements consistently.
import type { AppData, Exercise, Session } from './types';
import { weekKey, addDays, today } from './util';

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
};

// ---------- Levels ----------

/** Total XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const n = level - 1;
  return 50 * n * n + 100 * n;
}

export function levelForXp(xp: number): number {
  const n = Math.floor((-100 + Math.sqrt(10000 + 200 * Math.max(0, xp))) / 100);
  let level = n + 1;
  // Guard against float rounding at exact boundaries.
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

export interface LevelInfo {
  level: number;
  xp: number;
  into: number; // XP earned inside current level
  span: number; // XP size of current level
  pct: number;
  rank: Rank;
  nextRank?: Rank;
}

export interface Rank {
  minLevel: number;
  title: string;
  color: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, title: 'Rookie', color: '#9aa3b2' },
  { minLevel: 3, title: 'Beginner', color: '#a3c4a8' },
  { minLevel: 5, title: 'Regular', color: '#7bd389' },
  { minLevel: 8, title: 'Iron Apprentice', color: '#6fb1d6' },
  { minLevel: 12, title: 'Iron Adept', color: '#5a8dee' },
  { minLevel: 16, title: 'Bronze Lifter', color: '#cd8a4f' },
  { minLevel: 20, title: 'Silver Lifter', color: '#c7d0dc' },
  { minLevel: 25, title: 'Gold Lifter', color: '#f5c542' },
  { minLevel: 30, title: 'Platinum Lifter', color: '#7fe0d6' },
  { minLevel: 35, title: 'Diamond Lifter', color: '#8fd3ff' },
  { minLevel: 40, title: 'Master', color: '#b388ff' },
  { minLevel: 50, title: 'Grandmaster', color: '#e070ff' },
  { minLevel: 60, title: 'Titan', color: '#ff7a59' },
  { minLevel: 75, title: 'Mythic', color: '#ff4f81' },
  { minLevel: 90, title: 'Legend', color: '#ffd166' },
  { minLevel: 100, title: 'Olympian', color: '#fff3b0' },
];

export function rankFor(level: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.minLevel) r = x;
  return r;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const span = xpForLevel(level + 1) - base;
  const into = xp - base;
  const rank = rankFor(level);
  return { level, xp, into, span, pct: span ? into / span : 0, rank, nextRank: RANKS.find((r) => r.minLevel > level) };
}

// ---------- Achievements ----------

export type AchievementCategory = 'Visits' | 'Volume' | 'Streaks' | 'Records' | 'Explorer' | 'Sets' | 'Time' | 'Special' | 'Body';

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
  { n: 25, xp: 200, title: 'Regular', icon: '🎟️' },
  { n: 50, xp: 300, title: 'Committed', icon: '💪' },
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

const tierDefs = (prefix: string, category: AchievementCategory, tiers: Tier[], descFn: (t: Tier) => string): AchievementDef[] =>
  tiers.map((t) => ({ id: `${prefix}-${t.n}`, category, icon: t.icon ?? '🏅', title: t.title, desc: descFn(t), xp: t.xp, target: t.n }));

const fmt = (n: number) => n.toLocaleString('en-US');

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tierDefs('visits', 'Visits', VISIT_TIERS, (t) => `Go to the gym ${t.n === 1 ? 'for the first time' : `${fmt(t.n)} times`}`),
  ...tierDefs('volume', 'Volume', VOLUME_TIERS, (t) => `Lift ${fmt(t.n / 1000)} t in total: ${t.desc}`),
  ...tierDefs('streak', 'Streaks', STREAK_TIERS, (t) => `Hit your weekly goal ${t.n} weeks in a row`),
  ...tierDefs('prs', 'Records', PR_TIERS, (t) => (t.n === 1 ? 'Set your first personal record' : `Set ${fmt(t.n)} personal records`)),
  ...tierDefs('explorer', 'Explorer', EXPLORER_TIERS, (t) => `Train ${t.n} different exercises`),
  ...tierDefs('sets', 'Sets', SET_TIERS, (t) => `Complete ${fmt(t.n)} sets`),
  ...tierDefs('time', 'Time', TIME_TIERS, (t) => `Log ${fmt(t.n / 60)} hours of workouts from your watch`),
  { id: 'special-marathon', category: 'Special', icon: '🏃', title: 'Marathon Session', desc: 'A workout of 90+ minutes', xp: 100 },
  { id: 'special-beast', category: 'Special', icon: '🦍', title: 'Volume Beast', desc: 'Move 10 t in a single session', xp: 150 },
  { id: 'special-early', category: 'Special', icon: '🌅', title: 'Early Bird', desc: 'Start a workout before 7:00', xp: 50 },
  { id: 'special-night', category: 'Special', icon: '🌙', title: 'Night Owl', desc: 'Start a workout at 21:00 or later', xp: 50 },
  { id: 'special-month', category: 'Special', icon: '📅', title: 'Iron Month', desc: 'Go 12+ days in one calendar month', xp: 300 },
  { id: 'special-double', category: 'Special', icon: '⚡', title: 'Double PR', desc: 'Set 3+ records in one session', xp: 75 },
  { id: 'body-first', category: 'Body', icon: '⚖️', title: 'On the Scale', desc: 'Log your bodyweight for the first time', xp: 25 },
  { id: 'body-10', category: 'Body', icon: '📊', title: 'Tracking Pro', desc: 'Log your bodyweight 10 times', xp: 75, target: 10 },
  { id: 'body-goal', category: 'Body', icon: '🎯', title: 'Goal Weight', desc: 'Reach your goal bodyweight', xp: 500 },
];

const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// ---------- Engine ----------

export interface XpItem {
  label: string;
  xp: number;
  kind: 'base' | 'bonus' | 'pr' | 'achievement';
}

export interface PR {
  exerciseId: string;
  kind: 'weight' | 'e1rm' | 'assist';
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
  achievements: UnlockedAchievement[];
}

export interface ExerciseBest {
  maxKg: number; // heaviest set (raw kg; for assisted: least assistance)
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
  prCount: number;
  exercisesTried: number;
  bests: Map<string, ExerciseBest>;
  history: Map<string, ExerciseHistoryPoint[]>;
  weekStreak: number; // current streak (weeks hitting goal), counting this week if already hit
  bestWeekStreak: number;
  thisWeekVisits: number;
  timeline: { date: string; xp: number }[]; // cumulative XP after each day with activity
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
  if (ex?.bwFactor) return kg + ex.bwFactor * bw;
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
  let totalVolume = 0, totalSets = 0, totalMinutes = 0, prCount = 0, weighInCount = 0, bestStreak = 0;
  const firstWeight = weights[0]?.kg;

  const unlock = (id: string, date: string, sink: XpItem[] | null, sessionId?: string) => {
    if (unlockedIds.has(id)) return 0;
    const def = ACH_BY_ID.get(id);
    if (!def) return 0;
    unlockedIds.add(id);
    const u = { ...def, date, sessionId };
    unlocked.push(u);
    sink?.push({ label: `${def.icon} ${def.title}`, xp: def.xp, kind: 'achievement' });
    return def.xp;
  };
  const checkTiers = (prefix: string, tiers: Tier[], value: number, date: string, sink: XpItem[] | null, sessionId?: string) => {
    let xp = 0;
    for (const t of tiers) if (value >= t.n) xp += unlock(`${prefix}-${t.n}`, date, sink, sessionId);
    return xp;
  };
  const streakEndingAt = (wk: string) => {
    let n = 0;
    let w = wk;
    while (goalWeeks.has(w)) { n++; w = addDays(w, -7); }
    return n;
  };
  const pushTimeline = (date: string) => {
    const last = timeline[timeline.length - 1];
    if (last && last.date === date) last.xp = totalXp;
    else timeline.push({ date, xp: totalXp });
  };

  for (const ev of events) {
    if (ev.kind === 'w') {
      const w = ev.w;
      weighInCount++;
      let xp = 0;
      const wk = weekKey(w.date);
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
    const bw = bwAt(s.date);
    const wk = weekKey(s.date);

    // --- base XP ---
    let base = 0;
    const firstOfDay = !visitDays.has(s.date);
    if (firstOfDay) {
      visitDays.add(s.date);
      weekVisits.set(wk, (weekVisits.get(wk) ?? 0) + 1);
      const mk = s.date.slice(0, 7);
      monthVisits.set(mk, (monthVisits.get(mk) ?? 0) + 1);
      items.push({ label: 'Gym visit', xp: RULES.visitXp, kind: 'base' });
      base += RULES.visitXp;
    }

    let sets = 0;
    let volume = 0;
    const prs: PR[] = [];
    const newExercises: string[] = [];
    for (const log of s.exercises) {
      const ex = exMap.get(log.exerciseId);
      const done = log.sets.filter((x) => x.reps > 0);
      if (!done.length) continue;
      sets += done.length;
      let exVol = 0, bestKg = ex?.assisted ? Infinity : 0, bestE = 0;
      for (const st of done) {
        exVol += effectiveLoad(ex, st.kg, bw) * st.reps;
        if (ex?.assisted) bestKg = Math.min(bestKg, st.kg);
        else { bestKg = Math.max(bestKg, st.kg); bestE = Math.max(bestE, e1rm(st.kg, st.reps)); }
      }
      volume += exVol;

      const prev = bests.get(log.exerciseId);
      if (!seen.has(log.exerciseId)) {
        seen.add(log.exerciseId);
        newExercises.push(log.exerciseId);
        bests.set(log.exerciseId, { maxKg: bestKg, maxKgDate: s.date, maxE1rm: bestE, maxE1rmDate: s.date, sessions: 1, lastDate: s.date });
      } else if (prev) {
        let weightPr = false;
        if (ex?.assisted) {
          if (bestKg < prev.maxKg) {
            prs.push({ exerciseId: log.exerciseId, kind: 'assist', value: bestKg, prev: prev.maxKg });
            prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
          }
        } else if (bestKg > prev.maxKg && bestKg > 0) {
          prs.push({ exerciseId: log.exerciseId, kind: 'weight', value: bestKg, prev: prev.maxKg });
          prev.maxKg = bestKg; prev.maxKgDate = s.date; weightPr = true;
        }
        if (!ex?.assisted && bestE > prev.maxE1rm + 0.01) {
          if (!weightPr) prs.push({ exerciseId: log.exerciseId, kind: 'e1rm', value: bestE, prev: prev.maxE1rm });
          prev.maxE1rm = bestE; prev.maxE1rmDate = s.date;
        }
        prev.sessions++;
        prev.lastDate = s.date;
      }
      const h = history.get(log.exerciseId) ?? [];
      h.push({ date: s.date, sessionId: s.id, bestKg: bestKg === Infinity ? 0 : bestKg, bestE1rm: bestE, volume: exVol, sets: done.map((d) => ({ kg: d.kg, reps: d.reps })) });
      history.set(log.exerciseId, h);
    }

    if (sets) {
      items.push({ label: `${sets} sets`, xp: sets * RULES.setXp, kind: 'base' });
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
    const streakWeeks = streakEndingAt(addDays(wk, -7));
    const pct = Math.min(streakWeeks, RULES.streakCapWeeks) * RULES.streakStepPct;
    const multiplier = 1 + pct / 100;
    let xp = base;
    if (pct > 0 && base > 0) {
      const bonus = Math.round((base * pct) / 100);
      items.push({ label: `🔥 ${streakWeeks}-week streak +${pct}%`, xp: bonus, kind: 'bonus' });
      xp += bonus;
    }

    for (const id of newExercises) {
      items.push({ label: `New exercise: ${exMap.get(id)?.name ?? 'Unknown'}`, xp: RULES.newExerciseXp, kind: 'bonus' });
      xp += RULES.newExerciseXp;
    }
    for (const pr of prs) {
      const name = exMap.get(pr.exerciseId)?.name ?? 'Unknown';
      const v = pr.kind === 'weight' || pr.kind === 'assist' ? RULES.weightPrXp : RULES.e1rmPrXp;
      const what = pr.kind === 'weight' ? `${pr.value} kg` : pr.kind === 'assist' ? `less assist (${pr.value} kg)` : 'best set';
      items.push({ label: `🏆 PR ${name}: ${what}`, xp: v, kind: 'pr' });
      xp += v;
    }
    prCount += prs.length;

    // weekly goal reached with this visit
    if (firstOfDay && weekVisits.get(wk) === goal) {
      goalWeeks.add(wk);
      items.push({ label: `✅ Weekly goal (${goal}×) reached`, xp: RULES.weeklyGoalXp, kind: 'bonus' });
      xp += RULES.weeklyGoalXp;
    }

    totalVolume += volume;
    totalSets += sets;
    totalMinutes += minutes;

    // --- achievements ---
    const achStart = unlocked.length;
    xp += checkTiers('visits', VISIT_TIERS, visitDays.size, s.date, items, s.id);
    xp += checkTiers('volume', VOLUME_TIERS, totalVolume, s.date, items, s.id);
    const curStreak = streakEndingAt(wk);
    bestStreak = Math.max(bestStreak, curStreak);
    xp += checkTiers('streak', STREAK_TIERS, curStreak, s.date, items, s.id);
    xp += checkTiers('prs', PR_TIERS, prCount, s.date, items, s.id);
    xp += checkTiers('explorer', EXPLORER_TIERS, seen.size, s.date, items, s.id);
    xp += checkTiers('sets', SET_TIERS, totalSets, s.date, items, s.id);
    xp += checkTiers('time', TIME_TIERS, totalMinutes, s.date, items, s.id);
    if (minutes >= 90) xp += unlock('special-marathon', s.date, items, s.id);
    if (volume >= 10000) xp += unlock('special-beast', s.date, items, s.id);
    if (s.startTime && s.startTime < '07:00') xp += unlock('special-early', s.date, items, s.id);
    if (s.startTime && s.startTime >= '21:00') xp += unlock('special-night', s.date, items, s.id);
    if ((monthVisits.get(s.date.slice(0, 7)) ?? 0) >= 12) xp += unlock('special-month', s.date, items, s.id);
    if (prs.length >= 3) xp += unlock('special-double', s.date, items, s.id);

    totalXp += xp;
    results.set(s.id, {
      id: s.id, date: s.date, xp, items, volume, sets, prs, newExercises, streakWeeks, multiplier,
      xpBefore, xpAfter: totalXp, achievements: unlocked.slice(achStart),
    });
    pushTimeline(s.date);
  }

  // current streak as of today
  const thisWeek = weekKey(today());
  const thisWeekVisits = weekVisits.get(thisWeek) ?? 0;
  const weekStreak = goalWeeks.has(thisWeek) ? streakEndingAt(thisWeek) : streakEndingAt(addDays(thisWeek, -7));

  const progress: Record<string, number> = {};
  const metric: Record<string, number> = {
    visits: visitDays.size, volume: totalVolume, streak: bestStreak, prs: prCount,
    explorer: seen.size, sets: totalSets, time: totalMinutes,
  };
  for (const a of ACHIEVEMENTS) {
    const prefix = a.id.split('-')[0];
    if (a.target && prefix in metric) progress[a.id] = metric[prefix];
  }
  progress['body-10'] = weighInCount;

  return {
    totalXp,
    level: levelInfo(totalXp),
    sessions: results,
    weighIns,
    unlocked,
    unlockedIds,
    progress,
    visits: visitDays.size,
    totalVolume,
    totalSets,
    totalMinutes,
    prCount,
    exercisesTried: seen.size,
    bests,
    history,
    weekStreak,
    bestWeekStreak: bestStreak,
    thisWeekVisits,
    timeline,
  };
}

/** Next milestone in the "Visits" family, for the dashboard. */
export function nextVisitMilestone(visits: number): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.category === 'Visits' && (a.target ?? 0) > visits);
}
