// Hero Physique goal: "Spider-Man-style" lean, athletic, natural physique.
//
// What's actually reported about Tom Holland's training (Men's Health, Generation Iron, Fitbook):
// trainer Duffy Gaver; a bodyweight ladder of pull-ups, dips, push-ups, sit-ups and squats
// (1→10→1, 1,500 reps) most Monday mornings; a "bodybuilding mindset paired with bodyweight
// work"; ~1.73 m and ~63–70 kg (unofficial). He doesn't chase 1-rep maxes.
//
// So the goal is scored on what builds and *shows* that physique, measured only from what you log:
//   1. Bodyweight mastery   – strict pull-ups, dips, push-ups, leg raises (relative strength)
//   2. Hero benchmarks      – his ladder + the "Cindy" 20-min AMRAP conditioning test
//   3. Physique volume      – ≥10 hard sets / muscle / week over 12 weeks (Schoenfeld 2017 dose-response), V-taper bias
//   4. Getting stronger     – progressive overload on your own main lifts (machine-friendly)
//   5. Training age         – a natural physique takes years: ~400 gym days
// Estimates (e.g. pull-ups from the assisted machine) may take a metric to 80 %; the last 20 %
// needs real strict reps. Targets are our estimate of a fit, natural "hero" level, not his stats.

import type { Exercise, MuscleGroup } from './types';

export const HERO_IDS = {
  pull: ['Pullups', 'Chin-Up'],
  pullAssist: 'Assisted_Pull-Up_Machine',
  dip: ['Parallel_Bar_Dip'],
  dipAssist: 'Assisted_Dip_Machine',
  push: ['Pushups'],
  // flat presses that can estimate push-up capacity (value = factor to "barbell-equivalent" e1RM)
  pushEstimate: { 'Barbell_Bench_Press_-_Medium_Grip': 1, Smith_Machine_Bench_Press: 1, Dumbbell_Bench_Press: 1 / 0.85 } as Record<string, number>,
  core: ['Hanging_Leg_Raise'],
  cindy: 'Hero_Cindy',
  ladder: 'Hero_Ladder',
};

export const HERO_TARGETS = {
  pullups: 15, // the ladder's top rung asks for 10 pull-ups after 9 rounds of work
  dips: 25, // top rung: 20 dips under heavy fatigue
  pushups: 50, // top rung: 30 push-ups under heavy fatigue
  legRaises: 15,
  cindyRounds: 20, // "advanced" by common CrossFit standards
  ladderMinutes: 45, // our target for the full 19 rungs
  setsPerMuscle: 10, // weekly hard sets per muscle group
  strengthGain: 0.5, // +50 % estimated 1RM vs. your start on your main lifts
  gymDays: 400, // ≈ 2.5–3 years at 3/week
};

export const HERO_VOLUME_WEEKS = 12; // physique volume is averaged over this many weeks
export const ESTIMATE_CAP = 0.8; // estimates alone max out at 80 % of a target
export const FIRST_REP_SHARE = 0.15; // getting your first strict rep is worth 15 % of a rep target

// Ladder: rung r (1..10..1) has r pull-ups, 2r dips, 3r push-ups, 4r sit-ups, 5r squats.
export const LADDER_RUNGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const LADDER_BW_PER_UNIT = 1 * 1 + 2 * 0.9 + 3 * 0.64 + 4 * 0.25 + 5 * 0.35; // effort-adjusted bodyweights per "r" (same factors as the exercises)
/** Total reps and bodyweight-equivalents moved for N completed rungs. */
export function ladderWork(rungs: number) {
  const units = LADDER_RUNGS.slice(0, Math.max(0, Math.min(19, Math.round(rungs)))).reduce((a, b) => a + b, 0);
  return { reps: units * 15, bwUnits: units * LADDER_BW_PER_UNIT };
}

/** Best-ever capacity for a bodyweight skill. `strict` = real reps; `est` = estimated reps; `frac` = progress toward the first rep (0..1). */
export interface Capacity { strict: number; est: number; frac: number }
export const emptyCapacity = (): Capacity => ({ strict: 0, est: 0, frac: 0 });

/** Estimated bodyweight reps from an equivalent 1RM (Epley): reps = 30·(1RM/load − 1). */
export function capacityFrom(e1rm: number, load: number): { est: number; frac: number } {
  if (load <= 0 || e1rm <= 0) return { est: 0, frac: 0 };
  const ratio = e1rm / load;
  return ratio >= 1 ? { est: 30 * (ratio - 1), frac: 1 } : { est: 0, frac: ratio };
}

/** Score 0..1 for a rep target, giving credit for approaching the first rep and capping estimates. */
export function repScore(c: Capacity, target: number): { score: number; reps: number; estimated: boolean } {
  const strictScore = c.strict >= 1 ? FIRST_REP_SHARE + (1 - FIRST_REP_SHARE) * Math.min(1, c.strict / target) : 0;
  const estScore = Math.min(
    ESTIMATE_CAP,
    c.est >= 1 ? FIRST_REP_SHARE + (1 - FIRST_REP_SHARE) * Math.min(1, c.est / target) : FIRST_REP_SHARE * c.frac,
  );
  return strictScore >= estScore
    ? { score: strictScore, reps: c.strict, estimated: false }
    : { score: estScore, reps: Math.floor(c.est), estimated: true };
}

export interface HeroInput {
  bodyweight: number;
  bodyweightKnown: boolean;
  pull: Capacity;
  dip: Capacity;
  push: Capacity;
  core: Capacity;
  cindyRounds: number;
  ladderRungs: number;
  ladderBestMinutes: number; // best time for all 19 rungs, 0 = never completed
  weeklySets: Record<'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs', number>; // avg over the last 12 weeks
  weeklyCredit: Record<'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs', number>; // same, each week capped at the target
  strengthGain: number | null; // median e1RM gain vs. start on main lifts (0.3 = +30 %), null = not enough data
  strengthLifts: number;
  gymDays: number;
}

export interface HeroMetric { label: string; value: string; score: number; hint?: string; estimated?: boolean }
export interface HeroPillar { id: string; icon: string; name: string; weight: number; score: number; metrics: HeroMetric[]; tip: string }
export interface HeroStage { min: number; name: string; icon: string; xp: number }
export interface HeroResult { pct: number; pillars: HeroPillar[]; stage: HeroStage; next?: HeroStage }

export const HERO_STAGES: HeroStage[] = [
  { min: 0, name: 'Civilian', icon: '🧑', xp: 0 },
  { min: 0.1, name: 'Trainee', icon: '🎒', xp: 100 },
  { min: 0.25, name: 'Vigilante', icon: '🦹', xp: 250 },
  { min: 0.45, name: 'Street-Level Hero', icon: '🏙️', xp: 500 },
  { min: 0.65, name: 'Avenger-Ready', icon: '🛡️', xp: 900 },
  { min: 0.85, name: 'Hero Physique', icon: '🕷️', xp: 1500 },
  { min: 0.999, name: 'Peak Hero', icon: '🦸', xp: 3000 },
];

const MUSCLES: (keyof HeroInput['weeklySets'])[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'];
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function scoreHero(h: HeroInput): HeroResult {
  const T = HERO_TARGETS;
  const pull = repScore(h.pull, T.pullups);
  const dip = repScore(h.dip, T.dips);
  const push = repScore(h.push, T.pushups);
  const core = repScore(h.core, T.legRaises);
  const repLabel = (r: { reps: number; estimated: boolean }, c: Capacity, target: number) =>
    r.reps >= 1 ? `${r.reps}${r.estimated ? ' (est.)' : ''} / ${target}` : c.frac > 0 ? `${pct(c.frac)} of first rep` : `0 / ${target}`;

  const bodyweight: HeroPillar = {
    id: 'bodyweight', icon: '🤸', name: 'Bodyweight mastery', weight: 0.3,
    score: pull.score * 0.4 + dip.score * 0.25 + push.score * 0.25 + core.score * 0.1,
    metrics: [
      { label: 'Strict pull-ups (one set)', value: repLabel(pull, h.pull, T.pullups), score: pull.score, estimated: pull.estimated, hint: 'Pull-up / Chin-up, or the Assisted Pull-Up machine (less assist = closer)' },
      { label: 'Dips (one set)', value: repLabel(dip, h.dip, T.dips), score: dip.score, estimated: dip.estimated, hint: 'Parallel Bar Dip or the Assisted Dip machine' },
      { label: 'Push-ups (one set)', value: repLabel(push, h.push, T.pushups), score: push.score, estimated: push.estimated, hint: 'Push-up; a barbell/dumbbell bench press also estimates it' },
      { label: 'Hanging leg raises', value: repLabel(core, h.core, T.legRaises), score: core.score, estimated: core.estimated },
    ],
    tip: 'Relative strength is the core of the look: own your bodyweight. Estimates cap at 80%; finish with real strict reps.',
  };

  const cindy = Math.min(1, h.cindyRounds / T.cindyRounds);
  const ladderDone = h.ladderRungs >= 19;
  const ladder = !ladderDone
    ? 0.7 * (ladderWork(h.ladderRungs).reps / 1500)
    : 0.7 + 0.3 * Math.min(1, Math.max(0, (90 - h.ladderBestMinutes) / (90 - T.ladderMinutes)));
  const benchmarks: HeroPillar = {
    id: 'benchmarks', icon: '🕷️', name: 'Hero benchmarks', weight: 0.15,
    score: ladder * 0.6 + cindy * 0.4,
    metrics: [
      { label: 'The Holland Ladder (1,500 reps)', value: ladderDone ? `Done ✓${h.ladderBestMinutes ? ` · best ${h.ladderBestMinutes} min (target ${T.ladderMinutes})` : ''}` : h.ladderRungs ? `${h.ladderRungs} / 19 rungs` : 'not attempted', score: ladder },
      { label: 'Cindy: rounds in 20 min', value: h.cindyRounds ? `${h.cindyRounds} / ${T.cindyRounds}` : 'not attempted', score: cindy },
    ],
    tip: 'Test these every 4–6 weeks, scaled at first. Completing the ladder is 70% of that bar; speed earns the rest.',
  };

  const muscleScores = MUSCLES.map((m) => Math.min(1, h.weeklyCredit[m] / T.setsPerMuscle));
  const vtaper = h.weeklySets.Chest > 0 ? Math.min(1, (h.weeklySets.Back + 0.5 * h.weeklySets.Shoulders) / (1.2 * h.weeklySets.Chest)) : h.weeklySets.Back > 0 ? 1 : 0;
  const physique: HeroPillar = {
    id: 'physique', icon: '📐', name: 'Physique volume', weight: 0.2,
    score: 0.8 * (muscleScores.reduce((a, b) => a + b, 0) / MUSCLES.length) + 0.2 * vtaper,
    metrics: [
      ...MUSCLES.map((m, i) => ({ label: `${m}: sets per week`, value: `${h.weeklySets[m].toFixed(1)} / ${T.setsPerMuscle}`, score: muscleScores[i] })),
      { label: 'V-taper: back & shoulders vs chest', value: pct(vtaper), score: vtaper, hint: 'Do at least as much back work as chest work' },
    ],
    tip: 'Muscle grows from ~10+ hard sets per muscle each week, sustained for months. Averaged over your last 12 weeks, so it rewards steady training and drops if you stop.',
  };

  const gainScore = h.strengthGain === null ? 0 : Math.min(1, Math.max(0, h.strengthGain) / T.strengthGain);
  const stronger: HeroPillar = {
    id: 'stronger', icon: '📈', name: 'Getting stronger', weight: 0.15,
    score: gainScore,
    metrics: [{
      label: 'Strength gained on your main lifts',
      value: h.strengthGain === null ? 'needs 2+ exercises with 4+ sessions' : `+${Math.round(h.strengthGain * 100)}% / +${T.strengthGain * 100}%`,
      score: gainScore,
      hint: h.strengthGain === null ? undefined : `median of your ${h.strengthLifts} most-trained exercises, estimated 1RM vs. your first sessions`,
    }],
    tip: 'Progressive overload on the moves you do most, machines included. Moderate weight, more reps or more kg over time.',
  };

  const days = Math.min(1, h.gymDays / T.gymDays);
  const training: HeroPillar = {
    id: 'training', icon: '🗓️', name: 'Training age', weight: 0.2,
    score: days,
    metrics: [{ label: 'Gym days', value: `${h.gymDays} / ${T.gymDays}`, score: days }],
    tip: 'Natural muscle is built over years. ~400 consistent gym days (2.5–3 years) is a realistic hero timeline.',
  };

  const pillars = [bodyweight, benchmarks, physique, stronger, training];
  const total = pillars.reduce((a, p) => a + p.weight * p.score, 0);
  let stage = HERO_STAGES[0];
  for (const s of HERO_STAGES) if (total >= s.min) stage = s;
  return { pct: total, pillars, stage, next: HERO_STAGES[HERO_STAGES.indexOf(stage) + 1] };
}

/** Load for a "virtual bodyweight rep" of a given exercise, for capacity estimates. */
export function bwShare(ex: Exercise | undefined): number {
  return ex?.bwFactor ?? 1;
}

export type HeroMuscle = keyof HeroInput['weeklySets'];
export const heroMuscle = (g: MuscleGroup): HeroMuscle | null => (g === 'Glutes' ? 'Legs' : g === 'Core' ? null : g);
