// Body measures and the few health formulas the app uses. They are population rules of thumb,
// shown for information only: none of them is a diagnosis, and the copy must never say otherwise.

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

/** Estimated max heart rate by age (Tanaka 2001: 208 − 0.7 × age). Individuals vary by 10+ bpm. */
export const maxHeartRate = (age: number) => 208 - 0.7 * age;
export const HARD_HR_SHARE = 0.75;
const DEFAULT_AGE = 30; // used until a birth year is set: 75% is then 140 bpm

/** The average heart rate that counts as a hard session at your age: 75% of the estimated max. */
export const hardHeartRate = (age: number | null) => Math.round(HARD_HR_SHARE * maxHeartRate(age ?? DEFAULT_AGE));
export const ageOn = (birthYear: number | null, date: string) => (birthYear ? Number(date.slice(0, 4)) - birthYear : null);
