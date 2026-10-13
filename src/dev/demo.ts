// Dev-only demo mode (http://localhost:5173/?demo): opens the app on generated sample data
// with no vault, no GitHub and no writes to the real encrypted cache. Used to preview UI.
// Imported dynamically behind import.meta.env.DEV, so it never ships in the build.
import { Store } from '../lib/store';
import type { Unlocked } from '../lib/vault';
import { addDays, today, uid } from '../lib/util';
import { emptyData, type AppData, type Session } from '../lib/types';

const PLANS: Record<string, [string, number, number][]> = {
  // exercise id, start kg, end kg
  Push: [['Machine_Bench_Press', 30, 45], ['Leverage_Shoulder_Press', 20, 30], ['Butterfly', 25, 40], ['Triceps_Pushdown_-_Rope_Attachment', 15, 22.5], ['Side_Lateral_Raise', 5, 8]],
  Pull: [['Wide-Grip_Lat_Pulldown', 35, 50], ['Seated_Cable_Rows', 30, 45], ['Assisted_Pull-Up_Machine', 45, 32], ['Face_Pull', 15, 20], ['Machine_Bicep_Curl', 15, 25]],
  Legs: [['Leg_Press', 80, 130], ['Leg_Extensions', 30, 45], ['Seated_Leg_Curl', 25, 40], ['Standing_Calf_Raises', 40, 60], ['Hanging_Leg_Raise', 0, 0]],
};

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32);
}

function sampleData(): AppData {
  const d = emptyData();
  const r = rng(42);
  const t = today();
  d.profile = { ...d.profile, name: 'Lucas', sex: 'male', heightCm: 173, birthYear: 1995, weeklyGoal: 3, goalWeightKg: 70, updatedAt: 1 };
  const names = Object.keys(PLANS);
  const start = addDays(t, -76);
  const days: string[] = [];
  for (let day = start; day < t; day = addDays(day, 1)) {
    const dow = new Date(day + 'T12:00').getDay();
    if ((dow === 1 || dow === 3 || dow === 5) && r() > 0.08) days.push(day);
    else if (dow === 6 && r() > 0.8) days.push(day);
  }
  days.forEach((date, i) => {
    const prog = i / Math.max(1, days.length - 1);
    const plan = PLANS[names[i % 3]];
    const s: Session = {
      id: uid(), updatedAt: 1, createdAt: 1, date, startTime: `${18 + Math.floor(r() * 2)}:${String(Math.floor(r() * 6) * 10).padStart(2, '0')}`,
      exercises: plan.map(([exerciseId, a, b]) => {
        const kg = Math.round((a + (b - a) * prog + (r() - 0.5) * 2.5) / 2.5) * 2.5;
        return { exerciseId, sets: Array.from({ length: 3 }, (_, k) => ({ kg: Math.max(0, kg), reps: exerciseId === 'Hanging_Leg_Raise' ? 6 + Math.round(prog * 6) : 12 - k - (r() > 0.6 ? 1 : 0) })) };
      }),
      watch: { durationMin: 55 + Math.round(r() * 25), kcal: 320 + Math.round(r() * 160), avgHr: 115 + Math.round(r() * 20) },
      ...(r() > 0.7 ? { weather: { tempC: 8 + Math.round(r() * 14), rain: r() > 0.6 } } : {}),
    };
    d.sessions.push(s);
  });
  for (let i = 0; i < 10; i++) d.weights.push({ id: uid(), updatedAt: 1, date: addDays(t, -70 + i * 7), kg: Math.round((72.4 - i * 0.25 + (r() - 0.5) * 0.6) * 10) / 10 });
  const reps = ['12/10/8', '10', '10', '12', '15'];
  d.routines = names.map((n, i) => ({
    id: `r${i}`, updatedAt: 1, name: `Day ${'ABC'[i]} · ${n}`, exerciseIds: PLANS[n].map((x) => x[0]),
    items: PLANS[n].map(([exerciseId], k) => ({ exerciseId, sets: k === 0 ? 4 : 3, reps: reps[k], ...(k < 3 ? { restSec: k === 0 ? 120 : 90 } : {}), ...(k === 1 ? { note: 'Slow on the way down' } : {}) })),
    ...(i === 0 ? { note: '10 min on the bike to warm up' } : {}),
  }));
  d.exerciseSettings = [{ id: 'Leg_Press', updatedAt: 1, note: 'Seat 5 · feet high on the plate' }];
  return d;
}

function sampleDraft() {
  const ids = PLANS.Push.map((x) => x[0]);
  const now = new Date(Date.now() - 34 * 60_000);
  return {
    id: uid(), date: today(), startTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    exercises: ids.slice(0, 3).map((exerciseId, i) => ({
      exerciseId,
      sets: i === 0 ? [{ kg: '47.5', reps: '10' }, { kg: '47.5', reps: '9' }, { kg: '47.5', reps: '' }] : i === 1 ? [{ kg: '30', reps: '' }, { kg: '30', reps: '' }, { kg: '30', reps: '' }] : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }],
    })),
    durationMin: '', kcal: '', avgHr: '', note: '', createdAt: Date.now(),
  };
}

export async function openDemo(): Promise<{ unlocked: Unlocked; store: Store }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const unlocked: Unlocked = { key, cfg: { owner: 'demo', repo: 'gymxp-data', token: 'demo' } };
  const store = new Store(key, unlocked.cfg);
  const drafts = new Map<string, unknown>();
  if (location.search.includes('draft')) drafts.set('gymxp:draft', sampleDraft());
  // Keep everything in memory: never touch GitHub or the real encrypted cache.
  const s = store as unknown as Record<string, unknown>;
  s.pull = async () => {};
  s.push = async () => {};
  s.writeCache = async () => {};
  s.readCache = async () => null;
  s.saveDraft = async (v: unknown, slot = 'gymxp:draft') => void (v === null ? drafts.delete(slot) : drafts.set(slot, v));
  s.loadDraft = async (slot = 'gymxp:draft') => drafts.get(slot) ?? null;
  s.photoUrl = async () => { throw new Error('demo'); };
  return { unlocked, store };
}

export const demoData = sampleData;
