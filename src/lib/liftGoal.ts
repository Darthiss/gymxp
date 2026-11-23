// "Lift <name>": three strength benchmarks for picking up and carrying a person safely. The person's
// name and weight live in your private data (Profile.liftGoal), never in the app's code.
//
// Each benchmark accepts the exercises that train the same thing, each with its own target, and
// counts whichever is closest to done:
// - Deadlift, for lifting from the floor with a flat back: a deadlift or sumo deadlift at 1.5× your
//   bodyweight (estimated 1RM), or a Romanian deadlift at 1.1×. An RDL starts from the top and stops
//   at mid-shin, so most people handle about three quarters of their deadlift on it.
// - Squat, for getting down and up with weight in front of you: a goblet squat with half their
//   weight for 10, or a back squat with their weight for 5. Real sets, not estimates.
// - Front carry, for holding someone in your arms and walking: a front carry with their weight for
//   20 seconds, or a goblet carry with half their weight for 40. The person is twice the load of the
//   dumbbell, so the dumbbell is held twice as long.
// Left out on purpose: the leg press (the machine does the balancing, and numbers differ between
// machines), the farmer's walk (the weight hangs at your sides, not in your arms) and the kettlebell
// deadlift (gym kettlebells stop far short of the target; it's how you learn the hinge).
import { e1rm, workingSets, type GameState } from './engine';
import { DEADLIFT } from './trophies';
import type { LiftGoal } from './types';

export const SUMO = 'Sumo_Deadlift';
export const RDL = 'Romanian_Deadlift';
export const GOBLET = 'Goblet_Squat';
export const BACK_SQUAT = 'Barbell_Squat';
export const FRONT_CARRY = 'Front_Carry';
export const GOBLET_CARRY = 'Goblet_Carry';

export const DEADLIFT_XBW = 1.5;
export const RDL_XBW = 1.1;
export const GOBLET_SHARE = 0.5; // of their weight
export const GOBLET_REPS = 10;
export const SQUAT_REPS = 5;
export const CARRY_SECONDS = 20;
export const GOBLET_CARRY_SECONDS = 40;

/** Half their weight, to the nearest 2 kg (dumbbells usually go up in 2s), and never under 8 kg. */
export const gobletTarget = (personKg: number) => Math.max(8, Math.round((personKg * GOBLET_SHARE) / 2) * 2);
/** Their weight, to the nearest 2.5 kg a barbell can be loaded to. */
export const squatTarget = (personKg: number) => Math.round(personKg / 2.5) * 2.5;

export interface Benchmark {
  id: 'deadlift' | 'goblet' | 'carry';
  exerciseId: string; // the exercise that counts right now, or the main one before any is logged
  icon: string;
  title: string;
  target: string; // "99 kg, 1.5× your bodyweight"
  best: string | null; // your best so far, or null if none of its exercises is logged
  pct: number; // 0–1
  done: boolean;
  also: string[]; // the other exercises that count, by name
}

/** One way to meet a benchmark. `e1rm`: estimated 1RM. `set`: a real set of `reps`. `carry`: weight × seconds. */
interface Option {
  exerciseId: string;
  name: string; // lower case, for "(Romanian deadlift)"
  kind: 'e1rm' | 'set' | 'carry';
  kg: number; // 0: can't be set yet (no weigh-in)
  reps: number; // or seconds, for a carry
  target: string;
}

interface Scored {
  pct: number;
  done: boolean;
  best: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function scored(g: GameState, o: Option): Scored {
  if (o.kind === 'e1rm') {
    const best = g.bests.get(o.exerciseId)?.maxE1rm ?? 0;
    return {
      pct: o.kg ? Math.min(1, best / o.kg) : 0,
      done: o.kg > 0 && best >= o.kg,
      best: best ? `${r1(best)} kg estimated 1RM` : null,
    };
  }
  const sets = (g.history.get(o.exerciseId) ?? []).flatMap((h) => workingSets(h.sets));
  if (o.kind === 'set') {
    // Done with a real set at the target; until then, progress by estimated 1RM.
    const top = sets.reduce<{ kg: number; reps: number } | null>((a, s) => (!a || e1rm(s.kg, s.reps) > e1rm(a.kg, a.reps) ? s : a), null);
    const done = sets.some((s) => s.kg >= o.kg && s.reps >= o.reps);
    return {
      pct: done ? 1 : top ? Math.min(0.99, e1rm(top.kg, top.reps) / e1rm(o.kg, o.reps)) : 0,
      done,
      best: top ? `${top.kg} kg × ${top.reps}` : null,
    };
  }
  // A carry: weight and time both count, each up to the target.
  const score = (s: { kg: number; reps: number }) => Math.min(1, s.kg / o.kg) * Math.min(1, s.reps / o.reps);
  const top = sets.reduce<{ kg: number; reps: number } | null>((a, s) => (!a || score(s) > score(a) ? s : a), null);
  return { pct: top ? score(top) : 0, done: !!top && score(top) >= 1, best: top ? `${top.kg} kg · ${top.reps} s` : null };
}

/** The option closest to done; before any is logged, the first (main) one. */
function benchmark(g: GameState, id: Benchmark['id'], icon: string, title: string, options: Option[]): Benchmark {
  const all = options.map((o) => ({ o, s: scored(g, o) }));
  const pick = all.reduce((a, x) => (x.s.pct > a.s.pct || (!a.s.best && x.s.best) ? x : a));
  const main = pick.o === options[0];
  return {
    id,
    exerciseId: pick.o.exerciseId,
    icon,
    title,
    target: pick.o.target,
    best: pick.s.best ? (main ? pick.s.best : `${pick.s.best} (${pick.o.name})`) : null,
    pct: pick.s.pct,
    done: pick.s.done,
    also: options.filter((o) => o !== pick.o).map((o) => o.name),
  };
}

/** Your progress on each benchmark, from the whole log. `bodyweight` is your current weekly average
 *  (0 if you've never weighed in: the deadlift targets need it). */
export function liftBenchmarks(g: GameState, goal: LiftGoal, bodyweight: number): Benchmark[] {
  const xbw = (x: number) => (bodyweight > 0 ? x * bodyweight : 0);
  const bwText = (x: number) => (bodyweight > 0 ? `${r1(x * bodyweight)} kg, ${x}× your bodyweight` : `${x}× your bodyweight (log a weigh-in)`);
  const gkg = gobletTarget(goal.kg);
  const skg = squatTarget(goal.kg);
  return [
    benchmark(g, 'deadlift', '🏋️', 'Deadlift', [
      { exerciseId: DEADLIFT, name: 'deadlift', kind: 'e1rm', kg: xbw(DEADLIFT_XBW), reps: 1, target: bwText(DEADLIFT_XBW) },
      { exerciseId: SUMO, name: 'sumo deadlift', kind: 'e1rm', kg: xbw(DEADLIFT_XBW), reps: 1, target: `Sumo deadlift ${bwText(DEADLIFT_XBW)}` },
      { exerciseId: RDL, name: 'Romanian deadlift', kind: 'e1rm', kg: xbw(RDL_XBW), reps: 1, target: `Romanian deadlift ${bwText(RDL_XBW)}` },
    ]),
    benchmark(g, 'goblet', '🦵', 'Squat', [
      { exerciseId: GOBLET, name: 'goblet squat', kind: 'set', kg: gkg, reps: GOBLET_REPS, target: `Goblet squat ${gkg} kg × ${GOBLET_REPS}, half of ${goal.name}'s weight` },
      { exerciseId: BACK_SQUAT, name: 'back squat', kind: 'set', kg: skg, reps: SQUAT_REPS, target: `Back squat ${skg} kg × ${SQUAT_REPS}, ${goal.name}'s weight` },
    ]),
    benchmark(g, 'carry', '🤲', 'Front carry', [
      { exerciseId: FRONT_CARRY, name: 'front carry', kind: 'carry', kg: goal.kg, reps: CARRY_SECONDS, target: `${r1(goal.kg)} kg for ${CARRY_SECONDS} s, ${goal.name}'s weight` },
      { exerciseId: GOBLET_CARRY, name: 'goblet carry', kind: 'carry', kg: gkg, reps: GOBLET_CARRY_SECONDS, target: `Goblet carry ${gkg} kg for ${GOBLET_CARRY_SECONDS} s, half of ${goal.name}'s weight` },
    ]),
  ];
}

/** The goal as one number: the average of the three. */
export const liftGoalPct = (bs: Benchmark[]) => bs.reduce((a, b) => a + b.pct, 0) / bs.length;
