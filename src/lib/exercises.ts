import raw from '../data/exercises.json';
import type { AppData, Exercise } from './types';

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
  return list.filter((e) => {
    const hay = norm([e.name, ...e.aliases, e.group, e.equipment, ...e.primaryMuscles, ...e.secondaryMuscles].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function imgUrl(rel: string): string {
  return import.meta.env.BASE_URL + rel;
}

export function videoSearchUrl(e: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form`)}`;
}
