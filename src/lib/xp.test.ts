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
    expect(xpForLevel(2)).toBe(650);
    for (let l = 1; l < 120; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });
});

describe('session XP', () => {
  it('awards visit, sets, volume, first-time and milestone XP', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-13', [{ exerciseId: 'Leg_Press', sets: [{ kg: 100, reps: 10 }, { kg: 100, reps: 10 }] }]));
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
    expect(g.weighIns.get('a')).toBeGreaterThanOrEqual(RULES.weighInXp + 25); // + "On the Scale" (+ a weigh-in quest if picked)
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

describe('dumbbells', () => {
  it('two-dumbbell exercises count both dumbbells toward volume, PRs use the per-dumbbell weight', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-10-01', [{ exerciseId: 'Dumbbell_Bicep_Curl', sets: [{ kg: 10, reps: 10 }] }]));
    d.sessions.push(sess('2026-10-03', [{ exerciseId: 'Dumbbell_Bicep_Curl', sets: [{ kg: 12, reps: 10 }] }]));
    d.sessions.push(sess('2026-10-05', [{ exerciseId: 'Standing_Dumbbell_Triceps_Extension', sets: [{ kg: 15, reps: 10 }] }]));
    const g = game(d);
    expect(g.sessions.get(d.sessions[0].id)!.volume).toBe(200);
    expect(g.sessions.get(d.sessions[1].id)!.prs[0]).toMatchObject({ kind: 'weight', value: 12, prev: 10 });
    expect(g.sessions.get(d.sessions[2].id)!.volume).toBe(150); // one dumbbell held with both hands
  });
});

describe('exercise search', () => {
  it('ranks name matches first', async () => {
    const { BUILTIN, searchExercises } = await import('./exercises');
    const r = searchExercises(BUILTIN, 'bench press').map((e) => e.name);
    expect(r.indexOf('Barbell Bench Press')).toBeLessThan(r.indexOf('Chest Press Machine'));
    expect(r[0]).toMatch(/Bench Press/);
  });
});

describe('pacing, ranks, holidays & weather', () => {
  it('a month of 3x/week lands around level 4-7 and rank needs visits too', async () => {
    const { levelInfo, rankFor } = await import('./xp');
    expect(levelInfo(6400, 12).level).toBeGreaterThanOrEqual(3);
    expect(levelInfo(6400, 12).level).toBeLessThanOrEqual(5);
    // high level but few visits is capped by visits
    expect(rankFor(70, 20).title).toBe('Regular');
    expect(rankFor(60, 1050).title).toBe('Olympian');
  });

  it('knows Argentine holidays, incl. Easter-based and moved ones', async () => {
    const { holidayOn } = await import('./holidays');
    expect(holidayOn('2026-07-09')).toBe('Día de la Independencia');
    expect(holidayOn('2026-04-03')).toBe('Viernes Santo'); // Easter 2026 = Apr 5
    expect(holidayOn('2026-02-16')).toBe('Carnaval');
    expect(holidayOn('2026-10-12')).toBe('Día de la Diversidad Cultural');
    expect(holidayOn('2026-11-20')).toBe('Día de la Soberanía Nacional'); // Friday…
    expect(holidayOn('2026-11-23')).toContain('trasladado'); // …moved to Monday
    expect(holidayOn('2026-10-13')).toBeUndefined();
  });

  it('gives holiday, rain and cold bonuses once per day', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-07-09', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }], { weather: { tempC: 3, rain: true } }));
    d.sessions.push(sess('2026-07-09', [{ exerciseId: 'Leg_Extensions', sets: [{ kg: 20, reps: 10 }] }], { weather: { tempC: 3, rain: true } }));
    const g = game(d);
    const r1 = g.sessions.get(d.sessions[0].id)!;
    const labels = r1.items.map((i) => i.label).join('|');
    expect(labels).toContain('Feriado');
    expect(labels).toContain('rain');
    expect(labels).toContain('Cold day');
    expect(g.unlockedIds.has('hol-1') && g.unlockedIds.has('wx-rain-1') && g.unlockedIds.has('wx-cold')).toBe(true);
    const r2 = g.sessions.get(d.sessions[1].id)!;
    expect(r2.items.some((i) => i.label.includes('Feriado') || i.label.includes('rain'))).toBe(false);
  });

  it('strength standards and habit awards', () => {
    const d = emptyData();
    d.weights.push({ id: 'w', updatedAt: 1, date: '2026-01-01', kg: 70 });
    d.sessions.push(sess('2026-01-03', [{ exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ kg: 72.5, reps: 1 }] }])); // Saturday
    d.sessions.push(sess('2026-01-04', [{ exerciseId: 'Barbell_Squat', sets: [{ kg: 105, reps: 3 }] }])); // Sunday
    d.sessions.push(sess('2026-01-06', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    d.sessions.push(sess('2026-01-30', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }])); // 24-day gap
    const g = game(d);
    for (const id of ['str-bench-60', 'str-bench-bw', 'str-squat-100', 'str-squat-1.5', 'hab-weekend', 'hab-comeback', 'hol-newyear'])
      expect(g.unlockedIds.has(id), id).toBe(true);
    expect(g.unlockedIds.has('str-bench-100')).toBe(false);
  });

  it('legend comparison uses barbell e1RM and visits', async () => {
    const { compare, LEGENDS } = await import('./legends');
    const d = emptyData();
    d.sessions.push(sess('2026-01-03', [{ exerciseId: 'Barbell_Deadlift', sets: [{ kg: 100, reps: 1 }] }]));
    const p = compare(game(d), LEGENDS.find((l) => l.id === 'eddie')!);
    const dl = p.rows.find((r) => r.metric.key === 'deadlift')!;
    expect(dl.mine).toBe(103.3); // Epley: 100 × (1 + 1/30)
    expect(dl.pct).toBeCloseTo(103.3 / 500);
  });
});

describe('stars, seasons, quests, mastery', () => {
  it('rank divisions follow the slower of XP and visits', async () => {
    const { levelInfo, xpForLevel, RANKS, DIVISIONS } = await import('./xp');
    const silver = RANKS.find((r) => r.title === 'Silver Lifter')!;
    const gold = RANKS.find((r) => r.title === 'Gold Lifter')!;
    // lots of XP but visits only just at Silver's minimum → star 1, limited by visits
    const a = levelInfo(xpForLevel(gold.minLevel) - 1, silver.minVisits);
    expect(a.rank.title).toBe('Silver Lifter');
    expect(a.division).toBe(1);
    expect(a.limiter).toBe('visits');
    // halfway on both → star 3 of 4
    const midXp = (xpForLevel(silver.minLevel) + xpForLevel(gold.minLevel)) / 2;
    const b = levelInfo(midXp, Math.ceil((silver.minVisits + gold.minVisits) / 2));
    expect(b.division).toBe(Math.floor(0.5 * DIVISIONS) + 1);
  });

  it('seasons are calendar quarters with goal-relative tiers', async () => {
    const { seasonOf } = await import('./xp');
    const s = seasonOf('2026-10-12', 3);
    expect(s.key).toBe('2026-Q4');
    expect(s.label).toBe('Spring 2026');
    expect(s.weeks).toBe(13);
    expect(s.targets[0]).toBe(Math.ceil(0.25 * 3 * 13));
    const d = emptyData();
    for (let i = 0; i < 10; i++) d.sessions.push(sess(`2026-10-${String(i + 1).padStart(2, '0')}`, [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    const g = game(d);
    expect(g.seasons.find((x) => x.key === '2026-Q4')!.tier).toBe(0); // Bronze at 10 visits
  });

  it('picks 3 deterministic quests per week and completes them', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-10-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    const g1 = game(d), g2 = game(d);
    const w = [...g1.sessions.values()][0];
    expect(w.items.filter((i) => i.label.includes('Quest:')).length).toBeGreaterThanOrEqual(0);
    expect(g1.quests.map((q) => q.id)).toEqual(g2.quests.map((q) => q.id));
    expect(g1.quests).toHaveLength(3);
  });

  it('mastery tiers by sessions', async () => {
    const { masteryOf } = await import('./xp');
    expect(masteryOf(4).current).toBeNull();
    expect(masteryOf(5).current!.name).toBe('Bronze');
    expect(masteryOf(100).current!.name).toBe('Diamond');
  });
});

describe('hero physique', () => {
  it('capacity estimates: assisted pull-ups approach the first rep, estimates cap at 80%', async () => {
    const { capacityFrom, repScore, ESTIMATE_CAP } = await import('./hero');
    // 70 kg, 40 kg assist x 8 reps → e1RM 30*(1+8/30)=38 → 54% of a first rep
    const c1 = capacityFrom(30 * (1 + 8 / 30), 70);
    expect(c1.est).toBe(0);
    expect(c1.frac).toBeCloseTo(38 / 70);
    // huge estimated capacity still capped
    const s = repScore({ strict: 0, est: 40, frac: 1 }, 15);
    expect(s.score).toBe(ESTIMATE_CAP);
    expect(s.estimated).toBe(true);
    // real strict reps win
    expect(repScore({ strict: 15, est: 40, frac: 1 }, 15).score).toBe(1);
  });

  it('ladder work adds up to 1,500 reps', async () => {
    const { ladderWork } = await import('./hero');
    expect(ladderWork(19).reps).toBe(1500);
    expect(ladderWork(10).reps).toBe(825); // 15 × (1+…+10)
  });

  it('engine tracks bodyweight reps, benchmark PRs and hero stages', () => {
    const d = emptyData();
    d.weights.push({ id: 'w', updatedAt: 1, date: '2026-01-01', kg: 68 });
    d.sessions.push(sess('2026-02-02', [{ exerciseId: 'Pullups', sets: [{ kg: 0, reps: 3 }] }, { exerciseId: 'Hero_Cindy', sets: [{ kg: 0, reps: 9 }] }]));
    d.sessions.push(sess('2026-02-04', [{ exerciseId: 'Pullups', sets: [{ kg: 0, reps: 5 }] }, { exerciseId: 'Hero_Cindy', sets: [{ kg: 0, reps: 11 }] }, { exerciseId: 'Hero_Ladder', sets: [{ kg: 52, reps: 19 }] }]));
    const g = game(d);
    const r2 = g.sessions.get(d.sessions[1].id)!;
    expect(r2.prs.map((p) => p.kind).sort()).toEqual(['reps', 'rounds']);
    expect(g.maxPullups).toBe(5);
    expect(g.unlockedIds.has('str-pullup')).toBe(true);
    expect(g.unlockedIds.has('hero-cindy-10')).toBe(true);
    expect(g.unlockedIds.has('hero-ladder')).toBe(true);
    expect(g.unlockedIds.has('hero-ladder-45')).toBe(false);
    const bm = g.hero.pillars.find((p) => p.id === 'benchmarks')!;
    expect(bm.score).toBeGreaterThan(0.6);
    // pull-up volume uses bodyweight
    expect(r2.volume).toBeGreaterThan(5 * 68);
  });

  it('stronger pillar uses the median gain on most-trained lifts', () => {
    const d = emptyData();
    ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09'].forEach((date, i) =>
      d.sessions.push(sess(date, [
        { exerciseId: 'Leg_Press', sets: [{ kg: 100 + i * 10, reps: 10 }] },
        { exerciseId: 'Machine_Bench_Press', sets: [{ kg: 40 + i * 5, reps: 10 }] },
      ])));
    const p = game(d).hero.pillars.find((x) => x.id === 'stronger')!;
    // leg press +30%, chest press +37.5% → median ≈ 33.75% → score ≈ 0.675
    expect(p.score).toBeCloseTo(0.675, 2);
  });
});
