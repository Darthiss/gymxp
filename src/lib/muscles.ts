// Training volume per muscle, in weighted hard sets: a set counts 1 for each primary muscle of its
// exercise and 0.5 for each secondary one, and warm-up sets are left out. Pure and shared by the body map and the routine check,
// so it takes plain { exerciseId, sets } entries, which both a logged session and a planned
// routine can supply. (The engine's weekMuscle is a different thing: 5 coarse groups, for Hero.)
import { routineItems } from './routines';
import { addDays, parseDate, today, weekKey } from './util';
import type { Exercise, MuscleGroup, Pattern, Routine, Session, SetEntry } from './types';

/** The 18 muscles the exercise catalog uses, ordered head to toe. Shoulders are three: pressing trains
 *  the front, raises the side and rows the rear, and one bucket would hide which of them is missing. */
export const MUSCLES = [
  'Traps', 'Front Delts', 'Side Delts', 'Rear Delts', 'Chest', 'Lats', 'Middle Back', 'Lower Back', 'Biceps', 'Triceps', 'Forearms',
  'Abdominals', 'Glutes', 'Abductors', 'Adductors', 'Quadriceps', 'Hamstrings', 'Calves',
] as const;
export type Muscle = typeof MUSCLES[number];

/** The muscles a rounded plan trains directly, biggest first. The rest (traps, lower back, forearms and
 *  the hip ab- and adductors) get their work from compound lifts, so low numbers there aren't a gap. */
export const MAJOR_MUSCLES: Muscle[] = ['Quadriceps', 'Hamstrings', 'Glutes', 'Chest', 'Lats', 'Middle Back', 'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Abdominals', 'Calves'];
export const MINOR_MUSCLES: Muscle[] = MUSCLES.filter((m) => !MAJOR_MUSCLES.includes(m));

const KNOWN = new Set<string>(MUSCLES);
export const isMuscle = (m: string): m is Muscle => KNOWN.has(m);

export const SECONDARY_SHARE = 0.5;

// Custom exercises only say which group they train, so their sets are shared across that
// group's main muscles: a custom "Arms" exercise counts half a set each for biceps and triceps.
const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = {
  Chest: ['Chest'],
  Back: ['Lats', 'Middle Back'],
  Shoulders: ['Front Delts', 'Side Delts', 'Rear Delts'],
  Arms: ['Biceps', 'Triceps'],
  Legs: ['Quadriceps', 'Hamstrings'],
  Glutes: ['Glutes'],
  Core: ['Abdominals'],
};

/** How much of one set each muscle gets from an exercise. Benchmarks and unknown exercises give nothing. */
export function muscleShares(ex: Exercise | undefined): [Muscle, number][] {
  if (!ex || ex.benchmark) return [];
  const out = new Map<Muscle, number>();
  for (const m of ex.secondaryMuscles) if (isMuscle(m)) out.set(m, SECONDARY_SHARE);
  for (const m of ex.primaryMuscles) if (isMuscle(m)) out.set(m, 1);
  if (!out.size) {
    const ms = GROUP_MUSCLES[ex.group] ?? [];
    for (const m of ms) out.set(m, 1 / ms.length);
  }
  return [...out];
}

export interface VolumeEntry { exerciseId: string; sets: number }
/** One exercise's contribution to a muscle. */
export interface MuscleSource { exerciseId: string; sets: number; share: number }
export interface MuscleVolume {
  sets: Record<Muscle, number>; // weighted sets per week
  by: Record<Muscle, MuscleSource[]>; // the exercises behind them, biggest first, as totals over `weeks`
  weeks: number; // how many weeks the totals span (1 unless averaged)
}

const zero = <T>(make: () => T) => Object.fromEntries(MUSCLES.map((m) => [m, make()])) as Record<Muscle, T>;

/** Weighted sets per muscle for a list of exercises and how many sets of each. */
export function volumeOf(entries: VolumeEntry[], exMap: Map<string, Exercise>): MuscleVolume {
  const sets = zero(() => 0);
  const acc = zero(() => new Map<string, MuscleSource>());
  for (const e of entries) {
    if (e.sets <= 0) continue;
    for (const [m, share] of muscleShares(exMap.get(e.exerciseId))) {
      sets[m] += e.sets * share;
      const src = acc[m].get(e.exerciseId) ?? { exerciseId: e.exerciseId, sets: 0, share };
      src.sets += e.sets * share;
      acc[m].set(e.exerciseId, src);
    }
  }
  const by = zero<MuscleSource[]>(() => []);
  for (const m of MUSCLES) by[m] = [...acc[m].values()].sort((a, b) => b.sets - a.sets);
  return { sets, by, weeks: 1 };
}

/** Sets lighter than this share of the day's heaviest set on an exercise are warm-ups. */
export const WARMUP_SHARE = 0.6;

/** How many of an exercise's logged sets were hard ones. The 10–20 sets a week guidance means sets
 *  taken close to failure, so warm-ups are left out. Where the weight column isn't a plain load
 *  (assisted, bodyweight, timed and benchmark exercises), every set with reps counts. */
export function hardSets(ex: Exercise | undefined, sets: SetEntry[]): number {
  const done = sets.filter((x) => x.reps > 0);
  if (!ex || ex.assisted || ex.bwFactor || ex.hold || ex.benchmark) return done.length;
  const top = Math.max(0, ...done.map((x) => x.kg));
  return top > 0 ? done.filter((x) => x.kg >= top * WARMUP_SHARE).length : done.length;
}

/** A logged workout as entries: its hard sets. */
export const sessionEntries = (s: Session, exMap: Map<string, Exercise>): VolumeEntry[] =>
  s.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: hardSets(exMap.get(e.exerciseId), e.sets) }));

/** A planned routine as entries: its target sets. */
export const routineEntries = (r: Routine): VolumeEntry[] =>
  routineItems(r).map((it) => ({ exerciseId: it.exerciseId, sets: it.sets }));

const live = (sessions: Session[], from: string, to: string) => sessions.filter((s) => !s.deleted && s.date >= from && s.date <= to);

/** Everything logged in the Monday–Sunday week that contains `date`. */
export function weekVolume(sessions: Session[], exMap: Map<string, Exercise>, date = today()): MuscleVolume {
  const mon = weekKey(date);
  return volumeOf(live(sessions, mon, addDays(mon, 6)).flatMap((s) => sessionEntries(s, exMap)), exMap);
}

/** Sets per week, averaged over the last `weeks` × 7 days up to `date`. With less history than
 *  that, it averages over the weeks you've actually been training, so a new log isn't diluted.
 *  The sources stay as real totals: averaging each exercise and rounding would stop them adding up. */
export function averageVolume(sessions: Session[], exMap: Map<string, Exercise>, weeks = 4, date = today()): MuscleVolume {
  const from = addDays(date, -(weeks * 7 - 1));
  const first = sessions.filter((s) => !s.deleted && s.date <= date).reduce<string | null>((a, s) => (a === null || s.date < a ? s.date : a), null);
  const days = first ? Math.round((parseDate(date).getTime() - parseDate(first).getTime()) / 86_400_000) + 1 : 0;
  const span = Math.max(1, Math.min(weeks, Math.ceil(days / 7)));
  const total = volumeOf(live(sessions, from, date).flatMap((s) => sessionEntries(s, exMap)), exMap);
  return { sets: Object.fromEntries(MUSCLES.map((m) => [m, total.sets[m] / span])) as Record<Muscle, number>, by: total.by, weeks: span };
}

/** Where a muscle's weekly hard sets land. 10–20 is the usual target for growth (Schoenfeld 2017). */
export type Band = 'none' | 'low' | 'building' | 'target' | 'high';
export const BANDS: { id: Band; label: string; range: string }[] = [
  { id: 'none', label: 'Not trained', range: '0' },
  { id: 'low', label: 'Low', range: 'under 4' },
  { id: 'building', label: 'Building', range: '4–9' },
  { id: 'target', label: 'On target', range: '10–20' },
  { id: 'high', label: 'High', range: 'over 20' },
];
export const TARGET_SETS = 10;

export function bandOf(sets: number): Band {
  return sets <= 0 ? 'none' : sets < 4 ? 'low' : sets < TARGET_SETS ? 'building' : sets <= 20 ? 'target' : 'high';
}
export const bandLabel = (b: Band) => BANDS.find((x) => x.id === b)!.label;

/** A band for every muscle, from weekly sets. */
export const weeklyBands = (sets: Record<Muscle, number>) =>
  Object.fromEntries(MUSCLES.map((m) => [m, bandOf(sets[m])])) as Record<Muscle, Band>;

/** Shading for a single workout, where weekly bands don't apply: each muscle relative to the one
 *  the workout trained most. Never 'high', which only means something per week. */
export function relativeBands(sets: Record<Muscle, number>): Record<Muscle, Band> {
  const max = Math.max(0, ...MUSCLES.map((m) => sets[m]));
  return Object.fromEntries(MUSCLES.map((m) => {
    const r = max ? sets[m] / max : 0;
    return [m, r <= 0 ? 'none' : r < 0.34 ? 'low' : r < 0.67 ? 'building' : 'target'];
  })) as Record<Muscle, Band>;
}

/** Muscles by sets, most first. Ties keep head-to-toe order. */
export const ranked = (sets: Record<Muscle, number>, of: readonly Muscle[] = MUSCLES) =>
  [...of].sort((a, b) => sets[b] - sets[a] || MUSCLES.indexOf(a) - MUSCLES.indexOf(b));

// ---------- What kind of work an exercise is ----------

/** Custom exercises have no pattern, except that core work is core work. */
export const patternOf = (ex: Exercise | undefined): Pattern | undefined =>
  ex?.pattern ?? (ex && !ex.benchmark && !ex.primaryMuscles.length && ex.group === 'Core' ? 'core' : undefined);

export type Family = 'push' | 'pull' | 'legs' | 'core';
const MUSCLE_FAMILY: Record<Muscle, Family> = {
  Chest: 'push', 'Front Delts': 'push', 'Side Delts': 'push', Triceps: 'push',
  Lats: 'pull', 'Middle Back': 'pull', 'Rear Delts': 'pull', Biceps: 'pull', Traps: 'pull', Forearms: 'pull', 'Lower Back': 'pull',
  Quadriceps: 'legs', Hamstrings: 'legs', Glutes: 'legs', Calves: 'legs', Abductors: 'legs', Adductors: 'legs', Abdominals: 'core',
};
const GROUP_FAMILY: Record<MuscleGroup, Family> = { Chest: 'push', Shoulders: 'push', Arms: 'push', Back: 'pull', Legs: 'legs', Glutes: 'legs', Core: 'core' };

/** Push, pull, legs or core: by movement pattern, else by the main muscle, else by a custom exercise's group. */
export function familyOf(ex: Exercise | undefined): Family | undefined {
  if (!ex || ex.benchmark) return undefined;
  const p = patternOf(ex);
  if (p) return p.endsWith('push') ? 'push' : p.endsWith('pull') ? 'pull' : p === 'core' || p === 'carry' ? 'core' : 'legs';
  const m = ex.primaryMuscles.find(isMuscle);
  return m ? MUSCLE_FAMILY[m] : GROUP_FAMILY[ex.group];
}

/** Sets shown to a person: halves are real (secondary muscles), finer than that is noise. */
export const fmtSets = (n: number) => String(Math.round(n * 2) / 2);
