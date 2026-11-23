// Every syncable record has an id, an updatedAt timestamp (ms) used for
// last-writer-wins merging between devices, and an optional tombstone flag.
export interface Rec {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export type Sex = 'male' | 'female' | 'other';

export interface Profile extends Rec {
  name: string;
  sex: Sex | '';
  heightCm: number | null;
  birthYear: number | null;
  weeklyGoal: number; // target gym visits per week
  goalHistory?: { from: string; goal: number }[]; // past changes, oldest first; `from` is a Monday ('' = since the start)
  goalWeightKg: number | null;
  weatherLat?: number | null; // rounded to 0.1° (~10 km), only used for weather lookups
  weatherLon?: number | null;
  phases?: Phase[]; // gain, cut or maintain, oldest first: the last one is current
  liftGoal?: LiftGoal; // "Lift <name>": someone you're training to pick up and carry
}

/** What you're doing with your bodyweight, from a date. Changes since `start` are read from the log. */
export type PhaseType = 'gain' | 'cut' | 'maintain';
export interface Phase {
  type: PhaseType;
  start: string; // YYYY-MM-DD
}

/** A person to lift. Kept in your private data, never in the app's code. */
export interface LiftGoal {
  name: string;
  kg: number; // roughly what they weigh
}

export interface SetEntry {
  kg: number;
  reps: number;
  warmup?: boolean; // left out of every stat: stars, records, volume and muscle sets
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetEntry[];
  note?: string;
}

export interface WatchStats {
  durationMin?: number;
  kcal?: number;
  avgHr?: number;
}

export interface SessionWeather {
  tempC?: number;
  rain?: boolean;
}

export interface Session extends Rec {
  date: string; // YYYY-MM-DD (local)
  startTime?: string; // HH:MM
  exercises: ExerciseLog[];
  watch?: WatchStats;
  weather?: SessionWeather;
  note?: string;
  createdAt: number;
  estimated?: boolean; // back-filled from memory via Import past workouts
}

/** A morning weigh-in, with any tape measurements taken that morning. Measurements ride on the
 *  weigh-in so they're taken under the same conditions, and so older app versions keep them. */
export interface WeightEntry extends Rec {
  date: string;
  kg: number;
  waistCm?: number; // at the belly button, relaxed, after a normal breath out
  neckCm?: number; // just below the Adam's apple
  armCm?: number; // flexed, at the widest point, same arm every time
  chestCm?: number; // at nipple height, after a normal breath out
  hipCm?: number; // widest point of the glutes; only the women's body-fat formula uses it
}

export interface CustomExercise extends Rec {
  name: string;
  group: MuscleGroup;
  aliases: string[];
  look: string; // free notes: what it looks like, how to do it
  photo?: string; // path in the data repo, e.g. photos/abc.jpg
  assisted?: boolean;
}

/** One step of a routine: the coach's target for an exercise. */
export interface RoutineItem {
  exerciseId: string;
  sets: number; // planned sets (series)
  reps: string; // target per set: "10", a range "8-12", a pyramid "12/10/8" or "30 s"
  restSec?: number;
  note?: string; // coach's cue, e.g. "slow on the way down"
}

export interface Routine extends Rec {
  name: string;
  exerciseIds: string[]; // kept in sync with `items` so older data and app versions still work
  items?: RoutineItem[]; // missing on routines saved before targets existed
  note?: string;
}

// Per-exercise machine settings ("seat 4, back pad 2") — keyed by exercise id.
export interface ExerciseSetting extends Rec {
  note: string;
}

export interface AppData {
  schema: 1;
  profile: Profile;
  sessions: Session[];
  weights: WeightEntry[];
  customExercises: CustomExercise[];
  routines: Routine[];
  exerciseSettings: ExerciseSetting[];
}

export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Glutes' | 'Core';

/** The movement an exercise trains, for the routine check. Isolation work has none. */
export type Pattern = 'h-push' | 'v-push' | 'h-pull' | 'v-pull' | 'squat' | 'hinge' | 'lunge' | 'core' | 'carry';
export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'];

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  group: MuscleGroup;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  look: string;
  instructions: string[];
  images: string[]; // relative to app base (built-in) — custom exercises use `photo`
  assisted?: boolean;
  bwFactor?: number;
  loadFactor?: number; // 2 = weight is logged per dumbbell, both count toward volume
  barKg?: number; // free barbell: weight logged is the total (bar + plates); typical empty bar
  benchmark?: 'ladder' | 'cindy'; // Hero benchmark workouts with special logging
  vestMult?: number; // reps per logged unit that carry the vest weight (Cindy: 30 per round)
  hold?: boolean; // timed (plank, farmer's walk): the reps column is seconds
  pattern?: Pattern;
  custom?: boolean;
  photo?: string;
}

export function emptyData(): AppData {
  return {
    schema: 1,
    profile: {
      id: 'profile',
      updatedAt: 0,
      name: '',
      sex: '',
      heightCm: null,
      birthYear: null,
      weeklyGoal: 3,
      goalWeightKg: null,
    },
    sessions: [],
    weights: [],
    customExercises: [],
    routines: [],
    exerciseSettings: [],
  };
}
