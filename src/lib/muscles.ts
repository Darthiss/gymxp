// Training volume per muscle, in weighted sets: a set counts 1 for each primary muscle of its
// exercise and 0.5 for each secondary one. Pure and shared by the body map and the routine check,
// so it takes plain { exerciseId, sets } entries, which both a logged session and a planned
// routine can supply. (The engine's weekMuscle is a different thing: 5 coarse groups, for Hero.)
import { routineItems } from './routines';
import { addDays, parseDate, today, weekKey } from './util';
import type { Exercise, MuscleGroup, Routine, Session } from './types';

/** The 16 muscles the exercise catalog uses, ordered head to toe. */
export const MUSCLES = [
  'Traps', 'Shoulders', 'Chest', 'Lats', 'Middle Back', 'Lower Back', 'Biceps', 'Triceps', 'Forearms',
  'Abdominals', 'Glutes', 'Abductors', 'Adductors', 'Quadriceps', 'Hamstrings', 'Calves',
] as const;
export type Muscle = typeof MUSCLES[number];

const KNOWN = new Set<string>(MUSCLES);
export const isMuscle = (m: string): m is Muscle => KNOWN.has(m);

export const SECONDARY_SHARE = 0.5;

// Custom exercises only say which group they train, so their sets are shared across that
// group's main muscles: a custom "Arms" exercise counts half a set each for biceps and triceps.
const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = {
  Chest: ['Chest'],
  Back: ['Lats', 'Middle Back'],
  Shoulders: ['Shoulders'],
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

/** A logged workout as entries. A set counts once it has reps (or seconds, on a timed exercise). */
export const sessionEntries = (s: Session): VolumeEntry[] =>
  s.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => x.reps > 0).length }));

/** A planned routine as entries: its target sets. */
export const routineEntries = (r: Routine): VolumeEntry[] =>
  routineItems(r).map((it) => ({ exerciseId: it.exerciseId, sets: it.sets }));

const live = (sessions: Session[], from: string, to: string) => sessions.filter((s) => !s.deleted && s.date >= from && s.date <= to);

/** Everything logged in the Monday–Sunday week that contains `date`. */
export function weekVolume(sessions: Session[], exMap: Map<string, Exercise>, date = today()): MuscleVolume {
  const mon = weekKey(date);
  return volumeOf(live(sessions, mon, addDays(mon, 6)).flatMap(sessionEntries), exMap);
}

/** Sets per week, averaged over the last `weeks` × 7 days up to `date`. With less history than
 *  that, it averages over the weeks you've actually been training, so a new log isn't diluted.
 *  The sources stay as real totals: averaging each exercise and rounding would stop them adding up. */
export function averageVolume(sessions: Session[], exMap: Map<string, Exercise>, weeks = 4, date = today()): MuscleVolume {
  const from = addDays(date, -(weeks * 7 - 1));
  const first = sessions.filter((s) => !s.deleted && s.date <= date).reduce<string | null>((a, s) => (a === null || s.date < a ? s.date : a), null);
  const days = first ? Math.round((parseDate(date).getTime() - parseDate(first).getTime()) / 86_400_000) + 1 : 0;
  const span = Math.max(1, Math.min(weeks, Math.ceil(days / 7)));
  const total = volumeOf(live(sessions, from, date).flatMap(sessionEntries), exMap);
  return { sets: Object.fromEntries(MUSCLES.map((m) => [m, total.sets[m] / span])) as Record<Muscle, number>, by: total.by, weeks: span };
}

/** Where a muscle's weekly sets land. 10–20 is the usual target for growth (Schoenfeld 2017). */
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

/** Muscles with any work, most first. */
export const ranked = (sets: Record<Muscle, number>) => [...MUSCLES].sort((a, b) => sets[b] - sets[a] || MUSCLES.indexOf(a) - MUSCLES.indexOf(b));

/** Sets shown to a person: halves are real (secondary muscles), finer than that is noise. */
export const fmtSets = (n: number) => String(Math.round(n * 2) / 2);
