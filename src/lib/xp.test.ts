import { describe, expect, it } from 'vitest';
import { computeGame, levelForXp, xpForLevel, RULES } from './xp';
import { exerciseMap } from './exercises';
import { emptyData, type AppData, type Session } from './types';
import { mergeData } from './merge';
import { parseDuration, parseWatchText, parseWorkoutLine, weekKey } from './util';
import { deriveKey, seal, unseal } from './crypto';

let n = 0;
const sess = (date: string, exercises: Session['exercises'], extra: Partial<Session> = {}): Session => ({
  id: `s${++n}`, updatedAt: 1, createdAt: n, date, exercises, ...extra,
});
const game = (d: AppData) => computeGame(d, exerciseMap(d));

describe('levels', () => {
  it('level curve is monotonic and invertible', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(150);
    for (let l = 1; l < 120; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });
});

describe('session XP', () => {
  it('awards visit, sets, volume, first-time and milestone XP', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 100, reps: 10 }, { kg: 100, reps: 10 }] }]));
    const g = game(d);
    const r = g.sessions.get(d.sessions[0].id)!;
    // 100 visit + 2 sets*5 + 2000kg/50=40 + new exercise 15 + "First Rep" 50 + "1 Tonne" 50
    expect(r.xp).toBe(RULES.visitXp + 10 + 40 + RULES.newExerciseXp + 50 + 50);
    expect(g.unlockedIds.has('volume-1000')).toBe(true);
    expect(r.volume).toBe(2000);
    expect(g.visits).toBe(1);
    expect(g.unlockedIds.has('visits-1')).toBe(true);
  });

  it('detects weight PRs only after the baseline session', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 100, reps: 10 }] }]));
    d.sessions.push(sess('2026-01-07', [{ exerciseId: 'Leg_Press', sets: [{ kg: 110, reps: 8 }] }]));
    d.sessions.push(sess('2026-01-09', [{ exerciseId: 'Leg_Press', sets: [{ kg: 110, reps: 12 }] }]));
    const g = game(d);
    expect(g.sessions.get(d.sessions[0].id)!.prs).toHaveLength(0);
    expect(g.sessions.get(d.sessions[1].id)!.prs.map((p) => p.kind)).toEqual(['weight']);
    expect(g.sessions.get(d.sessions[2].id)!.prs.map((p) => p.kind)).toEqual(['e1rm']);
    expect(g.prCount).toBe(2);
  });

  it('second workout on the same day gets no visit XP', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Leg_Extensions', sets: [{ kg: 30, reps: 10 }] }]));
    const g = game(d);
    expect(g.visits).toBe(1);
    expect(g.sessions.get(d.sessions[1].id)!.items.some((i) => i.label === 'Gym visit')).toBe(false);
  });

  it('assisted machines: less assistance is a PR and volume uses bodyweight minus assist', () => {
    const d = emptyData();
    d.weights.push({ id: 'w1', updatedAt: 1, date: '2026-01-01', kg: 80 });
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Assisted_Pull-Up_Machine', sets: [{ kg: 40, reps: 10 }] }]));
    d.sessions.push(sess('2026-01-08', [{ exerciseId: 'Assisted_Pull-Up_Machine', sets: [{ kg: 30, reps: 10 }] }]));
    const g = game(d);
    expect(g.sessions.get(d.sessions[0].id)!.volume).toBe(400);
    const r2 = g.sessions.get(d.sessions[1].id)!;
    expect(r2.volume).toBe(500);
    expect(r2.prs[0].kind).toBe('assist');
  });

  it('weekly goal and streak multiplier', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 2;
    // Two consecutive weeks hitting goal (Mon 5 Jan & Mon 12 Jan 2026), then a session in week 3.
    for (const date of ['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14', '2026-01-19'])
      d.sessions.push(sess(date, [{ exerciseId: 'Leg_Press', sets: [{ kg: 10, reps: 1 }] }]));
    const g = game(d);
    const r2 = g.sessions.get(d.sessions[1].id)!;
    expect(r2.items.some((i) => i.label.includes('Weekly goal'))).toBe(true);
    const r5 = g.sessions.get(d.sessions[4].id)!;
    expect(r5.streakWeeks).toBe(2);
    expect(r5.multiplier).toBeCloseTo(1.1);
    expect(g.unlockedIds.has('streak-2')).toBe(true);
  });

  it('deleted sessions are ignored and editing recomputes', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 100, reps: 10 }] }], { deleted: true }));
    expect(game(d).totalXp).toBe(0);
  });

  it('weigh-ins give XP once per week', () => {
    const d = emptyData();
    d.weights.push({ id: 'a', updatedAt: 1, date: '2026-01-05', kg: 80 }, { id: 'b', updatedAt: 1, date: '2026-01-06', kg: 79.5 });
    const g = game(d);
    expect(g.weighIns.get('a')).toBe(RULES.weighInXp + 25); // + "On the Scale"
    expect(g.weighIns.get('b')).toBe(0);
  });
});

describe('merge', () => {
  it('keeps edits from both devices and propagates deletions', () => {
    const base = emptyData();
    const a: AppData = { ...base, sessions: [sess('2026-01-01', []), { ...sess('2026-01-02', []), id: 'shared', updatedAt: 5 }] };
    const b: AppData = { ...base, sessions: [sess('2026-01-03', []), { ...sess('2026-01-02', []), id: 'shared', updatedAt: 9, deleted: true }] };
    const m = mergeData(a, b);
    expect(m.sessions).toHaveLength(3); // 2 unique + the shared one
    expect(m.sessions.find((s) => s.id === 'shared')!.deleted).toBe(true);
  });
});

describe('util', () => {
  it('weekKey returns Monday', () => {
    expect(weekKey('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(weekKey('2026-10-18')).toBe('2026-10-12'); // Sunday
  });
  it('parses durations', () => {
    expect(parseDuration('62')).toBe(62);
    expect(parseDuration('1:02:00')).toBe(62);
    expect(parseDuration('3720')).toBe(62);
    expect(parseDuration('1h 2m')).toBe(62);
    expect(parseDuration('62 min')).toBe(62);
  });
  it('parses shortcut and free text', () => {
    expect(parseWatchText('dur=1:02:00 kcal=410.6 kcal hr=128 count/min start=18:05')).toEqual({ dur: 62, kcal: 411, hr: 128, start: '18:05' });
    expect(parseWatchText('Traditional Strength Training 58 min 380 kcal avg 121 bpm')).toEqual({ dur: 58, kcal: 380, hr: 121 });
  });
});

describe('backfill line parsing', () => {
  const T = '2026-10-12';
  it('understands common date formats', () => {
    expect(parseWorkoutLine('2026-09-02 62 410 128', T)).toEqual({ date: '2026-09-02', dur: 62, kcal: 410, hr: 128 });
    expect(parseWorkoutLine('2/9 62 410 128', T)).toEqual({ date: '2026-09-02', dur: 62, kcal: 410, hr: 128 });
    expect(parseWorkoutLine('02/09/2026 1:02:15 410 128', T)).toEqual({ date: '2026-09-02', dur: 62, kcal: 410, hr: 128 });
    expect(parseWorkoutLine('Sep 4 · 58 min · 380 kcal · 121 bpm', T)).toEqual({ date: '2026-09-04', dur: 58, kcal: 380, hr: 121 });
    expect(parseWorkoutLine('5 sept 70 min 455 kcal', T)).toEqual({ date: '2026-09-05', dur: 70, kcal: 455 });
    expect(parseWorkoutLine('Tuesday, September 9th, 2026', T)).toEqual({ date: '2026-09-09' });
  });
  it('picks last year for dates that would be in the future', () => {
    expect(parseWorkoutLine('20/12 60', T)?.date).toBe('2025-12-20');
  });
  it('returns null without a date', () => {
    expect(parseWorkoutLine('62 min 410 kcal', T)).toBeNull();
  });
});

describe('crypto', () => {
  it('round-trips and rejects the wrong key', async () => {
    const salt = btoa('0123456789abcdef');
    const k1 = await deriveKey('correct horse', salt, 1000);
    const k2 = await deriveKey('wrong horse', salt, 1000);
    const s = await seal(k1, { token: 'github_pat_x' });
    expect(await unseal(k1, s)).toEqual({ token: 'github_pat_x' });
    await expect(unseal(k2, s)).rejects.toThrow();
  });
});

describe('backfill', () => {
  it('spreads weights from start to end over each plan and tags sessions as estimated', async () => {
    const { buildSessions } = await import('./backfill');
    const draft = {
      plans: [
        { id: 'A', name: 'A', items: [{ exerciseId: 'Leg_Press', sets: '3', reps: '10', startKg: '80', endKg: '100' }] },
        { id: 'B', name: 'B', items: [{ exerciseId: 'Butterfly', sets: '3', reps: '12', startKg: '30', endKg: '' }] },
      ],
      rows: [
        { id: '1', date: '2026-09-01', planId: 'A', dur: '60', kcal: '400', hr: '125' },
        { id: '2', date: '2026-09-03', planId: 'B', dur: '1:05:00', kcal: '', hr: '' },
        { id: '3', date: '2026-09-05', planId: 'A', dur: '', kcal: '', hr: '' },
        { id: '4', date: '2026-09-08', planId: 'A', dur: '', kcal: '', hr: '' },
      ],
    };
    const ss = buildSessions(draft);
    expect(ss.map((s) => s.date)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08']);
    const lp = ss.filter((s) => s.exercises[0].exerciseId === 'Leg_Press').map((s) => s.exercises[0].sets[0].kg);
    expect(lp).toEqual([80, 90, 100]);
    expect(ss[1].exercises[0].sets).toHaveLength(3);
    expect(ss[1].exercises[0].sets[0]).toEqual({ kg: 30, reps: 12 });
    expect(ss[1].watch?.durationMin).toBe(65);
    expect(ss.every((s) => s.estimated)).toBe(true);
    // PRs show up as the weight climbs
    const d = emptyData();
    d.sessions = ss;
    const g = game(d);
    expect(g.prCount).toBe(2);
    expect(g.visits).toBe(4);
  });
});

describe('backfill weight steps', () => {
  it('snaps in-between weights to 5 / 2.5 kg machine steps', async () => {
    const { buildSessions } = await import('./backfill');
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: String(i), date: `2026-09-0${i + 1}`, planId: 'A', dur: '', kcal: '', hr: '' }));
    const kgs = (startKg: string, endKg: string) =>
      buildSessions({ plans: [{ id: 'A', name: 'A', items: [{ exerciseId: 'Leg_Press', sets: '1', reps: '10', startKg, endKg }] }], rows }).map((s) => s.exercises[0].sets[0].kg);
    expect(kgs('80', '110')).toEqual([80, 85, 90, 100, 105, 110]);
    expect(kgs('20', '27.5')).toEqual([20, 22.5, 22.5, 25, 25, 27.5]);
  });
});
