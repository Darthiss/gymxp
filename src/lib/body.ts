// Body measures and the few health formulas the app uses. They are population rules of thumb,
// shown for information only: none of them is a diagnosis, and the copy must never say otherwise.
// Where a formula or range differs between women and men, the profile's sex picks it (see
// docs/GAME_DESIGN.md#sex-specific-review-november-2026). 'other' and unset use the formulas that
// don't depend on sex, and skip the ones that only exist per sex.
import { addDays, parseDate, today, weekKey } from './util';
import type { Phase, PhaseType, Profile, Sex, WeightEntry } from './types';

export const DISCLAIMER = 'Bro is for information and motivation, not medical advice. Check with a doctor before starting or changing a training plan, especially if you have a health condition.';
export const DISCLAIMER_SHORT = 'For information only, not medical advice.';

// ---------- Weight for height ----------

export const BMI_MIN = 18.5; // below this is underweight (WHO)
export const BMI_MAX = 25;

export const bmiOf = (kg: number, heightCm: number) => kg / (heightCm / 100) ** 2;
export const kgAtBmi = (bmi: number, heightCm: number) => bmi * (heightCm / 100) ** 2;

export function bmiLabel(bmi: number): string {
  return bmi < BMI_MIN ? 'underweight range' : bmi < BMI_MAX ? 'healthy range' : bmi < 30 ? 'overweight range' : 'obese range';
}

/** BMI bands are defined for adults, so they aren't shown to anyone under 20. */
export const bmiApplies = (age: number | null) => age === null || age >= 20;

/** The lowest goal weight the app accepts, to one decimal: a BMI of 18.5. null until height is known. */
export const minGoalKg = (heightCm: number | null) => (heightCm ? Math.ceil(kgAtBmi(BMI_MIN, heightCm) * 10) / 10 : null);

/** A goal below a healthy weight for your height is never set or celebrated. */
export const goalAllowed = (goalKg: number, heightCm: number | null) => !heightCm || goalKg >= kgAtBmi(BMI_MIN, heightCm);

// ---------- Waist ----------
// Measured at the belly button, relaxed, after a normal breath out. That's the site the US Navy
// body-fat formula was built on, and NICE's midpoint (lowest rib to hip bone) sits roughly level
// with it, so one measurement serves both. What matters most is measuring the same way every time.

/** Waist ÷ height. Unlike BMI it reads fat around the middle, so muscle doesn't push it up.
 *  Keeping it under 0.5 is the commonly used healthy cut-off (NICE 2022). */
export const whtrOf = (waistCm: number, heightCm: number) => waistCm / heightCm;
export const WHTR_MAX = 0.5;
export const WHTR_MIN = 0.4;
export const whtrLabel = (r: number) => (r < WHTR_MIN ? 'on the low side' : r < WHTR_MAX ? 'in the healthy range' : r < 0.6 ? 'above the healthy range' : 'well above the healthy range');

// ---------- Trend ----------

export const TREND_ENTRIES = 3;

/** Smoothed bodyweight: the average of the last 3 weigh-ins (oldest first in, newest last). One reading
 *  swings a kilo or two with water and food, so a goal is judged on this. null with fewer than 3. */
export function trendKg(kgs: number[]): number | null {
  if (kgs.length < TREND_ENTRIES) return null;
  const last = kgs.slice(-TREND_ENTRIES);
  return last.reduce((a, b) => a + b, 0) / last.length;
}

/** Whether a goal weight is reached: the trend has crossed it, coming from where you started. */
export function goalReached(kgs: number[], goalKg: number, heightCm: number | null): boolean {
  const trend = trendKg(kgs);
  const first = kgs[0];
  if (trend === null || first === goalKg || !goalAllowed(goalKg, heightCm)) return false;
  return first > goalKg ? trend <= goalKg : trend >= goalKg;
}

// ---------- Heart rate ----------

/** Estimated max heart rate by age. Women: Gulati et al. 2010 (206 − 0.88 × age, from 5,437 women), because
 *  formulas built mostly on men run high for women. Everyone else: Tanaka 2001 (208 − 0.7 × age).
 *  Individuals vary by 10+ bpm. */
export const maxHeartRate = (age: number, sex: Sex | '' = '') => (sex === 'female' ? 206 - 0.88 * age : 208 - 0.7 * age);
export const HARD_HR_SHARE = 0.75;
const DEFAULT_AGE = 30; // used until a birth year is set: 75% is then 140 bpm, or 135 for a woman

/** The average heart rate that counts as a hard session at your age: 75% of the estimated max. */
export const hardHeartRate = (age: number | null, sex: Sex | '' = '') => Math.round(HARD_HR_SHARE * maxHeartRate(age ?? DEFAULT_AGE, sex));
export const ageOn = (birthYear: number | null, date: string) => (birthYear ? Number(date.slice(0, 4)) - birthYear : null);

// ---------- Weekly average and rate ----------
// Single weigh-ins swing a kilo either way with water, salt and food, so weight is read as a
// Monday–Sunday average, weighed 3–4 mornings a week, and how fast it moves as a monthly rate.

export interface WeekAvg { week: string; kg: number; n: number } // week = its Monday

/** The average weigh-in of each Monday–Sunday week, oldest first. */
export function weeklyAverages(entries: Pick<WeightEntry, 'date' | 'kg'>[]): WeekAvg[] {
  const m = new Map<string, { sum: number; n: number }>();
  for (const e of entries) {
    const k = weekKey(e.date);
    const a = m.get(k) ?? { sum: 0, n: 0 };
    a.sum += e.kg;
    a.n++;
    m.set(k, a);
  }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([week, a]) => ({ week, kg: a.sum / a.n, n: a.n }));
}

const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30.44;
const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);

export interface Rate {
  kgPerMonth: number;
  pctPerMonth: number; // of bodyweight, which is how the healthy ranges are set
  from: WeekAvg;
  to: WeekAvg;
  weeks: number; // between the two weeks compared
}

/** How fast weight is moving, per month: the latest weekly average against the one about 4 weeks
 *  before it (any week 3 to 6 weeks back, the closest to 4). A latest week with a single weigh-in
 *  is too noisy to end on when the full week before it is there, so that one is used instead.
 *  null until both weeks exist. */
export function monthlyRate(weeks: WeekAvg[]): Rate | null {
  const last = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
  if (!last) return null;
  const to = last.n < 2 && prev && prev.n >= 2 && daysBetween(prev.week, last.week) === 7 ? prev : last;
  let from: WeekAvg | null = null, gap = 0;
  for (const w of weeks) {
    const g = daysBetween(w.week, to.week) / 7;
    if (g < 3 || g > 6) continue;
    const better = !from || Math.abs(g - 4) < Math.abs(gap - 4) || (Math.abs(g - 4) === Math.abs(gap - 4) && g > gap); // a tie goes to the longer, steadier span
    if (better) [from, gap] = [w, g];
  }
  if (!from) return null;
  const kgPerMonth = ((to.kg - from.kg) / (gap * 7)) * DAYS_PER_MONTH;
  return { kgPerMonth, pctPerMonth: (kgPerMonth / from.kg) * 100, from, to, weeks: gap };
}

// ---------- Phases: gain, cut, maintain ----------

/** Healthy rates, in % of bodyweight a month. A lean gain is about 0.75–1.5% for someone in their
 *  first years of lifting (Helms, The Muscle and Strength Pyramid; Iraki et al. 2019): faster mostly
 *  adds fat, because muscle can't grow that fast. A cut keeps muscle best at 0.5–1% a week (Helms et
 *  al. 2014; Garthe et al. 2011), about 2–4% a month. `ok` is the band around it that's still fine. */
export const RATE_BANDS: Record<PhaseType, { good: [number, number]; ok: [number, number] }> = {
  gain: { good: [0.75, 1.5], ok: [0.4, 2] },
  cut: { good: [-4, -2], ok: [-5, -1] },
  maintain: { good: [-1, 1], ok: [-2, 2] },
};

/** A lean gain for women. Women build muscle at a similar *relative* rate to men in the same program
 *  (Roberts et al. 2020, meta-analysis), but carry less lean mass per kilo of bodyweight (about 70–75%
 *  against 80–85%), so the same growth is a smaller share of their weight: about 0.5–1.25% a month.
 *  Cuts and maintenance are the same for everyone. */
export const FEMALE_GAIN_BAND: { good: [number, number]; ok: [number, number] } = { good: [0.5, 1.25], ok: [0.25, 1.75] };

export const rateBands = (type: PhaseType, sex: Sex | '' = '') => (type === 'gain' && sex === 'female' ? FEMALE_GAIN_BAND : RATE_BANDS[type]);

/** Where a monthly rate sits for a phase: in the good band, close to it, or below or above it. */
export type RateBand = 'good' | 'ok' | 'low' | 'high';
export function rateBand(type: PhaseType, pctPerMonth: number, sex: Sex | '' = ''): RateBand {
  const { good, ok } = rateBands(type, sex);
  if (pctPerMonth >= good[0] && pctPerMonth <= good[1]) return 'good';
  if (pctPerMonth >= ok[0] && pctPerMonth <= ok[1]) return 'ok';
  return pctPerMonth < ok[0] ? 'low' : 'high';
}

/** What a rate means for the phase, in a line. Never blaming: it says what to try, if anything. */
export function rateAdvice(type: PhaseType, band: RateBand): string {
  if (band === 'good') return type === 'gain' ? 'On pace for a lean gain.' : type === 'cut' ? 'A steady cut that protects your muscle.' : 'Holding steady.';
  if (band === 'ok') return type === 'maintain' ? 'Close to steady.' : 'Close to the ideal pace. Give it another week or two.';
  if (type === 'gain') return band === 'low'
    ? 'Slower than a lean gain. If it stays here for 2 more weeks, add about 200 kcal a day.'
    : 'Faster than muscle can grow, so more of it is fat. Eating about 200 kcal a day less slows it down.';
  if (type === 'cut') return band === 'low'
    ? 'Faster than 1% a week, which costs muscle. Eating a bit more protects it.'
    : 'Barely moving. About 200–300 kcal a day less gets it going.';
  return band === 'low' ? 'Drifting down. Eat a bit more to hold steady.' : 'Drifting up. Eat a bit less to hold steady.';
}

export const PHASE_LABEL: Record<PhaseType, string> = { gain: 'Lean gain', cut: 'Cut', maintain: 'Maintain' };

export const currentPhase = (p: Pick<Profile, 'phases'>): Phase | null => p.phases?.[p.phases.length - 1] ?? null;

/** Start a new phase. One that starts on or after the new start date is replaced by it. */
export function withPhase(p: Profile, phase: Phase): Profile {
  const past = (p.phases ?? []).filter((x) => x.start < phase.start);
  return { ...p, phases: [...past, phase] };
}

// ---------- Body fat, lean mass and FFMI ----------

/** Body fat % from a tape measure: the US Navy formula (Hodgdon and Beckett 1984), in cm. Men use
 *  waist and neck, women also need the hips. It lands within about 3–4% of lab methods, but much of
 *  that error repeats for the same person, so the change over months is what to read. null without
 *  the measurements, for sex 'other' or unset (the formulas are sex-specific), or outside the range
 *  the formula was built for. */
export function navyBodyFat(sex: Sex | '', heightCm: number | null, m: Pick<WeightEntry, 'waistCm' | 'neckCm' | 'hipCm'>): number | null {
  const { waistCm: w, neckCm: n, hipCm: h } = m;
  if (!heightCm || !w || !n) return null;
  let bf: number;
  if (sex === 'male') {
    if (w - n <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(heightCm)) - 450;
  } else if (sex === 'female') {
    if (!h || w + h - n <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(w + h - n) + 0.221 * Math.log10(heightCm)) - 450;
  } else return null;
  return bf >= 2 && bf <= 60 ? bf : null;
}

export const leanKgOf = (kg: number, bfPct: number) => kg * (1 - bfPct / 100);

/** Fat-free mass index: lean kg ÷ height² in metres. For men it's adjusted to a height of 1.80 m, as
 *  Kouri et al. (1995) did, because their benchmarks are on that scale; the women's benchmarks below
 *  come from studies that used plain FFMI, so women's isn't adjusted. */
export function ffmiOf(leanKg: number, heightCm: number, adjusted = true): number {
  const m = heightCm / 100;
  return leanKg / (m * m) + (adjusted ? 6.1 * (1.8 - m) : 0);
}

/** What an FFMI means, by sex. `trained` is a visibly trained natural physique and the end of the
 *  progress bar; `top` is about where natural lifters top out.
 *  - Men: Kouri et al. 1995. Drug-free lifters averaged about 22, and about 25 is the natural limit.
 *  - Women: female college athletes averaged 18.8 and their 97.5th percentile was 23.9 (Harty et al.
 *    2019, n = 372, DXA); active women average about 15.5 (Britton et al. 2024). */
export interface FfmiMarks { average: number; trained: number; top: number; barFrom: number; adjusted: boolean }
export const FFMI_MARKS: Record<'male' | 'female', FfmiMarks> = {
  male: { average: 20, trained: 22, top: 25, barFrom: 17, adjusted: true },
  female: { average: 16.5, trained: 18.5, top: 24, barFrom: 14, adjusted: false },
};
export const ffmiMarks = (sex: Sex | ''): FfmiMarks | null => (sex === 'male' || sex === 'female' ? FFMI_MARKS[sex] : null);

export function ffmiLabel(ffmi: number, m: FfmiMarks): string {
  return ffmi < m.average ? 'about average' : ffmi < m.trained ? 'trained' : ffmi < m.top ? 'well trained' : 'near the natural limit';
}

/** Body fat for your sex and age, against the ranges Gallagher et al. (2000) matched to BMI 18.5, 25
 *  and 30. They called them provisional, and built them mostly on white adults, so they're a rough
 *  frame for an estimate that is itself ±3–4%. Not given under 20, where the ranges don't apply.
 *  Rows: [from age, healthy from, overweight from, obese from]. */
const BF_CUTS: Record<'male' | 'female', [number, number, number, number][]> = {
  female: [[20, 21, 33, 39], [40, 23, 34, 40], [60, 24, 36, 42]],
  male: [[20, 8, 20, 25], [40, 11, 22, 28], [60, 13, 25, 30]],
};
export type BodyFatBand = 'low' | 'healthy' | 'high' | 'very high';
export function bodyFatBand(bf: number, sex: Sex | '', age: number | null): { band: BodyFatBand; healthy: [number, number] } | null {
  if ((sex !== 'male' && sex !== 'female') || (age !== null && age < 20)) return null;
  let row = BF_CUTS[sex][0];
  for (const r of BF_CUTS[sex]) if ((age ?? DEFAULT_AGE) >= r[0]) row = r;
  const [, lo, hi, obese] = row;
  return { band: bf < lo ? 'low' : bf < hi ? 'healthy' : bf < obese ? 'high' : 'very high', healthy: [lo, hi] };
}

/** Gain quality: how much of the weight gained is lean mass. Only shown 8+ weeks into a gain and
 *  after 1.5+ kg, because a 1 cm slip of the tape moves the body-fat estimate about 1%, which would
 *  swamp a smaller change. About 0.5 or more is a good lean gain. */
export const QUALITY_MIN_WEEKS = 8;
export const QUALITY_MIN_KG = 1.5;
export function gainQuality(start: { kg: number; bf: number }, now: { kg: number; bf: number }): number | null {
  const gained = now.kg - start.kg;
  if (gained < QUALITY_MIN_KG) return null;
  return (leanKgOf(now.kg, now.bf) - leanKgOf(start.kg, start.bf)) / gained;
}
export const qualityLabel = (q: number) => (q >= 0.5 ? 'mostly lean' : q >= 0.25 ? 'part lean, part fat' : 'mostly fat');

// ---------- Reading the log ----------

export type Measure = 'waistCm' | 'neckCm' | 'armCm' | 'chestCm' | 'hipCm' | 'thighCm';

/** How often each tape measurement is worth taking: the waist every 2 weeks, the rest monthly.
 *  Measuring more often mostly measures the tape. */
export const MEASURE_DAYS: Record<Measure, number> = { waistCm: 14, neckCm: 28, armCm: 28, chestCm: 28, hipCm: 28, thighCm: 28 };

/** The tape measurements that fit a body, in the order to take them.
 *  - Women: waist, hips and neck (the three the body-fat formula needs), then arm and thigh, where
 *    glute and leg training shows. No chest: on women it mostly tracks breast tissue, not muscle.
 *  - Men: waist and neck (body fat), then arm and chest.
 *  - Other or unset: all of them, to pick from. */
export function measuresFor(sex: Sex | ''): Measure[] {
  if (sex === 'female') return ['waistCm', 'hipCm', 'neckCm', 'armCm', 'thighCm'];
  if (sex === 'male') return ['waistCm', 'neckCm', 'armCm', 'chestCm'];
  return ['waistCm', 'neckCm', 'armCm', 'chestCm', 'hipCm', 'thighCm'];
}

/** Live entries, oldest first. */
export const liveWeights = (ws: WeightEntry[]) => ws.filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date));

/** Your weight now: the latest week's average, 0 with no weigh-ins. */
export function currentKg(ws: WeightEntry[]): number {
  const weeks = weeklyAverages(liveWeights(ws));
  return weeks.length ? weeks[weeks.length - 1].kg : 0;
}

/** The latest reading of a measurement, with its date. Entries oldest first. */
export function latestMeasure(entries: WeightEntry[], key: Measure): { date: string; cm: number } | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const cm = entries[i][key];
    if (cm) return { date: entries[i].date, cm };
  }
  return null;
}

/** A measurement around a date: the last one on or before it within `days`, else the first one
 *  after it within `days`. Entries oldest first. */
export function measureNear(entries: WeightEntry[], key: Measure, date: string, days = 14): { date: string; cm: number } | null {
  let before: { date: string; cm: number } | null = null;
  for (const e of entries) {
    const cm = e[key];
    if (!cm) continue;
    if (e.date <= date) {
      if (e.date >= addDays(date, -days)) before = { date: e.date, cm };
    } else return before ?? (e.date <= addDays(date, days) ? { date: e.date, cm } : null);
  }
  return before;
}

/** Bodyweight around a date: the average of the 7 days ending on it, else of the 7 days after. */
export function kgNear(entries: WeightEntry[], date: string): number | null {
  const avg = (xs: WeightEntry[]) => (xs.length ? xs.reduce((a, e) => a + e.kg, 0) / xs.length : null);
  return avg(entries.filter((e) => e.date <= date && e.date > addDays(date, -7))) ?? avg(entries.filter((e) => e.date > date && e.date <= addDays(date, 7)));
}

export interface Composition { date: string; kg: number; bf: number; leanKg: number; fatKg: number; ffmi: number }

/** Body composition at a waist reading (the latest, or the one nearest `date`), with the closest
 *  neck and hip readings and that week's average weight. null when anything it needs is missing. */
export function compositionAt(entries: WeightEntry[], p: Pick<Profile, 'sex' | 'heightCm'>, date?: string): Composition | null {
  const waist = date ? measureNear(entries, 'waistCm', date) : latestMeasure(entries, 'waistCm');
  if (!waist || !p.heightCm) return null;
  const near = (key: Measure) => measureNear(entries, key, waist.date, 3650)?.cm; // neck and hips barely change
  const bf = navyBodyFat(p.sex, p.heightCm, { waistCm: waist.cm, neckCm: near('neckCm'), hipCm: near('hipCm') });
  const kg = kgNear(entries, waist.date);
  if (bf === null || kg === null) return null;
  const leanKg = leanKgOf(kg, bf);
  return { date: waist.date, kg, bf, leanKg, fatKg: kg - leanKg, ffmi: ffmiOf(leanKg, p.heightCm, p.sex !== 'female') };
}

/** A waist this much bigger since a gain began is worth a check-in, for anyone: about 5% of a typical
 *  waist, more than a lean gain adds in a few months. Women gain fat more on the hips and thighs, so the
 *  waist is a slower signal for them; the photos and the gain-quality number back it up. */
export const WAIST_CHECK_CM = 4;

export interface PhaseSummary {
  phase: Phase;
  days: number; // since it started
  startKg: number | null;
  nowKg: number | null; // the latest weekly average in the phase
  startWaist: number | null;
  nowWaist: number | null; // the latest reading, if it came after the start one
  rate: Rate | null; // from weeks inside the phase only
  band: RateBand | null;
  waistCheck: 'up' | 'whtr' | null; // gain only: the waist grew 4+ cm, or crossed half your height
  quality: number | null; // gain only, from 8 weeks and 1.5 kg on
}

/** Where a phase stands, read from the log, so it follows any edit to an old weigh-in. */
export function phaseSummary(entries: WeightEntry[], phase: Phase, p: Pick<Profile, 'sex' | 'heightCm'>, date = today()): PhaseSummary {
  const weeks = weeklyAverages(entries.filter((e) => e.date >= phase.start));
  const rate = monthlyRate(weeks);
  const startKg = kgNear(entries, phase.start);
  const nowKg = weeks.length ? weeks[weeks.length - 1].kg : null;
  const startW = measureNear(entries, 'waistCm', phase.start);
  const lastW = latestMeasure(entries, 'waistCm');
  const nowWaist = startW && lastW && lastW.date > startW.date ? lastW.cm : null;
  const days = Math.max(0, daysBetween(phase.start, date));
  let waistCheck: PhaseSummary['waistCheck'] = null;
  let quality: number | null = null;
  if (phase.type === 'gain' && startW && nowWaist !== null) {
    if (nowWaist - startW.cm >= WAIST_CHECK_CM) waistCheck = 'up';
    else if (p.heightCm && whtrOf(nowWaist, p.heightCm) >= WHTR_MAX && whtrOf(startW.cm, p.heightCm) < WHTR_MAX) waistCheck = 'whtr';
    const a = compositionAt(entries, p, startW.date), b = compositionAt(entries, p);
    if (days >= QUALITY_MIN_WEEKS * 7 && a && b && b.date > a.date && startKg !== null && nowKg !== null) {
      quality = gainQuality({ kg: startKg, bf: a.bf }, { kg: nowKg, bf: b.bf });
    }
  }
  return {
    phase, days, startKg, nowKg, startWaist: startW?.cm ?? null, nowWaist, rate,
    band: rate ? rateBand(phase.type, rate.pctPerMonth, p.sex) : null, waistCheck, quality,
  };
}
