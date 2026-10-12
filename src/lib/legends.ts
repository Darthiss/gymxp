// "How far am I from…" comparisons with famous lifters and your Hero goal.
// Lifts are the commonly *reported* bests (approximate, kg). Career gym days are rough
// estimates (years of serious training × typical days per week). For fun, not science.
import { BENCH, DEADLIFT, SQUAT, type GameState } from './xp';

export interface LegendMetric {
  key: 'visits' | 'bench' | 'squat' | 'deadlift' | 'pullups';
  label: string;
  target: number;
  unit: string;
}

export interface Legend {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  metrics: LegendMetric[];
  note?: string;
}

const visits = (n: number, label = 'Gym days (est.)'): LegendMetric => ({ key: 'visits', label, target: n, unit: 'days' });
const lift = (key: 'bench' | 'squat' | 'deadlift', kg: number): LegendMetric => ({
  key, label: key === 'bench' ? 'Bench press' : key === 'squat' ? 'Squat' : 'Deadlift', target: kg, unit: 'kg',
});

/** Your goal: a lean, strong, natural "superhero actor" physique. Targets scale with your bodyweight. */
export function heroGoal(bodyweight: number): Legend {
  const bw = bodyweight || 70;
  const r = (x: number) => Math.round(x / 2.5) * 2.5;
  return {
    id: 'hero',
    name: 'Hero Physique',
    icon: '🦸',
    blurb: 'Your Tom Holland goal: lean, athletic, strong and natural.',
    metrics: [
      visits(500, 'Gym days'),
      lift('bench', r(bw * 1.25)),
      lift('squat', r(bw * 1.5)),
      lift('deadlift', r(bw * 2)),
      { key: 'pullups', label: 'Strict pull-ups (one set)', target: 12, unit: 'reps' },
    ],
    note: `Targets are typical strength standards for a fit, natural intermediate lifter at your bodyweight (${bodyweight ? `${bw} kg` : 'log your weight; using 70 kg'}): bench 1.25×, squat 1.5×, deadlift 2× bodyweight, 12 pull-ups, ~3-4 years of consistent training. Tom Holland's own numbers aren't public.`,
  };
}

export const LEGENDS: Legend[] = [
  {
    id: 'arnold', name: 'Arnold Schwarzenegger', icon: '🏆',
    blurb: '7× Mr. Olympia, the Austrian Oak.',
    metrics: [visits(5000), lift('bench', 227), lift('squat', 247), lift('deadlift', 322)],
    note: 'Reported bests: bench ~500 lb, squat ~545 lb, deadlift ~710 lb. ~16 years at ~6 days/week.',
  },
  {
    id: 'ronnie', name: 'Ronnie Coleman', icon: '👑',
    blurb: '8× Mr. Olympia. “Yeah buddy! Light weight!”',
    metrics: [visits(5500), lift('bench', 227), lift('squat', 363), lift('deadlift', 363)],
    note: 'Famous 800 lb (363 kg) squat and deadlift for reps; ~500 lb bench for reps. ~18 years at ~6 days/week.',
  },
  {
    id: 'eddie', name: 'Eddie Hall', icon: '🧔',
    blurb: "World's Strongest Man 2017; first human to deadlift 500 kg.",
    metrics: [visits(3500), lift('deadlift', 500)],
    note: '500 kg deadlift world record (2016). Only his famous lift is included.',
  },
  {
    id: 'thor', name: 'Hafþór Björnsson', icon: '🐉',
    blurb: "The Mountain: World's Strongest Man 2018.",
    metrics: [visits(3500), lift('deadlift', 501)],
    note: '501 kg deadlift world record (2020). Only his famous lift is included.',
  },
];

export interface LegendProgress {
  legend: Legend;
  pct: number; // average of each metric's progress, each capped at 100%
  rows: { metric: LegendMetric; mine: number; pct: number }[];
}

/** Your best estimated 1-rep max (Epley) on the barbell lift, 0 if never logged. */
function liftOf(g: GameState, key: 'bench' | 'squat' | 'deadlift'): number {
  const id = key === 'bench' ? BENCH : key === 'squat' ? SQUAT : DEADLIFT;
  return Math.round((g.bests.get(id)?.maxE1rm ?? 0) * 10) / 10;
}

export function compare(g: GameState, legend: Legend): LegendProgress {
  const rows = legend.metrics.map((m) => {
    const mine = m.key === 'visits' ? g.visits : m.key === 'pullups' ? g.maxPullups : liftOf(g, m.key);
    return { metric: m, mine, pct: Math.min(1, m.target ? mine / m.target : 0) };
  });
  return { legend, rows, pct: rows.reduce((a, r) => a + r.pct, 0) / rows.length };
}
