// "How far am I from…" with famous lifters: flavor over your real numbers, plus their challenges
// in trophies.ts. Lifts are the commonly *reported* bests (approximate, kg). Career gym days are
// rough estimates (years of serious training × typical days per week). For fun, not science.
import type { GameState } from './engine';
import { BENCH, DEADLIFT, SQUAT } from './trophies';
import { plural } from './util';

export interface LegendMetric {
  key: 'bench' | 'squat' | 'deadlift';
  label: string;
  target: number;
  unit: string;
}

export interface Legend {
  id: string;
  name: string;
  short: string;
  icon: string;
  blurb: string;
  careerDays: number; // gym days over a career, estimated
  daysPerWeek: number; // estimated
  signature: string; // the lift you're compared with, e.g. "500 kg deadlift"
  signatureKg: number;
  lifts: LegendMetric[];
  note?: string;
}

const lift = (key: LegendMetric['key'], kg: number): LegendMetric => ({
  key, label: key === 'bench' ? 'Bench press' : key === 'squat' ? 'Squat' : 'Deadlift', target: kg, unit: 'kg',
});

export const LEGENDS: Legend[] = [
  {
    id: 'arnold', name: 'Arnold Schwarzenegger', short: 'Arnold', icon: '🏆',
    blurb: '7× Mr. Olympia, the Austrian Oak.',
    careerDays: 5000, daysPerWeek: 6, signature: '322 kg deadlift', signatureKg: 322,
    lifts: [lift('bench', 227), lift('squat', 247), lift('deadlift', 322)],
    note: 'Reported bests: bench ~500 lb, squat ~545 lb, deadlift ~710 lb. ~16 years at ~6 days/week.',
  },
  {
    id: 'ronnie', name: 'Ronnie Coleman', short: 'Ronnie', icon: '👑',
    blurb: '8× Mr. Olympia. “Yeah buddy! Light weight!”',
    careerDays: 5500, daysPerWeek: 6, signature: '363 kg squat', signatureKg: 363,
    lifts: [lift('bench', 227), lift('squat', 363), lift('deadlift', 363)],
    note: 'Famous 800 lb (363 kg) squat and deadlift for reps; ~500 lb bench for reps. ~18 years at ~6 days/week.',
  },
  {
    id: 'eddie', name: 'Eddie Hall', short: 'Eddie', icon: '🧔',
    blurb: "World's Strongest Man 2017; first human to deadlift 500 kg.",
    careerDays: 3500, daysPerWeek: 5, signature: '500 kg deadlift', signatureKg: 500,
    lifts: [lift('deadlift', 500)],
    note: '500 kg deadlift world record (2016). Training days are a rough estimate.',
  },
  {
    id: 'thor', name: 'Hafþór Björnsson', short: 'Thor', icon: '🐉',
    blurb: "The Mountain: World's Strongest Man 2018.",
    careerDays: 3500, daysPerWeek: 5, signature: '501 kg deadlift', signatureKg: 501,
    lifts: [lift('deadlift', 501)],
    note: '501 kg deadlift world record (2020). Training days are a rough estimate.',
  },
];

/** Your gym days told as a story: "as many days as Arnold's first 6 months". */
export function careerClock(visits: number, l: Legend): string {
  if (visits >= l.careerDays) return `You've trained more days than ${l.short}'s whole estimated career.`;
  const weeks = visits / l.daysPerWeek;
  const span = weeks <= 1 ? 'first week'
    : weeks < 9 ? `first ${plural(Math.round(weeks), 'week')}`
    : weeks < 104 ? `first ${plural(Math.round(weeks / 4.345), 'month')}`
    : `first ${+(weeks / 52).toFixed(1)} years`;
  return `You've trained as many days as ${l.short}'s ${span}.`;
}

/** How many times your total volume adds up to the legend's famous lift. Machines count. */
export const timesMoved = (totalVolume: number, l: Legend) => Math.floor(totalVolume / l.signatureKg);

export interface LegendProgress {
  legend: Legend;
  rows: { metric: LegendMetric; mine: number; pct: number }[]; // only lifts you've actually logged
}

/** Your best estimated 1-rep max (Epley) on the barbell lift, 0 if never logged. */
function liftOf(g: GameState, key: LegendMetric['key']): number {
  const id = key === 'bench' ? BENCH : key === 'squat' ? SQUAT : DEADLIFT;
  return Math.round((g.bests.get(id)?.maxE1rm ?? 0) * 10) / 10;
}

export function compare(g: GameState, legend: Legend): LegendProgress {
  const rows = legend.lifts
    .map((metric) => ({ metric, mine: liftOf(g, metric.key) }))
    .filter((r) => r.mine > 0)
    .map((r) => ({ ...r, pct: Math.min(1, r.mine / r.metric.target) }));
  return { legend, rows };
}
