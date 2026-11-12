// The routine check: plain rules over your plan, at most 3 findings, each with its reason and,
// where it helps, one exercise to add and the routine it fits best. Rule-based on purpose: an LLM
// would need a new CSP host, an API key in a client-only app and your training data sent away.
import { averageVolume, familyOf, fmtSets, MAJOR_MUSCLES, patternOf, routineEntries, volumeOf, type Muscle } from './muscles';
import { lastDone, routineItems, totalSets } from './routines';
import { addDays, parseDate, plural, today } from './util';
import type { AppData, Exercise, Pattern, Routine } from './types';

export interface Finding {
  id: string; // stable, e.g. "missing:Hamstrings"
  kind: 'missing' | 'stale' | 'balance' | 'low' | 'pattern' | 'idea';
  title: string;
  reason: string;
  add?: { exerciseId: string; routineId: string };
}

export const MAX_FINDINGS = 3;

// Only MAJOR_MUSCLES are checked: forearms, traps, lower back and the hip ab- and adductors get
// work from compound lifts, so a plan without direct work for them isn't flagged.
const NAME: Partial<Record<Muscle, string>> = { Quadriceps: 'quads', Abdominals: 'abs' };
const ADJ: Partial<Record<Muscle, string>> = { Lats: 'lat', 'Middle Back': 'mid-back', 'Front Delts': 'front-delt', 'Side Delts': 'side-delt', 'Rear Delts': 'rear-delt', Abdominals: 'ab', Glutes: 'glute', Quadriceps: 'quad', Hamstrings: 'hamstring', Calves: 'calf' };
const name = (m: Muscle) => NAME[m] ?? m.toLowerCase();
const adj = (m: Muscle) => ADJ[m] ?? m.toLowerCase();
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const PATTERN_TEXT: Record<Pattern, { title: string; what: string }> = {
  'h-push': { title: 'No chest press', what: 'a horizontal press, like a chest press' },
  'v-push': { title: 'No overhead press', what: 'an overhead press' },
  'h-pull': { title: 'No row', what: 'a row' },
  'v-pull': { title: 'No pulldown', what: 'a pulldown or pull-up' },
  squat: { title: 'No squat', what: 'a squat or leg press' },
  hinge: { title: 'No hip hinge', what: 'a hip hinge, like a Romanian deadlift, hip thrust or back extension' },
  core: { title: 'No core work', what: 'core work' },
  lunge: { title: 'Idea: lunges', what: 'single-leg work, which evens out left and right' },
  carry: { title: 'Idea: a loaded carry', what: 'a carry, which trains grip, core and posture at once' },
};
const MAIN_PATTERNS: Pattern[] = ['h-push', 'v-push', 'h-pull', 'v-pull', 'squat', 'hinge', 'core'];
const IDEA_PATTERNS: Pattern[] = ['lunge', 'carry'];

// Machine-gym defaults, used when you haven't logged anything that fits.
const FOR_MUSCLE: Record<Muscle, string[]> = {
  Traps: ['Leverage_Shrug'], Chest: ['Machine_Bench_Press', 'Butterfly'],
  'Front Delts': ['Machine_Shoulder_Military_Press', 'Dumbbell_Shoulder_Press'], 'Side Delts': ['Side_Lateral_Raise', 'Standing_Low-Pulley_Deltoid_Raise'], 'Rear Delts': ['Reverse_Machine_Flyes', 'Face_Pull'],
  Lats: ['Wide-Grip_Lat_Pulldown', 'Assisted_Pull-Up_Machine'], 'Middle Back': ['Seated_Cable_Rows', 'Leverage_Iso_Row'], 'Lower Back': ['Hyperextensions_Back_Extensions'],
  Biceps: ['Machine_Bicep_Curl', 'Dumbbell_Bicep_Curl'], Triceps: ['Triceps_Pushdown_-_Rope_Attachment', 'Triceps_Pushdown'], Forearms: ['Farmers_Walk'],
  Abdominals: ['Cable_Crunch', 'Plank'], Glutes: ['Barbell_Hip_Thrust', 'One-Legged_Cable_Kickback'], Abductors: ['Thigh_Abductor'], Adductors: ['Thigh_Adductor'],
  Quadriceps: ['Leg_Press', 'Leg_Extensions'], Hamstrings: ['Seated_Leg_Curl', 'Lying_Leg_Curls'], Calves: ['Standing_Calf_Raises', 'Seated_Calf_Raise'],
};
const FOR_PATTERN: Record<Pattern, string[]> = {
  'h-push': ['Machine_Bench_Press', 'Dumbbell_Bench_Press'], 'v-push': ['Machine_Shoulder_Military_Press', 'Dumbbell_Shoulder_Press'],
  'h-pull': ['Seated_Cable_Rows', 'Leverage_Iso_Row'], 'v-pull': ['Wide-Grip_Lat_Pulldown', 'Assisted_Pull-Up_Machine'],
  squat: ['Leg_Press', 'Hack_Squat'], hinge: ['Hyperextensions_Back_Extensions', 'Pull_Through', 'Romanian_Deadlift'], lunge: ['Dumbbell_Lunges'], // the easiest hinge to learn first
  core: ['Cable_Crunch', 'Plank'], carry: ['Farmers_Walk'],
};

export interface CheckInput {
  data: AppData;
  routines: Routine[]; // the rotation, as it stands (or with a draft swapped in)
  weekGoal: number; // visits a week: use g.weekGoal, not profile.weeklyGoal
  exMap: Map<string, Exercise>;
  pickable: Exercise[]; // what may be suggested: allExercises(data)
  date?: string;
  limit?: number; // most findings to return
}

/** Weekly sets per muscle the plan gives: you cycle through the routines at your weekly goal. */
export function planVolume(routines: Routine[], weekGoal: number, exMap: Map<string, Exercise>) {
  const perWeek = routines.length ? weekGoal / routines.length : 0;
  return volumeOf(routines.flatMap((r) => routineEntries(r).map((e) => ({ ...e, sets: e.sets * perWeek }))), exMap);
}

export function checkRotation({ data, routines, weekGoal, exMap, pickable, date = today(), limit = MAX_FINDINGS }: CheckInput): Finding[] {
  const live = routines.filter((r) => routineItems(r).length);
  if (!live.length) return [];
  const plan = planVolume(live, weekGoal, exMap).sets;
  const perWeek = weekGoal / live.length;
  const inPlan = new Set(live.flatMap((r) => routineItems(r).map((it) => it.exerciseId)));
  const patternSets = new Map<Pattern, number>();
  for (const r of live) for (const it of routineItems(r)) {
    const p = patternOf(exMap.get(it.exerciseId));
    if (p) patternSets.set(p, (patternSets.get(p) ?? 0) + it.sets * perWeek);
  }
  const ps = (p: Pattern) => patternSets.get(p) ?? 0;

  // How often you've logged each exercise: familiar exercises make the best suggestions.
  const logged = new Map<string, number>();
  for (const s of data.sessions) if (!s.deleted) for (const e of s.exercises) logged.set(e.exerciseId, (logged.get(e.exerciseId) ?? 0) + 1);
  const ok = new Map(pickable.map((e) => [e.id, e]));
  const suggest = (defaults: string[], fits: (e: Exercise) => boolean): Exercise | undefined => {
    const open = (e: Exercise | undefined): e is Exercise => !!e && !inPlan.has(e.id) && !e.benchmark && fits(e);
    const familiar = pickable.filter((e) => open(e) && (logged.get(e.id) ?? 0) > 0).sort((a, b) => logged.get(b.id)! - logged.get(a.id)!)[0];
    return familiar ?? defaults.map((id) => ok.get(id)).find(open) ?? pickable.find(open);
  };
  // The routine an exercise fits: the one with the most of the same kind of work, then the shortest.
  const home = (ex: Exercise): string => {
    const fam = familyOf(ex);
    const score = (r: Routine) => routineItems(r).filter((it) => familyOf(exMap.get(it.exerciseId)) === fam).length;
    return [...live].sort((a, b) => score(b) - score(a) || totalSets(a) - totalSets(b) || a.name.localeCompare(b.name))[0].id;
  };
  const withAdd = (f: Omit<Finding, 'add'>, ex: Exercise | undefined): Finding => (ex ? { ...f, add: { exerciseId: ex.id, routineId: home(ex) } } : f);
  const primaryIs = (m: Muscle) => (e: Exercise) => e.primaryMuscles.includes(m);
  const patternIs = (p: Pattern) => (e: Exercise) => patternOf(e) === p;
  const weekly = (n: number) => `${fmtSets(n)} ${n === 1 ? 'set' : 'sets'} a week`;

  const out: Finding[] = [];

  // 1. A major muscle with no work at all.
  for (const m of MAJOR_MUSCLES) {
    if (plan[m] > 0) continue;
    out.push(withAdd({ id: `missing:${m}`, kind: 'missing', title: `No ${adj(m)} work`, reason: `None of your routines train your ${name(m)}.` }, suggest(FOR_MUSCLE[m], primaryIs(m))));
  }

  // 2. Planned but not logged lately: an exercise in a routine you've done in the last 4 weeks.
  const from = addDays(date, -27);
  const done = lastDone(data, live);
  const recent = new Set<string>();
  for (const s of data.sessions) if (!s.deleted && s.date >= from && s.date <= date) for (const e of s.exercises) if (e.sets.some((x) => x.reps > 0)) recent.add(e.exerciseId);
  if (averageVolume(data.sessions, exMap, 4, date).weeks >= 2) {
    for (const r of live) {
      const last = done.get(r.id);
      if (!last || last < from) continue;
      // Edited since its last workout: the plan changed, so there's nothing to compare yet.
      if (r.updatedAt > parseDate(addDays(last, 1)).getTime()) continue;
      for (const it of routineItems(r)) {
        if (recent.has(it.exerciseId)) continue;
        out.push({ id: `stale:${r.id}:${it.exerciseId}`, kind: 'stale', title: `Not logged lately: ${exMap.get(it.exerciseId)?.name ?? 'an exercise'}`, reason: `It's part of ${r.name}, but it hasn't been logged in the last 4 weeks. Swap it for something you'll do, or keep it as a reminder.` });
      }
    }
  }

  // 3. Balance: pushing against pulling, quads against hamstrings.
  const push = ps('h-push') + ps('v-push');
  const pull = ps('h-pull') + ps('v-pull');
  if (push >= 6 && push >= 1.5 * pull) {
    const p: Pattern = ps('h-pull') <= ps('v-pull') ? 'h-pull' : 'v-pull';
    out.push(withAdd({ id: 'balance:push', kind: 'balance', title: 'More pushing than pulling', reason: `About ${weekly(push)} of pressing against ${fmtSets(pull)} of pulling. Many coaches aim for roughly equal amounts.` }, suggest(FOR_PATTERN[p], patternIs(p))));
  } else if (pull >= 6 && pull >= 1.5 * push) {
    const p: Pattern = ps('h-push') <= ps('v-push') ? 'h-push' : 'v-push';
    out.push(withAdd({ id: 'balance:pull', kind: 'balance', title: 'More pulling than pushing', reason: `About ${weekly(pull)} of pulling against ${fmtSets(push)} of pressing. Many coaches aim for roughly equal amounts.` }, suggest(FOR_PATTERN[p], patternIs(p))));
  }
  if (plan.Hamstrings > 0 && plan.Quadriceps >= 6 && plan.Quadriceps >= 2 * plan.Hamstrings) {
    out.push(withAdd({ id: 'balance:legs', kind: 'balance', title: 'Quads outweigh hamstrings', reason: `About ${weekly(plan.Quadriceps)} for quads against ${fmtSets(plan.Hamstrings)} for hamstrings.` }, suggest(FOR_MUSCLE.Hamstrings, primaryIs('Hamstrings'))));
  }

  // 4. A major muscle with very little: under 4 sets a week.
  for (const m of MAJOR_MUSCLES) {
    if (plan[m] <= 0 || plan[m] >= 4) continue;
    out.push(withAdd({ id: `low:${m}`, kind: 'low', title: `Light on ${name(m)}`, reason: `About ${weekly(plan[m])} at ${plural(weekGoal, 'workout')} a week. 10 or more hard sets is the usual target for growth.` }, suggest(FOR_MUSCLE[m], primaryIs(m))));
  }

  // 5. A main movement pattern missing, then ideas worth trying.
  for (const p of [...MAIN_PATTERNS, ...IDEA_PATTERNS]) {
    if (ps(p) > 0) continue;
    const t = PATTERN_TEXT[p];
    out.push(withAdd({ id: `pattern:${p}`, kind: IDEA_PATTERNS.includes(p) ? 'idea' : 'pattern', title: t.title, reason: `Your routines don't include ${t.what}.` }, suggest(FOR_PATTERN[p], patternIs(p))));
  }

  // At most 3, never two that suggest the same exercise.
  const seen = new Set<string>();
  return out.filter((f) => {
    if (!f.add) return true;
    if (seen.has(f.add.exerciseId)) return false;
    seen.add(f.add.exerciseId);
    return true;
  }).slice(0, limit).map((f) => ({ ...f, title: cap(f.title) }));
}
