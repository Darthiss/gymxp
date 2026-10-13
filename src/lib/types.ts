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
  goalWeightKg: number | null;
  weatherLat?: number | null; // rounded to 0.1° (~10 km), only used for weather lookups
  weatherLon?: number | null;
}

export interface SetEntry {
  kg: number;
  reps: number;
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

export interface WeightEntry extends Rec {
  date: string;
  kg: number;
}

export interface CustomExercise extends Rec {
  name: string;
  group: MuscleGroup;
  aliases: string[];
  look: string; // free notes: what it looks like, how to do it
  photo?: string; // path in the data repo, e.g. photos/abc.jpg
  assisted?: boolean;
}

export interface Routine extends Rec {
  name: string;
  exerciseIds: string[];
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
