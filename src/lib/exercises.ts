import raw from '../data/exercises.json';
import type { AppData, Exercise, SetEntry } from './types';

export const BUILTIN: Exercise[] = raw as Exercise[];

export function allExercises(data: AppData): Exercise[] {
  const custom: Exercise[] = data.customExercises
    .filter((c) => !c.deleted)
    .map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      group: c.group,
      equipment: 'My machine',
      primaryMuscles: [],
      secondaryMuscles: [],
      look: c.look,
      instructions: [],
      images: [],
      assisted: c.assisted,
      custom: true,
      photo: c.photo,
    }));
  return [...custom, ...BUILTIN];
}

export function exerciseMap(data: AppData): Map<string, Exercise> {
  const m = new Map<string, Exercise>();
  for (const e of BUILTIN) m.set(e.id, e);
  // Include deleted custom exercises too, so old sessions still show a name.
  for (const c of data.customExercises) {
    m.set(c.id, {
      id: c.id, name: c.name, aliases: c.aliases, group: c.group, equipment: 'My machine',
      primaryMuscles: [], secondaryMuscles: [], look: c.look, instructions: [], images: [],
      assisted: c.assisted, custom: true, photo: c.photo,
    });
  }
  return m;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word of the query must appear in the exercise's name, aliases, group, equipment or muscles. */
export function searchExercises(list: Exercise[], query: string): Exercise[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return list;
  const phrase = words.join(' ');
  // Best matches first: the whole phrase in the name, then in an alias, then scattered words.
  const score = (e: Exercise) => (norm(e.name).includes(phrase) ? 0 : e.aliases.some((a) => norm(a).includes(phrase)) ? 1 : 2);
  return list
    .filter((e) => {
      const hay = norm([e.name, ...e.aliases, e.group, e.equipment, ...e.primaryMuscles, ...e.secondaryMuscles].join(' '));
      return words.every((w) => hay.includes(w));
    })
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.e);
}

/** Equipment filter chips shown next to the muscle-group chips. */
export const EQUIPMENT_CHIPS: Record<string, (e: Exercise) => boolean> = {
  Dumbbells: (e) => e.equipment === 'Dumbbell',
  Barbells: (e) => e.barKg !== undefined,
  Bodyweight: (e) => e.equipment === 'Bodyweight' || e.equipment === 'Benchmark' || !!e.assisted,
  Machines: (e) => ['Machine', 'Plate-loaded', 'Cable', 'Smith machine'].includes(e.equipment),
};

/** One logged set: "40×10", or "60 s" / "5 kg · 60 s" for a timed hold. */
export function fmtSet(ex: Exercise | undefined, s: SetEntry): string {
  if (ex?.hold) return s.kg ? `${s.kg} kg · ${s.reps} s` : `${s.reps} s`;
  return `${s.kg}×${s.reps}`;
}

export function imgUrl(rel: string): string {
  return import.meta.env.BASE_URL + rel;
}

export function videoSearchUrl(e: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form`)}`;
}
