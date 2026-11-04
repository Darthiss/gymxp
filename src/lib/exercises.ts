import raw from '../data/exercises.json';
import type { Beat, PR } from './engine';
import { FEATURES } from './features';
import type { AppData, Exercise, SetEntry } from './types';

export const BUILTIN: Exercise[] = raw as Exercise[];

const PICKABLE = FEATURES.hero ? BUILTIN : BUILTIN.filter((e) => !e.benchmark);

/** The live list for pickers. Shelved exercises stay in exerciseMap() so old workouts still display. */
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
  return [...custom, ...PICKABLE];
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

const trim = (n: number) => +n.toFixed(2);

/** How an exercise compared with last time: "+5 kg", "+2 reps", "New baseline", "Same". */
export function fmtBeat(ex: Exercise | undefined, b: Beat): string {
  if (b.first) return 'New baseline';
  if (!b.beat) return b.kg === 0 && b.reps === 0 ? 'Same' : 'Next time';
  if (b.kg > 0) return ex?.benchmark === 'ladder' ? `${trim(b.kg)} min faster` : ex?.assisted ? `−${trim(b.kg)} kg assist` : `+${trim(b.kg)} kg`;
  const unit = ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rounds' : ex?.hold ? 's' : b.reps === 1 ? 'rep' : 'reps';
  return `+${b.reps}${ex?.hold ? '' : ' '}${unit}`;
}

/** A record as old → new: "120 → 125 kg". */
export function fmtPr(p: PR): string {
  const v = trim(p.value), was = trim(p.prev);
  return p.kind === 'weight' ? `${was} → ${v} kg` : p.kind === 'assist' ? `${was} → ${v} kg assist` : p.kind === 'reps' ? `${was} → ${v} reps` : p.kind === 'hold' ? `${was} → ${v} s`
    : p.kind === 'rounds' ? `${was} → ${v} rounds` : p.kind === 'rungs' ? `${was} → ${v} rungs` : p.kind === 'time' ? `${was} → ${v} min` : 'Best set yet';
}

/** What you need to do to beat your last time on an exercise. */
export function toBeatText(ex: Exercise | undefined, last: SetEntry[]): string {
  const kgs = last.map((s) => s.kg);
  const total = last.reduce((n, s) => n + s.reps, 0) + 1;
  if (ex?.benchmark) return `Beat ${Math.max(...last.map((s) => s.reps))} ${ex.benchmark === 'ladder' ? 'rungs' : 'rounds'}`;
  if (ex?.assisted) return `To beat: ${Math.min(...kgs)} kg assist for ${total}+ reps, or less assist`;
  const top = Math.max(...kgs);
  if (ex?.hold) return top ? `To beat: ${top} kg for ${total}+ s in total, or add weight` : `To beat: ${total}+ s in total, or add weight`;
  if (ex?.bwFactor && !top) return `To beat: ${total}+ reps in total, or add weight`;
  return `To beat: ${top} kg for ${total}+ reps, or go heavier`;
}

export function imgUrl(rel: string): string {
  return import.meta.env.BASE_URL + rel;
}

export function videoSearchUrl(e: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form`)}`;
}
