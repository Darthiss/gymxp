// Routines: the coach's plan (exercises with target sets × reps), the gym-guide checklist
// and which routine is up next in your rotation.
import { sortSessions } from './xp';
import type { AppData, Routine, RoutineItem, SetEntry } from './types';

/** Live routines, sorted by name so "Day A, Day B, Day C" read in order everywhere. */
export function activeRoutines(data: AppData): Routine[] {
  return data.routines.filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** A routine's steps. Routines saved before targets existed get 3 sets and no rep target. */
export function routineItems(r: Routine): RoutineItem[] {
  return r.items ?? r.exerciseIds.map((exerciseId) => ({ exerciseId, sets: 3, reps: '' }));
}

export const totalSets = (r: Routine) => routineItems(r).reduce((n, it) => n + it.sets, 0);

/** Target reps for set `k` (0-based): a pyramid "12/10/8" gives one value per set. */
export function repsForSet(reps: string, k: number): string {
  const parts = reps.split('/').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[Math.min(k, parts.length - 1)] : reps.trim();
}

/** First whole number in a rep target ("8-12" → 8), or null. */
export function firstReps(reps: string): number | null {
  const m = reps.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "3 × 10", "4 × 12/10/8/6", or "3 sets" when there is no rep target. */
export function fmtTarget(it: Pick<RoutineItem, 'sets' | 'reps'>): string {
  const reps = it.reps.trim();
  return reps ? `${it.sets} × ${reps}` : `${it.sets} ${it.sets === 1 ? 'set' : 'sets'}`;
}

/** True when `last` reached the top of the rep target on every planned set: time to add weight. */
export function hitTarget(it: RoutineItem, last: SetEntry[] | null): boolean {
  if (!last || last.length < it.sets || !it.reps.trim()) return false;
  return Array.from({ length: it.sets }, (_, k) => {
    const nums = repsForSet(it.reps, k).match(/\d+/g);
    return !!nums && last[k].reps >= Math.max(...nums.map(Number)); // "8-12" means 12
  }).every(Boolean);
}

export const REST_OPTIONS = [30, 45, 60, 90, 120, 180, 240];

export const fmtRest = (sec: number) => (sec < 120 ? `${sec} s` : `${+(sec / 60).toFixed(1)} min`);

/**
 * When each routine was last done. A workout counts for the routine it overlaps most,
 * provided it includes at least half of that routine's exercises.
 */
export function lastDone(data: AppData, routines: Routine[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of sortSessions(data.sessions)) {
    const have = new Set(s.exercises.map((e) => e.exerciseId));
    let best: Routine | null = null;
    let bestFrac = 0;
    for (const r of routines) {
      if (!r.exerciseIds.length) continue;
      const frac = r.exerciseIds.filter((id) => have.has(id)).length / r.exerciseIds.length;
      if (frac >= 0.5 && frac > bestFrac) [best, bestFrac] = [r, frac];
    }
    if (best) out.set(best.id, s.date); // sessions are oldest first, so the last write wins
  }
  return out;
}

/** The routine you did longest ago (or never). Only meaningful once you rotate 2+ routines. */
export function upNextRoutine(routines: Routine[], done: Map<string, string>): Routine | null {
  if (routines.length < 2 || done.size === 0) return null;
  let pick: Routine | null = null;
  for (const r of routines) {
    const d = done.get(r.id) ?? '';
    if (!pick || d < (done.get(pick.id) ?? '')) pick = r;
  }
  return pick;
}

// Gym checklist: how many sets of each exercise you've ticked off today. Per device and
// throwaway (it resets the next day), so plain localStorage is enough.
export type Ticks = Record<string, number>;
const tickKey = (routineId: string, date: string) => `gymxp:ticks:${routineId}:${date}`;

export function loadTicks(routineId: string, date: string): Ticks {
  try {
    return JSON.parse(localStorage.getItem(tickKey(routineId, date)) ?? '{}') as Ticks;
  } catch {
    return {};
  }
}

export function saveTicks(routineId: string, date: string, t: Ticks) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`gymxp:ticks:${routineId}:`) && k !== tickKey(routineId, date)) localStorage.removeItem(k); // old days
    }
    if (Object.values(t).some(Boolean)) localStorage.setItem(tickKey(routineId, date), JSON.stringify(t));
    else localStorage.removeItem(tickKey(routineId, date));
  } catch { /* ignore */ }
}
