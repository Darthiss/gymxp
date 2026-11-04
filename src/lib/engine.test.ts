import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beatsNeeded, compareToLast, computeGame, flameFor, goalAt, levelForStars, levelInfo, medalOf, perfectWeekStars, rankFor, RANKS, RULES, seasonOf, starsForLevel, withWeeklyGoal,
} from './engine';
import { ACHIEVEMENTS, RARITY_STARS, rarityOf } from './trophies';
import { allExercises, BUILTIN, exerciseMap, fmtBeat, fmtSet, toBeatText } from './exercises';
import { gameFor } from './game';
import { emptyData, type AppData, type Exercise, type Routine, type Session } from './types';
import { activeRoutines, firstReps, fmtRest, fmtTarget, hitTarget, inOrder, lastDone, moveTo, nextPosition, repsForSet, routineItems, upNextRoutine } from './routines';
import { mergeData } from './merge';
import { parseDuration, parseWatchText, parseWorkoutLine, weekKey } from './util';
import { deriveKey, seal, unseal } from './crypto';
import { upNext, weekMessage } from './today';

let n = 0;
const sess = (date: string, exercises: Session['exercises'], extra: Partial<Session> = {}): Session => ({
  id: `s${++n}`, updatedAt: 1, createdAt: n, date, exercises, ...extra,
});
const game = (d: AppData) => computeGame(d, exerciseMap(d));
const ex = (exerciseId: string, kg: number, ...reps: number[]) => ({ exerciseId, sets: reps.map((r) => ({ kg, reps: r })) });
const result = (g: ReturnType<typeof game>, s: Session) => g.sessions.get(s.id)!;
const TEN_SETS = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
const add = (d: AppData, date: string, exercises: Session['exercises'], extra: Partial<Session> = {}) => {
  const s = sess(date, exercises, extra);
  d.sessions.push(s);
  return s;
};

/** Pin "today" for tests that look at where a streak stands now. */
const atDate = (date: string) => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${date}T12:00:00`)); });
  afterEach(() => { vi.useRealTimers(); });
};

describe('levels and ranks', () => {
  it('reaching level n takes n² − 1 stars', () => {
    expect(starsForLevel(1)).toBe(0);
    expect(starsForLevel(2)).toBe(3);
    expect(starsForLevel(10)).toBe(99);
    expect(starsForLevel(100)).toBe(9999);
    for (let l = 1; l < 200; l++) {
      expect(levelForStars(starsForLevel(l))).toBe(l);
      expect(levelForStars(starsForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it('reports progress inside a level', () => {
    const L = levelInfo(starsForLevel(23) + 31);
    expect(L).toMatchObject({ level: 23, into: 31, span: 47 });
    expect(L.rank.title).toBe('Gold Lifter');
    expect(L.nextRank?.title).toBe('Platinum Lifter');
  });

  it('ranks come from the level alone', () => {
    expect(rankFor(1).title).toBe('Rookie');
    expect(rankFor(2).title).toBe('Beginner');
    expect(rankFor(20).title).toBe('Gold Lifter');
    expect(rankFor(100).title).toBe('Olympian');
    expect(RANKS).toHaveLength(17);
  });
});

describe('workout stars', () => {
  it('the first workout ever earns all 3, whatever its size', () => {
    const d = emptyData();
    const s = add(d, '2026-01-05', [ex('Leg_Press', 100, 5)]);
    const r = result(game(d), s);
    expect(r.dayStars).toBe(3);
    expect(r.firstEver).toBe(true);
    expect(levelInfo(r.starsAfter).level).toBeGreaterThanOrEqual(2);
  });

  it('showing up alone earns 1', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 12, 12, 12)]);
    const s = add(d, '2026-01-07', [ex('Leg_Press', 100, 10)]);
    expect(result(game(d), s).dayStars).toBe(1);
    expect(result(game(d), s).checks).toEqual({ show: true, work: false, beat: false });
  });

  it('10+ sets earn the second star', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, ...TEN_SETS)]);
    const s = add(d, '2026-01-07', [ex('Leg_Press', 100, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10)]);
    const r = result(game(d), s);
    expect(r.checks).toEqual({ show: true, work: true, beat: false });
    expect(r.dayStars).toBe(2);
  });

  it('a cardio day counts minutes as the work, and has nothing to beat', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 10)]);
    const s = add(d, '2026-01-07', [], { watch: { durationMin: 45 } });
    const r = result(game(d), s);
    expect(r.checks).toEqual({ show: true, work: true, beat: false });
    expect(r.dayStars).toBe(2);
  });

  it('beating last time on half your exercises, rounded up, earns the third star', () => {
    expect(beatsNeeded(1)).toBe(1);
    expect(beatsNeeded(4)).toBe(2);
    expect(beatsNeeded(5)).toBe(3);
    const ids = ['Leg_Press', 'Leg_Extensions', 'Seated_Leg_Curl', 'Butterfly', 'Face_Pull'];
    const base = () => {
      const d = emptyData();
      add(d, '2026-01-05', ids.map((id) => ex(id, 50, 10, 10)));
      return d;
    };
    const two = base();
    const s2 = add(two, '2026-01-07', ids.map((id, i) => ex(id, i < 2 ? 55 : 50, 10, 10)));
    expect(result(game(two), s2).checks.beat).toBe(false);
    const three = base();
    const s3 = add(three, '2026-01-07', ids.map((id, i) => ex(id, i < 3 ? 55 : 50, 10, 10)));
    expect(result(game(three), s3).checks.beat).toBe(true);
    expect(result(game(three), s3).beats.filter((b) => b.beat)).toHaveLength(3);
  });

  it('a new exercise counts as a beat, because it sets your baseline', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 10)]);
    const s = add(d, '2026-01-07', [ex('Butterfly', 30, 10)]);
    const r = result(game(d), s);
    expect(r.beats[0]).toMatchObject({ first: true, beat: true });
    expect(r.checks.beat).toBe(true);
  });

  it('two workouts in a day score as one gym day, capped at 3', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, ...TEN_SETS)]);
    const a = add(d, '2026-01-07', [ex('Leg_Press', 100, 10, 10, 10, 10, 10, 10)]);
    const b = add(d, '2026-01-07', [ex('Leg_Press', 100, 10, 10, 10, 10)]);
    const g = game(d);
    expect(g.visits).toBe(2);
    expect(result(g, a).dayStars).toBe(1);
    expect(result(g, b).dayStars).toBe(2); // 6 + 4 sets reach the work star together
    expect(result(g, b).items.find((i) => i.kind === 'workout')?.stars).toBe(1);
    const c = add(d, '2026-01-07', [ex('Butterfly', 30, 10)]);
    const g2 = game(d);
    expect(result(g2, c).dayStars).toBeLessThanOrEqual(3);
  });

  it('imported workouts never earn the third star or pay for records', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 10)], { estimated: true });
    const s = add(d, '2026-01-07', [ex('Leg_Press', 120, 10)], { estimated: true });
    const g = game(d);
    const r = result(g, s);
    expect(r.checks.beat).toBe(false);
    expect(r.prs).toHaveLength(1);
    expect(r.items.filter((i) => i.kind === 'record').every((i) => i.stars === 0)).toBe(true);
    expect(result(g, d.sessions[0]).firstEver).toBe(false);
  });

  it('deleted sessions are ignored', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 10)], { deleted: true });
    expect(game(d).totalStars).toBe(0);
  });

  it('stars do not depend on how much weight a machine moves, or on watch data', () => {
    const run = (id: string, kg: number, watch?: Session['watch']) => {
      const d = emptyData();
      add(d, '2026-01-05', [ex(id, kg, 10, 10, 10)]);
      const s = add(d, '2026-01-07', [ex(id, kg, 11, 10, 10)], watch ? { watch } : {});
      return result(game(d), s).dayStars;
    };
    expect(run('Leg_Press', 200)).toBe(run('Side_Lateral_Raise', 5));
    expect(run('Leg_Press', 200, { durationMin: 20, kcal: 900 })).toBe(run('Leg_Press', 200));
  });
});

describe('beating your last time', () => {
  const byId = (id: string) => BUILTIN.find((e) => e.id === id) as Exercise;
  const sets = (kg: number, ...reps: number[]) => reps.map((r) => ({ kg, reps: r }));

  it('more weight, or the same weight and more reps', () => {
    const m = byId('Leg_Press');
    const last = sets(100, 12, 12, 11);
    expect(compareToLast(m, 'x', sets(105, 8, 8, 7), last)).toMatchObject({ beat: true, kg: 5 });
    expect(compareToLast(m, 'x', sets(100, 12, 12, 12), last)).toMatchObject({ beat: true, kg: 0, reps: 1 });
    expect(compareToLast(m, 'x', sets(100, 12, 12, 11), last)).toMatchObject({ beat: false, kg: 0, reps: 0 });
    expect(compareToLast(m, 'x', sets(95, 15, 15, 15), last).beat).toBe(false); // lighter doesn't count
    expect(compareToLast(m, 'x', sets(100, 10, 10, 10), undefined)).toMatchObject({ beat: true, first: true });
  });

  it('assisted machines: less assistance is heavier', () => {
    const m = byId('Assisted_Pull-Up_Machine');
    expect(compareToLast(m, 'x', sets(30, 8), sets(40, 8))).toMatchObject({ beat: true, kg: 10 });
    expect(compareToLast(m, 'x', sets(50, 12), sets(40, 8)).beat).toBe(false);
    expect(fmtBeat(m, compareToLast(m, 'x', sets(30, 8), sets(40, 8)))).toBe('−10 kg assist');
  });

  it('timed holds compare seconds, bodyweight moves compare reps', () => {
    const plank = byId('Plank');
    expect(compareToLast(plank, 'x', sets(0, 70), sets(0, 60))).toMatchObject({ beat: true, reps: 10 });
    expect(fmtBeat(plank, compareToLast(plank, 'x', sets(0, 70), sets(0, 60)))).toBe('+10s');
    const pull = byId('Pullups');
    expect(compareToLast(pull, 'x', sets(0, 6, 5), sets(0, 5, 5))).toMatchObject({ beat: true, reps: 1 });
    expect(fmtBeat(pull, compareToLast(pull, 'x', sets(0, 6, 5), sets(0, 5, 5)))).toBe('+1 rep');
  });

  it('benchmarks compare rounds or rungs, or a faster full ladder', () => {
    const cindy = byId('Hero_Cindy');
    expect(compareToLast(cindy, 'x', sets(0, 11), sets(0, 9))).toMatchObject({ beat: true, reps: 2 });
    const ladder = byId('Hero_Ladder');
    expect(compareToLast(ladder, 'x', sets(50, 19), sets(55, 19))).toMatchObject({ beat: true, kg: 5 });
    expect(compareToLast(ladder, 'x', sets(60, 19), sets(55, 19)).beat).toBe(false);
  });

  it('says what it would take', () => {
    expect(toBeatText(byId('Leg_Press'), sets(55, 12, 11, 8))).toBe('To beat: 55 kg for 32+ reps, or go heavier');
    expect(toBeatText(byId('Assisted_Pull-Up_Machine'), sets(30, 8, 8))).toBe('To beat: 30 kg assist for 17+ reps, or less assist');
    expect(toBeatText(byId('Plank'), sets(0, 60))).toBe('To beat: 61+ s in total, or add weight');
    expect(toBeatText(byId('Pullups'), sets(0, 5, 5))).toBe('To beat: 11+ reps in total, or add weight');
    expect(fmtBeat(byId('Leg_Press'), { exerciseId: 'x', beat: false, first: false, kg: 0, reps: 0 })).toBe('Same');
    expect(fmtBeat(byId('Leg_Press'), { exerciseId: 'x', beat: false, first: false, kg: -5, reps: 2 })).toBe('Next time');
  });
});

describe('bonus stars', () => {
  it('records pay +1 each, up to 3 per workout', () => {
    const ids = ['Leg_Press', 'Leg_Extensions', 'Seated_Leg_Curl', 'Butterfly', 'Face_Pull'];
    const d = emptyData();
    add(d, '2026-01-05', ids.map((id) => ex(id, 50, 10)));
    const s = add(d, '2026-01-07', ids.map((id) => ex(id, 60, 10)));
    const records = result(game(d), s).items.filter((i) => i.kind === 'record');
    expect(records).toHaveLength(5);
    expect(records.reduce((a, i) => a + i.stars, 0)).toBe(RULES.recordCap);
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

  it('one surprise star per gym day, and the conditions still count toward trophies', () => {
    const d = emptyData();
    const wet = { weather: { tempC: 3, rain: true } };
    const a = add(d, '2026-07-09', [ex('Leg_Press', 50, 10)], wet); // a feriado, raining and cold
    const b = add(d, '2026-07-09', [ex('Leg_Extensions', 20, 10)], wet);
    const g = game(d);
    const surprises = result(g, a).items.filter((i) => i.kind === 'surprise');
    expect(surprises).toHaveLength(1);
    expect(surprises[0]).toMatchObject({ stars: RULES.surpriseStars });
    expect(surprises[0].label).toContain('Feriado');
    expect(result(g, b).items.some((i) => i.kind === 'surprise')).toBe(false);
    expect(g.unlockedIds.has('hol-1') && g.unlockedIds.has('wx-rain-1') && g.unlockedIds.has('wx-cold')).toBe(true);
  });

  it('coming back after a missed week earns the surprise star', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 50, 10)]);
    const next = add(d, '2026-01-12', [ex('Leg_Press', 50, 10)]);
    const back = add(d, '2026-01-26', [ex('Leg_Press', 50, 10)]);
    const g = game(d);
    expect(result(g, next).items.some((i) => i.kind === 'surprise')).toBe(false);
    expect(result(g, back).items.find((i) => i.kind === 'surprise')?.label).toContain('Welcome back');
  });

  it('weigh-ins pay only through trophies and the challenge', () => {
    const d = emptyData();
    d.weights.push({ id: 'a', updatedAt: 1, date: '2026-01-05', kg: 80 });
    const g = game(d);
    expect(g.unlockedIds.has('body-first')).toBe(true);
    expect(g.totalStars).toBeGreaterThanOrEqual(RARITY_STARS.common);
  });
});

describe('streak, shields and Perfect Weeks', () => {
  atDate('2026-03-30'); // a Monday

  const weekly = (d: AppData, weeks: string[]) => weeks.map((date) => add(d, date, [ex('Leg_Press', 50, 10)]));

  it('one workout a week keeps the streak, even when the goal is missed', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 3;
    const ss = weekly(d, ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']);
    const g = game(d);
    expect(result(g, ss[3]).streakWeeks).toBe(4);
    expect(g.perfectWeeks).toBe(0);
    expect(g.streak.weeks).toBe(4);
    expect(g.streak.flame.name).toBe('Flame');
  });

  it('a second workout in the same week does not add to the streak', () => {
    const d = emptyData();
    weekly(d, ['2026-03-23', '2026-03-25']);
    expect(game(d).streak.weeks).toBe(1);
  });

  it('a shield covers an empty week automatically, then the streak ends', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 3;
    weekly(d, ['2026-02-02', '2026-02-09']);
    const shielded = add(d, '2026-02-23', [ex('Leg_Press', 50, 10)]); // missed the week of Feb 16
    const after = game(d);
    expect(result(after, shielded).streakWeeks).toBe(3); // the protected week doesn't add to it
    const ended = add(d, '2026-03-09', [ex('Leg_Press', 50, 10)]); // missed Mar 2, no shield left
    weekly(d, ['2026-03-16', '2026-03-23']);
    const g = game(d);
    expect(result(g, ended).streakWeeks).toBe(1);
    expect(g.streak.lastBreak).toMatchObject({ weeks: 3 });
    expect(g.streak.best).toBe(3);
  });

  it('weeks that passed with no workout are settled when you look today', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 3;
    weekly(d, ['2026-03-02']);
    const g = game(d); // Mar 9 and Mar 16 and Mar 23 are all empty: one shield, then it ends
    expect(g.streak.weeks).toBe(0);
    expect(g.streak.shields).toBe(0);
    expect(g.streak.lastBreak?.weeks).toBe(1);
  });

  it('backdating a real workout repairs the week', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 3;
    weekly(d, ['2026-02-16', '2026-03-02', '2026-03-16', '2026-03-23']); // two gaps, and only one shield
    expect(game(d).streak.lastBreak).toBeDefined();
    weekly(d, ['2026-03-09']);
    const g = game(d);
    expect(g.streak.lastBreak).toBeUndefined();
    expect(g.streak.weeks).toBe(5);
  });

  it('earns a shield every 4 Perfect Weeks, holding 2 at most', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    const mondays = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10));
    weekly(d, mondays);
    const g = game(d);
    expect(g.perfectWeeks).toBe(12);
    expect(g.streak.shields).toBe(RULES.maxShields);
  });

  it('a Perfect Week pays goal × flame, on the visit that completes it', () => {
    expect(flameFor(1).mult).toBe(1);
    expect(flameFor(4).mult).toBe(1.5);
    expect(flameFor(12).mult).toBe(2);
    expect(flameFor(26).mult).toBe(2.5);
    expect(flameFor(52).mult).toBe(3);
    expect(perfectWeekStars(3, 1)).toBe(3);
    expect(perfectWeekStars(3, 4)).toBe(5); // 4.5 rounds up
    expect(perfectWeekStars(3, 26)).toBe(8);
    expect(perfectWeekStars(5, 52)).toBe(15);
    expect(perfectWeekStars(1, 1)).toBe(1);
    const d = emptyData();
    d.profile.weeklyGoal = 2;
    const [a, b, c] = weekly(d, ['2026-03-23', '2026-03-25', '2026-03-27']);
    const g = game(d);
    expect(result(g, a).perfectWeek).toBe(false);
    expect(result(g, b).perfectWeek).toBe(true);
    expect(result(g, b).items.find((i) => i.kind === 'perfect')?.stars).toBe(2);
    expect(result(g, c).perfectWeek).toBe(false); // a third visit doesn't pay twice
    expect(g.perfectWeeks).toBe(1);
  });

  it('changing the weekly goal never rewrites past weeks', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 2;
    weekly(d, ['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11']);
    expect(game(d).perfectWeeks).toBe(2);
    d.profile = withWeeklyGoal(d.profile, 5, '2026-03-11', true);
    expect(d.profile.weeklyGoal).toBe(5);
    expect(goalAt(d.profile, '2026-03-09')).toBe(2);
    expect(goalAt(d.profile, '2026-03-16')).toBe(5);
    expect(game(d).perfectWeeks).toBe(2);
  });

  it('setting the goal back before it takes effect cancels the change', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 2;
    const up = withWeeklyGoal(d.profile, 5, '2026-03-11', true);
    const back = withWeeklyGoal(up, 2, '2026-03-12', true);
    expect(goalAt(back, '2026-03-16')).toBe(2);
    expect(back.goalHistory).toHaveLength(1);
  });

  it('with no workouts yet, a new goal applies right away', () => {
    const d = emptyData();
    const p = withWeeklyGoal(d.profile, 4, '2026-03-11', false);
    expect(p.goalHistory).toBeUndefined();
    expect(goalAt(p, '2026-03-09')).toBe(4);
  });

  it('warns calmly only when the week is at risk', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 3;
    weekly(d, ['2026-03-23']);
    const g = game(d); // today is Monday Mar 30
    expect(weekMessage(g, '2026-03-30').tone).toBe('calm');
    expect(weekMessage(g, '2026-04-02').tone).toBe('risk'); // Thursday, nothing yet
    expect(weekMessage(g, '2026-04-02').text).toContain('shield');
    const noWorkouts = game(emptyData());
    expect(weekMessage(noWorkouts, '2026-04-02').tone).toBe('calm');
  });
});

describe('seasons', () => {
  atDate('2026-11-30');

  it('are calendar quarters', () => {
    const s = seasonOf('2026-10-12');
    expect(s).toMatchObject({ key: '2026-Q4', label: 'Spring 2026', weeks: 13, perfect: 0, tier: -1 });
    expect(seasonOf('2026-11-30').weeks).toBe(13);
  });

  it('medals count Perfect Weeks and pay stars', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    const mondays = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
    const ss = mondays.map((date) => add(d, date, [ex('Leg_Press', 50, 10)]));
    const g = game(d);
    const q4 = g.seasons.find((x) => x.key === '2026-Q4')!;
    expect(q4.perfect).toBe(4);
    expect(q4.tier).toBe(0); // Bronze at 4
    expect(result(g, ss[3]).items.find((i) => i.kind === 'season')).toMatchObject({ stars: RULES.seasonMedalStars });
    expect(g.season.key).toBe('2026-Q4');
  });
});

describe('weekly challenge', () => {
  atDate('2026-10-07');

  it('picks one deterministically and pays when done', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-10-05', [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    const g1 = game(d), g2 = game(d);
    expect(g1.challenge?.id).toBe(g2.challenge?.id);
    expect(g1.challenge?.stars).toBe(RULES.challengeStars);
    expect(g1.challenge?.done).toBe(false);
  });

  it('a done challenge adds stars on the workout that finishes it', () => {
    // Every week picks some challenge; find a week where it's "train legs" or "weekend" and prove it pays once.
    const d = emptyData();
    for (let i = 0; i < 26; i++) {
      const date = new Date(Date.UTC(2026, 0, 3 + i * 7)).toISOString().slice(0, 10); // Saturdays
      d.sessions.push(sess(date, [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    }
    const items = [...game(d).sessions.values()].flatMap((r) => r.items.filter((i) => i.kind === 'challenge'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.stars === RULES.challengeStars)).toBe(true);
  });
});

describe('machine medals', () => {
  it('have fixed thresholds', () => {
    expect(medalOf(9).current).toBeNull();
    expect(medalOf(10).current!.name).toBe('Bronze');
    expect(medalOf(30).current!.name).toBe('Silver');
    expect(medalOf(75).current!.name).toBe('Gold');
    expect(medalOf(600).current!.name).toBe('Master');
    expect(medalOf(600).next).toBeUndefined();
  });

  it('pay 1 point per workout, 3 when you beat your last time, and show strength gained', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 10)]); // first time: a beat, 3 points
    add(d, '2026-01-07', [ex('Leg_Press', 100, 10)]); // same: 1 point
    add(d, '2026-01-09', [ex('Leg_Press', 110, 10)]); // heavier: 3 points
    const best = game(d).bests.get('Leg_Press')!;
    expect(best.points).toBe(7);
    expect(best.gain).toBeCloseTo(0.1);
  });

  it('report a new medal on the workout that earns it', () => {
    const d = emptyData();
    let last: Session | undefined;
    for (let i = 0; i < 4; i++) last = add(d, `2026-01-0${i + 1}`, [ex('Leg_Press', 100 + i * 5, 10)]);
    const r = result(game(d), last!); // 3 points × 4 workouts crosses 10
    expect(r.medalUps).toEqual([{ exerciseId: 'Leg_Press', name: 'Bronze', icon: '🥉' }]);
  });
});

describe('trophies', () => {
  it('rarity follows value, and rarity sets the stars', () => {
    expect(rarityOf(50)).toBe('common');
    expect(rarityOf(300)).toBe('rare');
    expect(rarityOf(1000)).toBe('epic');
    expect(rarityOf(2500)).toBe('legendary');
    for (const a of ACHIEVEMENTS) expect(a.stars).toBe(RARITY_STARS[a.rarity]);
  });

  it('has a Habit Formed trophy at 26 weeks', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'streak-26')?.title).toBe('Habit Formed');
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

  it('volume milestones still count', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-13', [{ exerciseId: 'Leg_Press', sets: [{ kg: 100, reps: 10 }, { kg: 100, reps: 10 }] }]));
    const g = game(d);
    expect(g.unlockedIds.has('volume-1000')).toBe(true);
    expect(g.unlockedIds.has('visits-1')).toBe(true);
    expect(g.sessions.get(d.sessions[0].id)!.volume).toBe(2000);
    expect(g.visits).toBe(1);
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

describe('calibration report', () => {
  const log = (weeks: number) => {
    const d = emptyData();
    for (let i = 0; i < weeks; i++) d.sessions.push(sess(new Date(Date.UTC(2025, 0, 6 + i * 7)).toISOString().slice(0, 10), [ex('Leg_Press', 50 + i, ...TEN_SETS)]));
    return d;
  };

  it('holds its verdict on the third star until there is enough history', async () => {
    const { calibrationReport } = await import('../dev/calibrate');
    expect(calibrationReport(log(10))).toContain('WAIT 3-star');
    expect(calibrationReport(log(40))).toMatch(/(OK {2}|LOOK) 3-star/);
    expect(calibrationReport(emptyData())).toBe('No workouts in this file.');
  });

  it('leaves imported workouts out of the rates', async () => {
    const { calibrationReport } = await import('../dev/calibrate');
    const d = log(4);
    d.sessions[0].estimated = true;
    expect(calibrationReport(d)).toContain('(1 imported from memory');
  });
});

describe('the shared game', () => {
  it('is computed once per data object', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [ex('Leg_Press', 100, 10)]));
    expect(gameFor(d)).toBe(gameFor(d));
    expect(gameFor({ ...d })).not.toBe(gameFor(d));
  });

  it('suggests the closest long-term goal', () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-05', [ex('Leg_Press', 100, 10)]));
    const goals = upNext(game(d));
    expect(goals.length).toBeGreaterThan(0);
    for (let i = 1; i < goals.length; i++) expect(goals[i - 1].pct).toBeGreaterThanOrEqual(goals[i].pct);
    expect(goals.every((x) => x.pct >= 0 && x.pct <= 1)).toBe(true);
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

  it('keeps the goal history on the profile', () => {
    const a = emptyData();
    const b = emptyData();
    b.profile = { ...withWeeklyGoal(b.profile, 5, '2026-03-11', true), updatedAt: 9 };
    expect(mergeData(a, b).profile.goalHistory).toHaveLength(2);
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
    const { searchExercises } = await import('./exercises');
    const r = searchExercises(BUILTIN, 'bench press').map((e) => e.name);
    expect(r.indexOf('Barbell Bench Press')).toBeLessThan(r.indexOf('Chest Press Machine'));
    expect(r[0]).toMatch(/Bench Press/);
  });
});

describe('holidays', () => {
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
});

describe('hero physique, while shelved', () => {
  it('leaves no Hero trophies or exercises to pick, but old workouts still display', () => {
    expect(ACHIEVEMENTS.some((a) => a.category === 'Hero')).toBe(false);
    const d = emptyData();
    expect(allExercises(d).some((e) => e.benchmark)).toBe(false);
    expect(exerciseMap(d).get('Hero_Ladder')?.benchmark).toBe('ladder');
    d.sessions.push(sess('2026-02-02', [{ exerciseId: 'Hero_Cindy', sets: [{ kg: 0, reps: 12 }] }]));
    const g = game(d);
    expect(g.sessions.get(d.sessions[0].id)!.sets).toBe(1);
    expect(g.unlockedIds.has('hero-cindy-10')).toBe(false);
  });

  it('keeps plain strength milestones, as Strength trophies', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'hero-push-50')?.category).toBe('Strength');
    expect(ACHIEVEMENTS.find((a) => a.id === 'hero-dip-20')?.category).toBe('Strength');
    const d = emptyData();
    d.weights.push({ id: 'w', updatedAt: 1, date: '2026-01-01', kg: 68 });
    d.sessions.push(sess('2026-02-02', [{ exerciseId: 'Pullups', sets: [{ kg: 0, reps: 3 }] }]));
    const g = game(d);
    expect(g.maxPullups).toBe(3);
    expect(g.unlockedIds.has('str-pullup')).toBe(true);
  });

  it('never picks a Hero challenge', () => {
    const d = emptyData();
    for (let i = 0; i < 60; i++) {
      const date = new Date(Date.UTC(2025, 0, 6 + i * 7)).toISOString().slice(0, 10);
      d.sessions.push(sess(date, [{ exerciseId: 'Leg_Press', sets: [{ kg: 50, reps: 10 }] }]));
    }
    const items = [...game(d).sessions.values()].flatMap((r) => r.items);
    expect(items.some((i) => i.label.includes('Hero benchmark'))).toBe(false);
  });
});

describe('hero physique, switched back on', () => {
  afterEach(() => {
    vi.doUnmock('./features');
    vi.resetModules();
  });

  const withHero = async () => {
    vi.resetModules();
    vi.doMock('./features', () => ({ FEATURES: { hero: true } }));
    const engine = await import('./engine');
    const exercises = await import('./exercises');
    const trophies = await import('./trophies');
    return { game: (d: AppData) => engine.computeGame(d, exercises.exerciseMap(d)), exercises, trophies };
  };

  it('restores its trophies and exercises', async () => {
    const { exercises, trophies } = await withHero();
    expect(trophies.ACHIEVEMENTS.some((a) => a.category === 'Hero')).toBe(true);
    expect(exercises.allExercises(emptyData()).some((e) => e.benchmark)).toBe(true);
  });

  it('engine tracks bodyweight reps, benchmark PRs and hero stages', async () => {
    const { game: heroGame } = await withHero();
    const d = emptyData();
    d.weights.push({ id: 'w', updatedAt: 1, date: '2026-01-01', kg: 68 });
    d.sessions.push(sess('2026-02-02', [{ exerciseId: 'Pullups', sets: [{ kg: 0, reps: 3 }] }, { exerciseId: 'Hero_Cindy', sets: [{ kg: 0, reps: 9 }] }]));
    d.sessions.push(sess('2026-02-04', [{ exerciseId: 'Pullups', sets: [{ kg: 0, reps: 5 }] }, { exerciseId: 'Hero_Cindy', sets: [{ kg: 0, reps: 11 }] }, { exerciseId: 'Hero_Ladder', sets: [{ kg: 52, reps: 19 }] }]));
    const g = heroGame(d);
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
});

describe('hero scoring', () => {
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

describe('routines', () => {
  const routine = (id: string, name: string, exerciseIds: string[], extra: Partial<Routine> = {}): Routine => ({ id, updatedAt: 1, name, exerciseIds, ...extra });

  it('older routines without targets default to 3 sets', () => {
    const r = routine('a', 'Day A', ['Leg_Press', 'Leg_Extensions']);
    expect(routineItems(r)).toEqual([{ exerciseId: 'Leg_Press', sets: 3, reps: '' }, { exerciseId: 'Leg_Extensions', sets: 3, reps: '' }]);
    expect(fmtTarget(routineItems(r)[0])).toBe('3 sets');
  });

  it('formats and splits rep targets', () => {
    expect(fmtTarget({ sets: 3, reps: '10' })).toBe('3 × 10');
    expect(repsForSet('12/10/8', 0)).toBe('12');
    expect(repsForSet('12/10/8', 2)).toBe('8');
    expect(repsForSet('12/10/8', 3)).toBe('8'); // extra sets repeat the last target
    expect(repsForSet('8-12', 1)).toBe('8-12');
    expect(firstReps('8-12')).toBe(8);
    expect(firstReps('max')).toBeNull();
    expect(fmtRest(90)).toBe('90 s');
    expect(fmtRest(150)).toBe('2.5 min');
  });

  it('suggests more weight only when every planned set hit the top of its target', () => {
    const set = (...reps: number[]) => reps.map((r) => ({ kg: 40, reps: r }));
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '10' }, set(10, 10, 10))).toBe(true);
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '10' }, set(10, 10, 9))).toBe(false);
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '10' }, set(12, 12))).toBe(false); // missed a set
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '8-12' }, set(12, 11, 10))).toBe(false);
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '12/10/8' }, set(12, 10, 8))).toBe(true);
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '' }, set(20, 20, 20))).toBe(false);
    expect(hitTarget({ exerciseId: 'x', sets: 3, reps: '10' }, null)).toBe(false);
  });

  it('tracks last done and picks the routine you are due for', () => {
    const a = routine('a', 'Day A', ['Leg_Press', 'Leg_Extensions', 'Seated_Leg_Curl']);
    const b = routine('b', 'Day B', ['Butterfly', 'Machine_Bench_Press']);
    const d = emptyData();
    d.routines = [b, a];
    d.sessions = [
      sess('2026-10-01', [{ exerciseId: 'Leg_Press', sets: [{ kg: 80, reps: 10 }] }, { exerciseId: 'Seated_Leg_Curl', sets: [{ kg: 30, reps: 10 }] }]),
      sess('2026-10-03', [{ exerciseId: 'Butterfly', sets: [{ kg: 30, reps: 10 }] }]),
      sess('2026-10-05', [{ exerciseId: 'Leg_Extensions', sets: [{ kg: 30, reps: 10 }] }]), // 1/3 of Day A: doesn't count
    ];
    const rs = activeRoutines(d);
    expect(rs.map((r) => r.name)).toEqual(['Day A', 'Day B']);
    const done = lastDone(d, rs);
    expect(done.get('a')).toBe('2026-10-01');
    expect(done.get('b')).toBe('2026-10-03');
    expect(upNextRoutine(rs, done)?.id).toBe('a');
    expect(upNextRoutine([a], done)).toBeNull(); // nothing to rotate
  });
});

describe('reordering exercises', () => {
  const started = (x: string) => x.endsWith('*');

  it('moves an item to a new position', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('"do next" lands right after the last exercise you started', () => {
    const l = ['a*', 'b*', 'c', 'd', 'e'];
    expect(nextPosition(l, 3, started)).toBe(2);
    expect(moveTo(l, 3, nextPosition(l, 3, started))).toEqual(['a*', 'b*', 'd', 'c', 'e']);
    expect(nextPosition(l, 2, started)).toBe(2); // already next: nothing to do
    expect(nextPosition(['a', 'b', 'c'], 2, started)).toBe(0); // nothing started: goes first
    expect(nextPosition(['a', 'b*', 'c*'], 0, started)).toBe(2); // stays after what's been done
  });

  it('applies today\'s order, with anything new at the end', () => {
    const items = ['a', 'b', 'c'].map((exerciseId) => ({ exerciseId, sets: 3, reps: '' }));
    expect(inOrder(items, null).map((i) => i.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(inOrder(items, ['c', 'a', 'b']).map((i) => i.exerciseId)).toEqual(['c', 'a', 'b']);
    expect(inOrder(items, ['c', 'gone']).map((i) => i.exerciseId)).toEqual(['c', 'a', 'b']);
  });

  it('order does not change a workout\'s stars', () => {
    const run = (ids: string[]) => {
      const d = emptyData();
      add(d, '2026-01-05', ids.map((id) => ex(id, 50, 10, 10)));
      const s = add(d, '2026-01-07', ids.map((id) => ex(id, id === 'Butterfly' ? 50 : 55, 10, 10)));
      return result(game(d), s).dayStars;
    };
    expect(run(['Leg_Press', 'Butterfly', 'Face_Pull'])).toBe(run(['Face_Pull', 'Leg_Press', 'Butterfly']));
  });
});

describe("farmer's walk", () => {
  const walk = BUILTIN.find((e) => e.id === 'Farmers_Walk') as Exercise;

  it('is a timed exercise with the weight logged per hand', () => {
    expect(walk).toMatchObject({ name: "Farmer's Walk", hold: true, loadFactor: 2, equipment: 'Dumbbell', group: 'Core' });
    expect(walk.images).toHaveLength(2);
    expect(walk.primaryMuscles).toContain('Forearms');
    expect(allExercises(emptyData()).some((e) => e.id === 'Farmers_Walk')).toBe(true);
  });

  it('counts both hands toward volume, at one rep per 3 seconds', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Farmers_Walk', 30, 60, 45)]);
    expect(game(d).history.get('Farmers_Walk')![0].volume).toBeCloseTo(2 * 30 * (105 / 3));
  });

  it('counts heavier as a weight record, and longer at the same weight as a time record', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Farmers_Walk', 30, 60)]);
    const heavier = add(d, '2026-01-07', [ex('Farmers_Walk', 35, 40)]);
    const longer = add(d, '2026-01-09', [ex('Farmers_Walk', 35, 75)]);
    const same = add(d, '2026-01-12', [ex('Farmers_Walk', 35, 75)]);
    const g = game(d);
    expect(result(g, heavier).prs).toEqual([{ exerciseId: 'Farmers_Walk', kind: 'weight', value: 35, prev: 30 }]);
    expect(result(g, longer).prs).toEqual([{ exerciseId: 'Farmers_Walk', kind: 'hold', value: 75, prev: 60 }]);
    expect(result(g, same).prs).toEqual([]);
    expect(g.bests.get('Farmers_Walk')).toMatchObject({ maxKg: 35, maxReps: 75 });
  });

  it('beats last time with more weight or more seconds, and says so', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Farmers_Walk', 30, 60)]);
    const s = add(d, '2026-01-07', [ex('Farmers_Walk', 30, 70)]);
    const r = result(game(d), s);
    expect(r.beats[0]).toMatchObject({ beat: true, kg: 0, reps: 10 });
    expect(fmtBeat(walk, r.beats[0])).toBe('+10s');
    expect(fmtBeat(walk, compareToLast(walk, 'x', [{ kg: 32.5, reps: 40 }], [{ kg: 30, reps: 60 }]))).toBe('+2.5 kg');
    expect(toBeatText(walk, [{ kg: 30, reps: 60 }])).toBe('To beat: 30 kg for 61+ s in total, or add weight');
    expect(fmtSet(walk, { kg: 30, reps: 60 })).toBe('30 kg · 60 s');
  });
});

describe('timed holds (plank)', () => {
  it('logs seconds: gentle volume, no reps, hold PRs instead of rep PRs', () => {
    const d = emptyData();
    d.weights = [{ id: 'w', updatedAt: 1, date: '2026-01-01', kg: 70 }];
    const plank = (date: string, secs: number[]) => sess(date, [{ exerciseId: 'Plank', sets: secs.map((reps) => ({ kg: 0, reps })) }]);
    d.sessions = [plank('2026-01-05', [60, 60, 60]), plank('2026-01-07', [90, 60])];
    const g = game(d);
    // 3 × 60 s = 60 rep-equivalents at 50 % of 70 kg
    expect(g.history.get('Plank')![0].volume).toBeCloseTo(60 * 0.5 * 70);
    const second = g.sessions.get(d.sessions[1].id)!;
    expect(second.prs).toEqual([{ exerciseId: 'Plank', kind: 'hold', value: 90, prev: 60 }]);
    expect(g.bests.get('Plank')!.maxReps).toBe(90);
  });

  it('long holds do not count toward the 500-rep award', () => {
    const d = emptyData();
    d.sessions = [sess('2026-01-05', [{ exerciseId: 'Plank', sets: [{ kg: 0, reps: 300 }, { kg: 0, reps: 300 }] }])];
    expect(game(d).unlocked.some((a) => a.id === 'hab-reps')).toBe(false); // 600 s would be 600 "reps"
  });
});
