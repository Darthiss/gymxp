import type { AppData, Rec } from './types';

function mergeList<T extends Rec>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const r of a) m.set(r.id, r);
  for (const r of b) {
    const cur = m.get(r.id);
    if (!cur || r.updatedAt > cur.updatedAt) m.set(r.id, r);
  }
  return [...m.values()];
}

/**
 * Merge two copies of the data (e.g. phone edits made offline + desktop edits).
 * Record-level last-writer-wins by `updatedAt`; deletions are tombstones so they propagate.
 * On equal timestamps `a` wins.
 */
export function mergeData(a: AppData, b: AppData): AppData {
  return {
    schema: 1,
    profile: b.profile.updatedAt > a.profile.updatedAt ? b.profile : a.profile,
    sessions: mergeList(a.sessions, b.sessions),
    weights: mergeList(a.weights, b.weights),
    customExercises: mergeList(a.customExercises, b.customExercises),
    routines: mergeList(a.routines, b.routines),
    exerciseSettings: mergeList(a.exerciseSettings, b.exerciseSettings),
  };
}

/** Fill in any fields missing from older/partial files. */
export function normalizeData(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>;
  return {
    schema: 1,
    profile: {
      id: 'profile', updatedAt: 0, name: '', sex: '', heightCm: null, birthYear: null, weeklyGoal: 3, goalWeightKg: null,
      ...(d.profile ?? {}),
    },
    sessions: d.sessions ?? [],
    weights: d.weights ?? [],
    customExercises: d.customExercises ?? [],
    routines: d.routines ?? [],
    exerciseSettings: d.exerciseSettings ?? [],
  };
}
