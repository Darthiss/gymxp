// "Lift <name>": three strength benchmarks for picking up and carrying a person safely. The person's
// name and weight live in your private data (Profile.liftGoal), never in the app's code.
// - Deadlift 1.5× your bodyweight: lifting from the floor with a flat back.
// - Goblet squat with half their weight for 10: squatting down and standing up with a load in front.
// - Front carry with their full weight for 20 seconds: holding someone in your arms and walking. A
//   goblet carry (one dumbbell at the chest) is the same pattern, so it counts too.
import { e1rm, workingSets, type GameState } from './engine';
import { DEADLIFT } from './trophies';
import type { LiftGoal } from './types';

export const GOBLET = 'Goblet_Squat';
export const FRONT_CARRY = 'Front_Carry';
export const GOBLET_CARRY = 'Goblet_Carry';

export const DEADLIFT_XBW = 1.5;
export const GOBLET_SHARE = 0.5; // of their weight
export const GOBLET_REPS = 10;
export const CARRY_SECONDS = 20;

/** Half their weight, to the nearest 2 kg (dumbbells usually go up in 2s), and never under 8 kg. */
export const gobletTarget = (personKg: number) => Math.max(8, Math.round((personKg * GOBLET_SHARE) / 2) * 2);

export interface Benchmark {
  id: 'deadlift' | 'goblet' | 'carry';
  exerciseId: string;
  icon: string;
  title: string;
  target: string; // "100 kg, 1.5× your bodyweight"
  best: string | null; // your best so far, or null if never logged
  pct: number; // 0–1
  done: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Your progress on each benchmark, from the whole log. `bodyweight` is your current weekly average
 *  (0 if you've never weighed in: the deadlift target needs it). */
export function liftBenchmarks(g: GameState, goal: LiftGoal, bodyweight: number): Benchmark[] {
  // Deadlift: estimated 1RM against 1.5× bodyweight.
  const dlBest = g.bests.get(DEADLIFT)?.maxE1rm ?? 0;
  const dlTarget = bodyweight > 0 ? DEADLIFT_XBW * bodyweight : 0;
  const deadlift: Benchmark = {
    id: 'deadlift', exerciseId: DEADLIFT, icon: '🏋️', title: 'Deadlift',
    target: dlTarget ? `${r1(dlTarget)} kg, ${DEADLIFT_XBW}× your bodyweight` : `${DEADLIFT_XBW}× your bodyweight (log a weigh-in)`,
    best: dlBest ? `${r1(dlBest)} kg estimated 1RM` : null,
    pct: dlTarget ? Math.min(1, dlBest / dlTarget) : 0,
    done: dlTarget > 0 && dlBest >= dlTarget,
  };

  // Goblet squat: done with a real set of 10 at the target; until then, progress by estimated 1RM.
  const gkg = gobletTarget(goal.kg);
  const gSets = (g.history.get(GOBLET) ?? []).flatMap((h) => workingSets(h.sets));
  const gTop = gSets.reduce<{ kg: number; reps: number } | null>((a, s) => (!a || e1rm(s.kg, s.reps) > e1rm(a.kg, a.reps) ? s : a), null);
  const gDone = gSets.some((s) => s.kg >= gkg && s.reps >= GOBLET_REPS);
  const goblet: Benchmark = {
    id: 'goblet', exerciseId: GOBLET, icon: '🦵', title: 'Goblet squat',
    target: `${gkg} kg × ${GOBLET_REPS}, half of ${goal.name}'s weight`,
    best: gTop ? `${gTop.kg} kg × ${gTop.reps}` : null,
    pct: gDone ? 1 : gTop ? Math.min(0.99, e1rm(gTop.kg, gTop.reps) / e1rm(gkg, GOBLET_REPS)) : 0,
    done: gDone,
  };

  // Front carry: weight and time both count, up to their weight for 20 s. Front and goblet carries both count.
  type CarrySet = { kg: number; reps: number; id: string };
  const cSets: CarrySet[] = [FRONT_CARRY, GOBLET_CARRY].flatMap((id) => (g.history.get(id) ?? []).flatMap((h) => workingSets(h.sets).map((s) => ({ ...s, id }))));
  const score = (s: { kg: number; reps: number }) => Math.min(1, s.kg / goal.kg) * Math.min(1, s.reps / CARRY_SECONDS);
  const cTop = cSets.reduce<CarrySet | null>((a, s) => (!a || score(s) > score(a) ? s : a), null);
  const carry: Benchmark = {
    id: 'carry', exerciseId: cTop?.id ?? FRONT_CARRY, icon: '🤲', title: 'Front carry',
    target: `${r1(goal.kg)} kg for ${CARRY_SECONDS} s, ${goal.name}'s weight`,
    best: cTop ? `${cTop.kg} kg · ${cTop.reps} s${cTop.id === GOBLET_CARRY ? ' (goblet carry)' : ''}` : null,
    pct: cTop ? score(cTop) : 0,
    done: !!cTop && score(cTop) >= 1,
  };

  return [deadlift, goblet, carry];
}

/** The goal as one number: the average of the three. */
export const liftGoalPct = (bs: Benchmark[]) => bs.reduce((a, b) => a + b.pct, 0) / bs.length;
