// Back-filling past workouts from memory (see screens/Backfill.tsx).
import type { Session } from './types';
import { num, parseDuration, today, uid } from './util';

export interface PlanItem { exerciseId: string; sets: string; reps: string; startKg: string; endKg: string }
export interface Plan { id: string; name: string; items: PlanItem[] }
export interface Row { id: string; date: string; planId: string; dur: string; kcal: string; hr: string; tempC?: string; rain?: boolean }
export interface ImportDraft { plans: Plan[]; rows: Row[] }

export const PLAN_NAMES = ['Workout A', 'Workout B', 'Workout C', 'Workout D', 'Workout E'];
/** Machines step in 5 or 2.5 kg: snap in-between weights to the step your start/end numbers use. */
function kgStep(a: number, b: number): number {
  const isMult = (v: number, s: number) => Math.abs(v / s - Math.round(v / s)) < 1e-9;
  if (isMult(a, 5) && isMult(b, 5)) return 5;
  if (isMult(a, 2.5) && isMult(b, 2.5)) return 2.5;
  return 0.5;
}

export function freshImportDraft(): ImportDraft {
  return { plans: [{ id: uid(), name: PLAN_NAMES[0], items: [] }], rows: [] };
}

/** Turn the plans + day rows into sessions. Weights go linearly from start to end kg across each plan's days. */
export function buildSessions(draft: ImportDraft): Session[] {
  const valid = draft.rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today());
  const out: Session[] = [];
  for (const plan of draft.plans) {
    const days = valid.filter((r) => r.planId === plan.id).sort((a, b) => a.date.localeCompare(b.date));
    days.forEach((r, k) => {
      const t = days.length > 1 ? k / (days.length - 1) : 1;
      const exercises = plan.items
        .map((it) => {
          const start = it.startKg.trim() ? num(it.startKg) : num(it.endKg);
          const end = it.endKg.trim() ? num(it.endKg) : start;
          const step = kgStep(start, end);
          const kg = Math.max(0, Math.round((start + (end - start) * t) / step) * step);
          const reps = Math.max(0, Math.round(num(it.reps)));
          const sets = Math.min(20, Math.max(0, Math.round(num(it.sets))));
          return { exerciseId: it.exerciseId, sets: Array.from({ length: reps ? sets : 0 }, () => ({ kg, reps })) };
        })
        .filter((e) => e.sets.length);
      const durationMin = parseDuration(r.dur) ? Math.round(parseDuration(r.dur)) : undefined;
      const kcal = num(r.kcal) || undefined;
      const avgHr = num(r.hr) || undefined;
      const watch = durationMin || kcal || avgHr ? { durationMin, kcal, avgHr } : undefined;
      if (!exercises.length && !watch) return;
      out.push({
        id: `imp_${r.id}`,
        updatedAt: Date.now(),
        createdAt: Date.parse(r.date) || Date.now(),
        date: r.date,
        exercises,
        estimated: true,
        ...(watch ? { watch } : {}),
        ...(r.tempC?.trim() || r.rain ? { weather: { ...(r.tempC?.trim() ? { tempC: Math.round(num(r.tempC)) } : {}), ...(r.rain ? { rain: true } : {}) } } : {}),
      });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

