import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beatsNeeded, compareToLast, computeGame, flameFor, goalAt, levelForStars, levelInfo, medalOf, perfectWeekStars, rankFor, RANKS, RULES, seasonOf, starsForLevel, withWeeklyGoal,
} from './engine';
import { ACHIEVEMENTS, RARITY_STARS, rarityOf, TROPHY_GROUPS } from './trophies';
import { allExercises, BUILTIN, exerciseMap, fmtBeat, fmtPr, fmtSet, toBeatText } from './exercises';
import { careerClock, compare, LEGENDS, timesMoved } from './legends';
import { bigMoments, careerStory } from './career';
import { gameFor } from './game';
import { emptyData, type AppData, type Exercise, type Routine, type Session } from './types';
import { withExercise, activeRoutines, firstReps, fmtRest, fmtTarget, hitTarget, inOrder, lastDone, moveTo, nextPosition, repsForSet, routineItems, upNextRoutine } from './routines';
import { mergeData } from './merge';
import { addDays, parseDuration, parseWatchText, parseWorkoutLine, weekKey } from './util';
import { deriveKey, seal, unseal } from './crypto';
import { broSays, sessionTitle, upNext, weekMessage } from './today';
import { hardSets, MAJOR_MUSCLES, MINOR_MUSCLES, averageVolume, bandOf, fmtSets, MUSCLES, muscleShares, ranked, relativeBands, routineEntries, sessionEntries, volumeOf, weeklyBands, weekVolume } from './muscles';
import { MAPPED } from '../components/BodyMap';
import { checkRotation, planVolume } from './routineCheck';
import { bmiApplies, goalAllowed, goalReached, hardHeartRate, minGoalKg, trendKg, whtrLabel, whtrOf } from './body';
import { e1rm } from './engine';

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
    expect(L.rank.title).toBe('Silver Lifter');
    expect(L.nextRank?.title).toBe('Gold Lifter');
  });

  it('ranks come from the level alone', () => {
    expect(rankFor(1).title).toBe('Rookie');
    expect(rankFor(2).title).toBe('Beginner');
    expect(rankFor(31).title).toBe('Gold Lifter');
    expect(rankFor(100).title).toBe('Titan');
    expect(rankFor(124).title).toBe('Demigod');
    expect(rankFor(125).title).toBe('Olympian');
    expect(RANKS).toHaveLength(18);
  });

  it('keeps Olympian out of reach for years, even with a flawless log', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 5;
    let date = '2010-01-04'; // a Monday
    for (let week = 0; week < 8 * 52; week++, date = addDays(date, 7)) {
      for (let day = 0; day < 5; day++) add(d, addDays(date, day), [ex('Leg_Press', 100, 10, 10, 10, 10, 10), ex('Leg_Extensions', 50, 10, 10, 10, 10, 10 + ((week + day) % 2))]);
    }
    expect(game(d).level.rank.title).not.toBe('Olympian'); // about 2,000 workouts, no week missed
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
    expect(toBeatText(byId('Leg_Press'), sets(55, 12, 11, 8))).toBe('To beat: 55 kg for 32+ reps, or go heavier for 16+');
    expect(toBeatText(byId('Assisted_Pull-Up_Machine'), sets(30, 8, 8))).toBe('To beat: 30 kg assist for 17+ reps, or less assist for 8+');
    expect(toBeatText(byId('Plank'), sets(0, 60))).toBe('To beat: 61+ s in total, or add weight for 30+ s');
    expect(toBeatText(byId('Pullups'), sets(0, 5, 5))).toBe('To beat: 11+ reps in total, or add weight for 5+');
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
    expect(perfectWeekStars(7, 52)).toBe(perfectWeekStars(5, 52)); // nothing pays for skipping rest days
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

  it('Bro cheers you on without guilt, and never asks for more than the week needs', () => {
    const idle = { trainedToday: false, draft: false };
    expect(broSays(game(emptyData()), idle).text).toContain('first workout');

    const d = emptyData();
    d.profile.weeklyGoal = 1;
    weekly(d, ['2026-03-09', '2026-03-16', '2026-03-23']);
    const streak = game(d); // three weeks running, nothing yet this week
    expect(broSays(streak, idle).text).toBe('3 weeks in a row. One visit this week keeps it rolling.');
    expect(broSays(streak, { trainedToday: false, draft: true }).mood).toBe('focus');

    weekly(d, ['2026-03-30']); // today: the goal of 1 is met
    const done = game(d);
    expect(broSays(done, { trainedToday: true, draft: false }).text).toContain('Enjoy the rest');

    const every = [broSays(game(emptyData()), idle), broSays(streak, idle), broSays(streak, { trainedToday: false, draft: true }), broSays(done, { trainedToday: true, draft: false }), broSays(done, idle)];
    for (const day of ['2026-03-30', '2026-03-31', '2026-04-01']) {
      const one = emptyData();
      weekly(one, ['2026-03-23']);
      every.push(broSays(game(one), idle, day));
    }
    for (const line of every) expect(line.text).not.toMatch(/miss|skip|lazy|behind|should|only|still haven|more than/i);
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
    expect(rarityOf(10000)).toBe('mythic');
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

  it('is a big collection with no loose ends', () => {
    expect(ACHIEVEMENTS).toHaveLength(136);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const grouped = new Set(TROPHY_GROUPS.flatMap((g) => g.categories));
    for (const a of ACHIEVEMENTS) expect(grouped.has(a.category) || a.category === 'Legends', a.id).toBe(true);
    for (const f of new Set(ACHIEVEMENTS.flatMap((a) => (a.family ? [a.family] : [])))) {
      const targets = ACHIEVEMENTS.filter((a) => a.family === f).map((a) => a.target!);
      expect(targets.length, f).toBeGreaterThanOrEqual(3);
      expect([...targets].sort((x, y) => x - y), f).toEqual(targets);
    }
    for (const id of ['hab-monday', 'visits-75', 'sets-100']) expect(ACHIEVEMENTS.some((a) => a.id === id), id).toBe(false);
  });

  it('rewards Perfect Weeks, 3-star workouts, medals and getting stronger', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    for (let i = 0; i < 12; i++) add(d, new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), [ex('Leg_Press', 100 + i * 5, ...TEN_SETS)]);
    const g = game(d);
    expect(g.unlockedIds.has('perfect-1') && g.unlockedIds.has('perfect-4')).toBe(true);
    expect(g.unlockedIds.has('perfect-13')).toBe(false);
    expect(g.progress['perfect-13']).toBe(12);
    expect(g.unlockedIds.has('allstar-10')).toBe(true); // every workout here beats the last
    expect(g.unlockedIds.has('medal-10')).toBe(true);
    expect(g.progress['medal-75']).toBe(36); // 12 workouts × 3 points
    expect(g.unlockedIds.has('gain-25')).toBe(true); // 100 → 155 kg
    expect(g.unlockedIds.has('gain-50')).toBe(true);
    expect(g.unlockedIds.has('gain-100')).toBe(false);
  });

  it('does not count strength gained until 5 workouts on a machine', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 50, 10)]);
    add(d, '2026-01-07', [ex('Leg_Press', 150, 10)]);
    expect(game(d).unlockedIds.has('gain-100')).toBe(false);
  });

  it('awards season trophies', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    for (let i = 0; i < 9; i++) add(d, new Date(Date.UTC(2026, 3, 6 + i * 7)).toISOString().slice(0, 10), [ex('Leg_Press', 50, 10)]);
    expect(game(d).unlockedIds.has('season-gold')).toBe(false);
    add(d, '2026-06-08', [ex('Leg_Press', 50, 10)]);
    expect(game(d).unlockedIds.has('season-gold')).toBe(true);
    expect(game(d).unlockedIds.has('season-champion')).toBe(false);
  });

  it('legend comparison uses barbell e1RM and visits', async () => {
    const d = emptyData();
    d.sessions.push(sess('2026-01-03', [{ exerciseId: 'Barbell_Deadlift', sets: [{ kg: 100, reps: 1 }] }]));
    const p = compare(game(d), LEGENDS.find((l) => l.id === 'eddie')!);
    const dl = p.rows.find((r) => r.metric.key === 'deadlift')!;
    expect(dl.mine).toBe(100); // one rep is the lift itself, not an estimate above it
    expect(dl.pct).toBeCloseTo(100 / 500);
  });
});

describe('legends', () => {
  const byId = (id: string) => LEGENDS.find((l) => l.id === id)!;
  const has = (d: AppData, id: string) => game(d).unlockedIds.has(id);

  it('each has three challenges', () => {
    for (const l of LEGENDS) expect(ACHIEVEMENTS.filter((a) => a.legend === l.id), l.id).toHaveLength(3);
  });

  it('tell your gym days as a story', () => {
    const arnold = byId('arnold');
    expect(careerClock(1, arnold)).toBe("You've trained as many days as Arnold's first week.");
    expect(careerClock(18, arnold)).toBe("You've trained as many days as Arnold's first 3 weeks.");
    expect(careerClock(156, arnold)).toBe("You've trained as many days as Arnold's first 6 months.");
    expect(careerClock(1000, arnold)).toBe("You've trained as many days as Arnold's first 3.2 years.");
    expect(careerClock(6000, arnold)).toBe("You've trained more days than Arnold's whole estimated career.");
  });

  it('count how many times you have moved their famous lift', () => {
    expect(timesMoved(1600, byId('eddie'))).toBe(3);
    expect(timesMoved(100, byId('eddie'))).toBe(0);
  });

  it('only show lift bars once you have logged that lift', () => {
    const d = emptyData();
    add(d, '2026-01-03', [ex('Leg_Press', 200, 10)]);
    expect(compare(game(d), byId('arnold')).rows).toEqual([]);
    add(d, '2026-01-05', [ex('Barbell_Squat', 100, 5)]);
    expect(compare(game(d), byId('arnold')).rows.map((r) => r.metric.key)).toEqual(['squat']);
  });

  it('Eddie: moving 500 kg in a set, on a machine, then more', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 40, 12)]);
    expect(has(d, 'leg-eddie-500')).toBe(false);
    add(d, '2026-01-07', [ex('Leg_Press', 50, 10)]);
    expect(has(d, 'leg-eddie-500')).toBe(true);
    expect(has(d, 'leg-eddie-ten')).toBe(false);
    add(d, '2026-01-09', [ex('Leg_Press', 100, 10, 10, 10, 10, 10)]);
    expect(has(d, 'leg-eddie-ten')).toBe(true);
    expect(has(d, 'leg-eddie-week')).toBe(false);
    add(d, '2026-01-10', [ex('Leg_Press', 200, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10)]);
    expect(has(d, 'leg-eddie-week')).toBe(true);
  });

  it('Thor: a heavy farmer\'s walk, a heavy short set, a big month', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Farmers_Walk', 30, 45)]);
    expect(has(d, 'leg-thor-carry')).toBe(false);
    add(d, '2026-01-07', [ex('Farmers_Walk', 30, 60)]);
    expect(has(d, 'leg-thor-carry')).toBe(true);
    add(d, '2026-01-08', [ex('Leg_Press', 50, 12)]); // 600 kg, but 12 reps
    expect(has(d, 'leg-thor-501')).toBe(false);
    add(d, '2026-01-09', [ex('Leg_Press', 110, 5)]);
    expect(has(d, 'leg-thor-501')).toBe(true);
    expect(has(d, 'leg-thor-mountain')).toBe(false);
    for (const date of ['2026-01-12', '2026-01-14', '2026-01-16', '2026-01-19', '2026-01-21']) add(d, date, [ex('Leg_Press', 200, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10)]);
    expect(has(d, 'leg-thor-mountain')).toBe(true);
  });

  it('Ronnie: light weight for reps, records in a week', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 11)]);
    expect(has(d, 'leg-ronnie-light')).toBe(false);
    add(d, '2026-01-07', [ex('Leg_Press', 100, 12)]);
    expect(has(d, 'leg-ronnie-light')).toBe(true);
    const ids = ['Leg_Extensions', 'Seated_Leg_Curl', 'Butterfly', 'Face_Pull', 'Machine_Bicep_Curl', 'Wide-Grip_Lat_Pulldown', 'Seated_Cable_Rows', 'Machine_Bench_Press'];
    add(d, '2026-01-09', ids.map((id) => ex(id, 20, 10)));
    add(d, '2026-01-12', ids.slice(0, 7).map((id) => ex(id, 30, 10)));
    expect(has(d, 'leg-ronnie-records')).toBe(false);
    add(d, '2026-01-14', [ex(ids[7], 30, 10)]);
    expect(has(d, 'leg-ronnie-records')).toBe(true);
  });

  it('Arnold: sets in a day, six days in a week, seven Perfect Weeks in a row', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    const twelve = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    add(d, '2026-01-05', [ex('Leg_Press', 50, ...twelve)]);
    expect(has(d, 'leg-arnold-pump')).toBe(false);
    add(d, '2026-01-05', [ex('Butterfly', 30, 10, 10, 10, 10, 10, 10, 10, 10)]); // 20 across two workouts
    expect(has(d, 'leg-arnold-pump')).toBe(true);
    for (const date of ['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']) add(d, date, [ex('Leg_Press', 50, 10)]);
    expect(has(d, 'leg-arnold-split')).toBe(false);
    add(d, '2026-01-10', [ex('Leg_Press', 50, 10)]);
    expect(has(d, 'leg-arnold-split')).toBe(true);
    for (let i = 1; i < 6; i++) add(d, new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), [ex('Leg_Press', 50, 10)]);
    expect(has(d, 'leg-arnold-seven')).toBe(false);
    add(d, '2026-02-16', [ex('Leg_Press', 50, 10)]);
    expect(has(d, 'leg-arnold-seven')).toBe(true);
  });

  it('challenges need real workouts', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 100, 12)], { estimated: true });
    expect(has(d, 'leg-eddie-500')).toBe(false);
    expect(has(d, 'leg-ronnie-light')).toBe(false);
  });
});

describe('imported history', () => {
  const importYears = (d: ReturnType<typeof emptyData>, years: number) => {
    d.profile.weeklyGoal = 3;
    let date = '2015-01-05'; // a Monday
    for (let week = 0; week < years * 52; week++, date = addDays(date, 7)) {
      for (const day of [0, 2, 4]) {
        add(d, addDays(date, day), [ex('Leg_Press', 100, ...TEN_SETS)]);
        d.sessions[d.sessions.length - 1].estimated = true;
      }
    }
    return date;
  };

  it('is a head start, not a shortcut: stars stop at the cap', () => {
    const d = emptyData();
    importYears(d, 10);
    const g = game(d);
    expect(g.totalStars).toBe(RULES.importedStarCap);
    expect(g.level.rank.title).toBe('Gold Lifter');
    expect(g.unlockedIds.has('visits-1000')).toBe(true); // still counts for trophies
    expect(g.streak.best).toBeGreaterThan(500); // and for the streak
    for (const r of g.sessions.values()) expect(r.items.reduce((n, i) => n + i.stars, 0)).toBe(r.stars);
  });

  it('leaves real workouts paying in full after the cap', () => {
    const d = emptyData();
    const after = importYears(d, 3);
    const before = game(d).totalStars;
    const real = add(d, after, [ex('Leg_Press', 110, ...TEN_SETS)]);
    const g = game(d);
    expect(result(g, real).dayStars).toBe(3);
    expect(g.totalStars).toBeGreaterThan(before + 2);
  });
});

describe('big moments', () => {
  it('gives Epic trophies and above and a new rank the full screen, biggest last', () => {
    const d = emptyData();
    const before = game(d);
    add(d, '2026-01-05', [ex('Leg_Press', 200000, 300)]); // 60,000 tonnes in one go
    const moments = bigMoments(before, game(d));
    const kinds = moments.map((m) => m.kind);
    expect(kinds).toContain('Epic trophy');
    expect(kinds).toContain('Legendary trophy');
    expect(kinds[kinds.length - 1]).toBe('New rank');
    expect(kinds.indexOf('Legendary trophy')).toBeGreaterThan(kinds.lastIndexOf('Epic trophy'));
    expect(kinds.indexOf('Mythic trophy')).toBeGreaterThan(kinds.lastIndexOf('Legendary trophy'));
    expect(moments.find((m) => m.id === 'volume-7300000')).toMatchObject({ rarity: 'legendary', stars: RARITY_STARS.legendary });
    expect(moments.find((m) => m.id === 'volume-53000000')).toMatchObject({ rarity: 'mythic', stars: RARITY_STARS.mythic });
  });

  it('stays quiet for common and rare unlocks, and when nothing new happened', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 50, 10)]);
    const before = game(d);
    add(d, '2026-01-07', [ex('Leg_Press', 50, 10)]);
    const after = game(d);
    expect(after.unlocked.filter((a) => !before.unlockedIds.has(a.id)).every((a) => a.rarity === 'common' || a.rarity === 'rare')).toBe(true);
    expect(bigMoments(before, after).filter((m) => m.rarity)).toEqual([]);
    expect(bigMoments(after, after)).toEqual([]);
  });

  it('never celebrates a rank you only dropped into', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 20000, 50)]);
    expect(bigMoments(game(d), game(emptyData())).some((m) => m.kind === 'New rank')).toBe(false);
  });
});

describe('your story', () => {
  it('collects the first workout, ranks and rare trophies, newest first', () => {
    const d = emptyData();
    d.profile.weeklyGoal = 1;
    for (let i = 0; i < 16; i++) add(d, new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), [ex('Leg_Press', 100 + i * 5, ...TEN_SETS)]);
    const events = careerStory(game(d));
    expect(events[events.length - 1]).toMatchObject({ id: 'first', title: 'Your first workout' });
    expect(events.some((e) => e.kind.startsWith('New rank'))).toBe(true); // a big first day can skip early ranks
    expect(events.some((e) => e.rarity === 'rare')).toBe(true);
    expect(events.some((e) => e.rarity === 'common')).toBe(false);
    for (let i = 1; i < events.length; i++) expect(events[i - 1].date >= events[i].date).toBe(true);
    expect(careerStory(game(emptyData()))).toEqual([]);
  });

  it('shows records as old → new', () => {
    expect(fmtPr({ exerciseId: 'x', kind: 'weight', value: 125, prev: 120 })).toBe('120 → 125 kg');
    expect(fmtPr({ exerciseId: 'x', kind: 'hold', value: 70, prev: 60 })).toBe('60 → 70 s');
    expect(fmtPr({ exerciseId: 'x', kind: 'assist', value: 30, prev: 40 })).toBe('40 → 30 kg assist');
    expect(fmtPr({ exerciseId: 'x', kind: 'e1rm', value: 133.3333, prev: 130 })).toBe('Best set yet');
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

  it('applies one-time holidays only on their exact dates', async () => {
    const { holidayOn } = await import('./holidays');
    expect(holidayOn('2026-11-09')).toBe('Visita del Papa');
    expect(holidayOn('2026-11-10')).toBe('Visita del Papa');
    expect(holidayOn('2026-11-11')).toBeUndefined();
    expect(holidayOn('2025-11-09')).toBeUndefined();
    expect(holidayOn('2027-11-10')).toBeUndefined();
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
    expect(toBeatText(walk, [{ kg: 30, reps: 60 }])).toBe('To beat: 30 kg for 61+ s in total, or more weight for 30+ s');
    expect(fmtSet(walk, { kg: 30, reps: 60 })).toBe('30 kg · 60 s');
  });
});

describe('big-session trophies', () => {
  it('Rep Factory counts reps in one workout, and Volume Beast counts its tonnage', () => {
    const d = emptyData();
    const sets = Array.from({ length: 25 }, () => 20);
    add(d, '2026-01-05', [ex('Leg_Press', 10, ...sets.slice(0, 24))]); // 480 reps, 4,800 kg
    expect(game(d).unlockedIds.has('hab-reps')).toBe(false);
    expect(game(d).unlockedIds.has('special-beast')).toBe(false);
    add(d, '2026-01-07', [ex('Leg_Press', 20, ...sets)]); // 500 reps, 10,000 kg
    expect(game(d).unlockedIds.has('hab-reps')).toBe(true);
    expect(game(d).unlockedIds.has('special-beast')).toBe(true);
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

describe('muscle volume', () => {
  const custom = (d: AppData, id: string, group: Exercise['group']) => d.customExercises.push({ id, updatedAt: 1, name: id, group, aliases: [], look: '' });

  it('the catalog only uses the 18 known muscles, and trains every one of them', () => {
    const known = new Set<string>(MUSCLES);
    const primary = new Set<string>();
    for (const e of BUILTIN) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(known.has(m), `${e.id}: ${m}`).toBe(true);
      e.primaryMuscles.forEach((m) => primary.add(m));
    }
    expect(MUSCLES.filter((m) => !primary.has(m))).toEqual([]);
  });

  it('a set counts 1 for a primary muscle and half for a secondary one', () => {
    const exMap = exerciseMap(emptyData());
    const v = volumeOf([{ exerciseId: 'Machine_Bench_Press', sets: 4 }], exMap);
    expect(v.sets.Chest).toBe(4);
    expect(v.sets['Front Delts']).toBe(2);
    expect(v.sets.Triceps).toBe(2);
    expect(v.sets.Quadriceps).toBe(0);
    expect(v.by.Chest).toEqual([{ exerciseId: 'Machine_Bench_Press', sets: 4, share: 1 }]);
    expect(v.by.Triceps[0].share).toBe(0.5);
  });

  it('a planned routine and the workout that follows it measure the same', () => {
    const d = emptyData();
    const routine: Routine = { id: 'r', updatedAt: 1, name: 'Push', exerciseIds: ['Machine_Bench_Press', 'Leg_Press'], items: [{ exerciseId: 'Machine_Bench_Press', sets: 4, reps: '10' }, { exerciseId: 'Leg_Press', sets: 3, reps: '12' }] };
    const done = sess('2026-03-02', [ex('Machine_Bench_Press', 40, 10, 10, 10, 10), ex('Leg_Press', 80, 12, 12, 12)]);
    const exMap = exerciseMap(d);
    expect(volumeOf(sessionEntries(done, exMap), exMap).sets).toEqual(volumeOf(routineEntries(routine), exMap).sets);
    // A routine saved before targets existed counts 3 sets per exercise.
    const old: Routine = { id: 'o', updatedAt: 1, name: 'Old', exerciseIds: ['Machine_Bench_Press'] };
    expect(volumeOf(routineEntries(old), exMap).sets.Chest).toBe(3);
  });

  it('skips empty sets, benchmarks and exercises it cannot find', () => {
    const exMap = exerciseMap(emptyData());
    const s1 = sess('2026-03-02', [ex('Machine_Bench_Press', 40, 10, 0, 10), ex('Hero_Cindy', 0, 12), ex('Gone_Forever', 10, 10)]);
    const v = volumeOf(sessionEntries(s1, exMap), exMap);
    expect(v.sets.Chest).toBe(2);
    expect(Object.values(v.sets).reduce((a, b) => a + b, 0)).toBe(4); // 2 chest + 1 front delts + 1 triceps
    expect(muscleShares(exMap.get('Hero_Cindy'))).toEqual([]);
  });

  it("a custom exercise shares each set across its group's muscles", () => {
    const d = emptyData();
    custom(d, 'my-curl-thing', 'Arms');
    custom(d, 'my-ab-wheel', 'Core');
    const v = volumeOf([{ exerciseId: 'my-curl-thing', sets: 4 }, { exerciseId: 'my-ab-wheel', sets: 3 }], exerciseMap(d));
    expect(v.sets.Biceps).toBe(2);
    expect(v.sets.Triceps).toBe(2);
    expect(v.sets.Abdominals).toBe(3);
  });

  it('counts one Monday-to-Sunday week, ignoring deleted workouts', () => {
    const d = emptyData();
    add(d, '2026-03-01', [ex('Machine_Bench_Press', 40, 10, 10)]); // Sunday of the week before
    add(d, '2026-03-02', [ex('Machine_Bench_Press', 40, 10, 10, 10)]); // Monday
    add(d, '2026-03-08', [ex('Machine_Bench_Press', 40, 10)]); // Sunday
    add(d, '2026-03-04', [ex('Machine_Bench_Press', 40, 10, 10)], { deleted: true });
    add(d, '2026-03-09', [ex('Machine_Bench_Press', 40, 10)]); // next Monday
    expect(weekVolume(d.sessions, exerciseMap(d), '2026-03-05').sets.Chest).toBe(4);
  });

  it('averages the last 4 weeks, without diluting a log that is younger than that', () => {
    const d = emptyData();
    for (const date of ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']) add(d, date, [ex('Machine_Bench_Press', 40, 10, 10, 10, 10, 10, 10, 10, 10)]);
    const exMap = exerciseMap(d);
    const avg = averageVolume(d.sessions, exMap, 4, '2026-03-29');
    expect(avg.sets.Chest).toBe(8); // 32 sets over 4 weeks
    expect(avg.weeks).toBe(4);
    expect(avg.by.Chest[0].sets).toBe(32); // sources are real totals, so they add up
    // Workouts older than the window drop out.
    expect(averageVolume(d.sessions, exMap, 4, '2026-04-12').sets.Chest).toBe(4); // only Mar 16 and 23 are inside
    // Ten days into a new log, the average is over 2 weeks, not 4.
    const fresh = emptyData();
    add(fresh, '2026-03-02', [ex('Machine_Bench_Press', 40, 10, 10, 10, 10)]);
    add(fresh, '2026-03-09', [ex('Machine_Bench_Press', 40, 10, 10, 10, 10)]);
    const young = averageVolume(fresh.sessions, exerciseMap(fresh), 4, '2026-03-11');
    expect(young.sets.Chest).toBe(4);
    expect(young.weeks).toBe(2);
    expect(averageVolume([], exMap, 4, '2026-03-11').sets.Chest).toBe(0);
  });

  it('bands weekly sets: under 4 low, 4–9 building, 10–20 on target, over 20 high', () => {
    expect([0, 0.5, 3.5, 4, 9.5, 10, 20, 20.5].map(bandOf)).toEqual(['none', 'low', 'low', 'building', 'building', 'target', 'target', 'high']);
    expect([7, 7.5, 7.25, 0.5].map(fmtSets)).toEqual(['7', '7.5', '7.5', '0.5']);
    const v = volumeOf([{ exerciseId: 'Machine_Bench_Press', sets: 12 }], exerciseMap(emptyData())).sets;
    expect(weeklyBands(v).Chest).toBe('target');
    expect(weeklyBands(v).Triceps).toBe('building');
    expect(weeklyBands(v).Calves).toBe('none');
  });

  it('shades one workout relative to its most-trained muscle, and ranks muscles by sets', () => {
    const v = volumeOf([{ exerciseId: 'Machine_Bench_Press', sets: 4 }], exerciseMap(emptyData())).sets; // chest 4, front delts 2, triceps 2
    const b = relativeBands(v);
    expect([b.Chest, b['Front Delts'], b.Triceps, b.Lats]).toEqual(['target', 'building', 'building', 'none']);
    expect(Object.values(relativeBands(volumeOf([], new Map()).sets)).every((x) => x === 'none')).toBe(true);
    expect(ranked(v).slice(0, 4)).toEqual(['Chest', 'Front Delts', 'Triceps', 'Traps']); // ties keep head-to-toe order
  });

  it('the body map draws every muscle', () => {
    expect(MUSCLES.filter((m) => !MAPPED.has(m))).toEqual([]);
  });
});

describe('routine check', () => {
  const routine = (id: string, name: string, items: [string, number][]): Routine => ({
    id, name, updatedAt: 1, exerciseIds: items.map(([e]) => e), items: items.map(([exerciseId, sets]) => ({ exerciseId, sets, reps: '10' })),
  });
  const PUSH = routine('push', 'Push', [['Machine_Bench_Press', 4], ['Machine_Shoulder_Military_Press', 3], ['Triceps_Pushdown', 3]]);
  const PULL = routine('pull', 'Pull', [['Wide-Grip_Lat_Pulldown', 4], ['Seated_Cable_Rows', 3], ['Machine_Bicep_Curl', 3]]);
  const LEGS = routine('legs', 'Legs', [['Leg_Extensions', 4], ['Standing_Calf_Raises', 3], ['Cable_Crunch', 3]]);
  const check = (d: AppData, routines: Routine[], weekGoal = 3, extra: { date?: string; limit?: number } = {}) =>
    checkRotation({ data: d, routines, weekGoal, exMap: exerciseMap(d), pickable: allExercises(d), ...extra });

  it('plans weekly sets by cycling through the routines at your weekly goal', () => {
    const d = emptyData();
    expect(planVolume([PUSH, PULL, LEGS], 3, exerciseMap(d)).sets.Chest).toBe(4); // each routine once a week
    expect(planVolume([PUSH, PULL, LEGS], 6, exerciseMap(d)).sets.Chest).toBe(8); // each twice
    expect(planVolume([PUSH, PULL], 3, exerciseMap(d)).sets.Chest).toBe(6);
  });

  it('flags missing muscles first, with an exercise for the routine it fits', () => {
    const f = check(emptyData(), [PUSH, PULL, LEGS]);
    expect(f.map((x) => x.id)).toEqual(['missing:Hamstrings', 'missing:Glutes', 'low:Side Delts']);
    expect(f[0]).toMatchObject({ title: 'No hamstring work', add: { exerciseId: 'Seated_Leg_Curl', routineId: 'legs' } });
    expect(f[1].add).toEqual({ exerciseId: 'Barbell_Hip_Thrust', routineId: 'legs' });
    // The overhead press only half-counts for side delts, and a raise belongs on the push day.
    expect(f[2]).toMatchObject({ title: 'Light on side delts', add: { exerciseId: 'Side_Lateral_Raise', routineId: 'push' } });
    // Abs are light too, and Cable Crunch is already in the plan, so the suggestion is the next one.
    const all = check(emptyData(), [PUSH, PULL, LEGS], 3, { limit: 99 });
    expect(all.find((x) => x.id === 'low:Abdominals')?.add).toEqual({ exerciseId: 'Plank', routineId: 'legs' });
    // A missing hinge starts with the easiest one to learn.
    expect(all.find((x) => x.id === 'pattern:hinge')?.add?.exerciseId).toBe('Hyperextensions_Back_Extensions');
  });

  it('adding the suggestions clears them, and keeps exercise ids in sync', () => {
    const d = emptyData();
    const exMap = exerciseMap(d);
    let legs = LEGS;
    for (const f of check(d, [PUSH, PULL, LEGS]).filter((x) => x.add?.routineId === 'legs')) legs = withExercise(legs, exMap.get(f.add!.exerciseId)!, 5);
    expect(legs.exerciseIds).toEqual(routineItems(legs).map((it) => it.exerciseId));
    expect(legs.exerciseIds).toHaveLength(5);
    expect(legs.updatedAt).toBe(5);
    legs = withExercise(legs, exMap.get('Plank')!, 6);
    expect(routineItems(legs).find((it) => it.exerciseId === 'Plank')).toMatchObject({ sets: 3, reps: '30' }); // a hold
    expect(withExercise(legs, exMap.get('Plank')!)).toBe(legs); // never twice
    const ids = check(d, [PUSH, PULL, legs], 3, { limit: 99 }).map((x) => x.id);
    expect(ids.filter((id) => id.startsWith('missing:'))).toEqual([]);
  });

  it('prefers an exercise you already know', () => {
    const d = emptyData();
    for (const date of ['2026-01-05', '2026-01-12', '2026-01-19']) add(d, date, [ex('Lying_Leg_Curls', 30, 10)]);
    expect(check(d, [PUSH, PULL, LEGS]).find((x) => x.id === 'missing:Hamstrings')?.add?.exerciseId).toBe('Lying_Leg_Curls');
  });

  it('weighs pushing against pulling and quads against hamstrings', () => {
    const d = emptyData();
    const heavyPush = routine('a', 'Upper', [['Machine_Bench_Press', 4], ['Butterfly', 4], ['Machine_Shoulder_Military_Press', 4], ['Wide-Grip_Lat_Pulldown', 3]]);
    const quads = routine('b', 'Lower', [['Leg_Press', 4], ['Leg_Extensions', 4], ['Seated_Leg_Curl', 1]]);
    const f = check(d, [heavyPush, quads], 2, { limit: 99 });
    expect(f.find((x) => x.id === 'balance:push')).toMatchObject({ title: 'More pushing than pulling', add: { exerciseId: 'Seated_Cable_Rows', routineId: 'a' } });
    const legs = f.find((x) => x.id === 'balance:legs');
    expect(legs?.reason).toBe('About 8 sets a week for quads against 1 for hamstrings.'); // the leg press no longer counts for hamstrings
    expect(legs?.add?.routineId).toBe('b');
  });

  it('notices an exercise in a routine you do that has not been logged in 4 weeks', () => {
    const d = emptyData();
    add(d, '2026-03-02', [ex('Machine_Bench_Press', 40, 10, 10, 10, 10), ex('Machine_Shoulder_Military_Press', 30, 10, 10, 10)]);
    add(d, '2026-03-09', [ex('Machine_Bench_Press', 40, 10, 10, 10, 10), ex('Machine_Shoulder_Military_Press', 30, 10, 10, 10)]);
    const f = check(d, [PUSH, PULL, LEGS], 3, { date: '2026-03-11', limit: 99 });
    const stale = f.filter((x) => x.kind === 'stale');
    expect(stale.map((x) => x.id)).toEqual(['stale:push:Triceps_Pushdown']); // Pull and Legs weren't done, so nothing to say
    expect(stale[0].reason).toContain('part of Push');
    expect(stale[0].add).toBeUndefined();
    // A week of history isn't enough to call it.
    expect(check(d, [PUSH, PULL, LEGS], 3, { date: '2026-03-03', limit: 99 }).some((x) => x.kind === 'stale')).toBe(false);
    // Nor is a routine edited since its last workout: whatever was just added hasn't had a chance.
    const edited = { ...PUSH, updatedAt: new Date('2026-03-10T09:00:00').getTime() };
    expect(check(d, [edited, PULL, LEGS], 3, { date: '2026-03-11', limit: 99 }).some((x) => x.kind === 'stale')).toBe(false);
    const editedSameDay = { ...PUSH, updatedAt: new Date('2026-03-09T08:00:00').getTime() }; // before that day's workout ended
    expect(check(d, [editedSameDay, PULL, LEGS], 3, { date: '2026-03-11', limit: 99 }).some((x) => x.kind === 'stale')).toBe(true);
  });

  it('a well-rounded plan has nothing to say, and every finding is unique and at most 3', () => {
    const d = emptyData();
    const full = routine('f', 'Full body', [
      ['Machine_Bench_Press', 4], ['Machine_Shoulder_Military_Press', 4], ['Wide-Grip_Lat_Pulldown', 4], ['Seated_Cable_Rows', 4], ['Leg_Press', 4], ['Romanian_Deadlift', 4],
      ['Dumbbell_Lunges', 2], ['Machine_Bicep_Curl', 4], ['Triceps_Pushdown', 2], ['Side_Lateral_Raise', 4], ['Standing_Calf_Raises', 4], ['Cable_Crunch', 4], ['Farmers_Walk', 2], ['Barbell_Hip_Thrust', 2],
    ]);
    expect(check(d, [full], 1, { limit: 99 })).toEqual([]);
    expect(check(d, [], 3)).toEqual([]);
    const thin = routine('t', 'Just arms', [['Machine_Bicep_Curl', 3]]);
    const f = check(d, [thin], 3);
    expect(f).toHaveLength(3);
    const added = f.map((x) => x.add?.exerciseId).filter(Boolean);
    expect(new Set(added).size).toBe(added.length);
    expect(added).not.toContain('Machine_Bicep_Curl');
  });
});

describe('health review: muscle data', () => {
  const byId = (id: string) => BUILTIN.find((e) => e.id === id)!;
  const share = (id: string, m: string) => Object.fromEntries(muscleShares(byId(id)))[m] ?? 0;

  it('splits shoulders: presses train the front, raises the side, rows and pulls the rear', () => {
    expect(share('Machine_Bench_Press', 'Front Delts')).toBe(0.5);
    expect(share('Machine_Shoulder_Military_Press', 'Front Delts')).toBe(1);
    expect(share('Machine_Shoulder_Military_Press', 'Side Delts')).toBe(0.5);
    expect(share('Side_Lateral_Raise', 'Side Delts')).toBe(1);
    expect(share('Seated_Cable_Rows', 'Rear Delts')).toBe(0.5);
    expect(share('Reverse_Machine_Flyes', 'Rear Delts')).toBe(1);
    expect(share('Wide-Grip_Lat_Pulldown', 'Front Delts')).toBe(0);
    // The two upright rows used to disagree with each other.
    expect(muscleShares(byId('Upright_Cable_Row'))).toEqual(muscleShares(byId('Upright_Barbell_Row')));
    // A custom shoulder exercise can't say which head it trains, so its sets are shared.
    const d = emptyData();
    d.customExercises.push({ id: 'my-shoulder-thing', updatedAt: 1, name: 'x', group: 'Shoulders', aliases: [], look: '' });
    const v = volumeOf([{ exerciseId: 'my-shoulder-thing', sets: 6 }], exerciseMap(d)).sets;
    expect([v['Front Delts'], v['Side Delts'], v['Rear Delts']]).toEqual([2, 2, 2]);
  });

  it('only credits muscles that do real work', () => {
    for (const id of ['Leg_Press', 'Hack_Squat', 'Smith_Machine_Squat', 'Barbell_Squat', 'Bodyweight_Squat', 'Dumbbell_Lunges', 'Barbell_Lunge']) {
      expect(share(id, 'Hamstrings'), id).toBe(0); // squats and leg presses barely train them
      expect(share(id, 'Calves'), id).toBe(0);
    }
    expect(share('Leg_Press', 'Adductors')).toBe(0.5);
    // Calves only count from calf work.
    expect(BUILTIN.filter((e) => [...e.primaryMuscles, ...e.secondaryMuscles].includes('Calves')).every((e) => e.primaryMuscles[0] === 'Calves')).toBe(true);
    // A deadlift is mainly glutes, hamstrings and lower back, not lower back with eight helpers.
    expect(byId('Barbell_Deadlift').primaryMuscles).toEqual(['Glutes', 'Hamstrings', 'Lower Back']);
    for (const e of BUILTIN) expect(e.secondaryMuscles.length, e.id).toBeLessThanOrEqual(4);
    expect(share('Hammer_Curls', 'Forearms')).toBe(0.5);
    expect(muscleShares(byId('Pallof_Press'))).toEqual([['Abdominals', 1]]);
    expect(muscleShares(byId('Thigh_Adductor'))).toEqual([['Adductors', 1]]);
  });

  it('every muscle is either a main one or a smaller one', () => {
    expect(MAJOR_MUSCLES).toHaveLength(13);
    expect([...MAJOR_MUSCLES, ...MINOR_MUSCLES].sort()).toEqual([...MUSCLES].sort());
    expect(MINOR_MUSCLES).toEqual(['Traps', 'Lower Back', 'Forearms', 'Abductors', 'Adductors']);
  });

  it('leaves warm-ups out of the hard sets', () => {
    const set = (kg: number, reps: number) => ({ kg, reps });
    const press = byId('Machine_Bench_Press');
    expect(hardSets(press, [set(20, 12), set(30, 8), set(50, 10), set(50, 9), set(50, 8)])).toBe(4); // 20 kg is under 60% of 50; 30 kg is exactly 60%
    expect(hardSets(press, [set(40, 12), set(45, 10), set(50, 8)])).toBe(3); // a pyramid is all work
    expect(hardSets(press, [set(50, 10), set(0, 0)])).toBe(1);
    // Where the weight column isn't a plain load, every set with reps counts.
    expect(hardSets(byId('Assisted_Pull-Up_Machine'), [set(40, 8), set(10, 5)])).toBe(2);
    expect(hardSets(byId('Pullups'), [set(0, 8), set(10, 5)])).toBe(2);
    expect(hardSets(byId('Plank'), [set(0, 60), set(10, 30)])).toBe(2);
    const d = emptyData();
    const s1 = sess('2026-03-02', [ex('Machine_Bench_Press', 50, 10, 10, 10)]);
    s1.exercises[0].sets.unshift({ kg: 20, reps: 15 });
    expect(volumeOf(sessionEntries(s1, exerciseMap(d)), exerciseMap(d)).sets.Chest).toBe(3);
  });

  it('fixes the dated cues in the instructions', () => {
    const text = (id: string) => byId(id).instructions.join(' ');
    for (const id of ['Upright_Cable_Row', 'Upright_Barbell_Row']) {
      expect(text(id)).not.toContain('chin');
      expect(text(id)).toContain('level with your shoulders');
    }
    for (const id of ['Barbell_Squat', 'Smith_Machine_Squat', 'Hack_Squat']) expect(text(id)).not.toContain('undue stress on the knee');
    for (const e of BUILTIN) {
      expect(e.instructions.join(' '), e.id).not.toMatch(/wrist wraps|foot (stances|positioning) section/);
      expect(e.instructions.every((t) => t.trim().length > 0), e.id).toBe(true);
    }
  });
});

describe('health review: how progress is measured', () => {
  it('estimates a 1RM only from sets it can trust', () => {
    expect(e1rm(100, 1)).toBe(100); // a single is the lift itself
    expect(e1rm(50, 12)).toBe(70);
    expect(e1rm(50, 20)).toBe(70); // long sets count as 12 reps
    expect(e1rm(50, 30)).toBe(70);
    expect(e1rm(60, 8)).toBeCloseTo(76);
    // So a light, long set can no longer out-rank a heavy one as a record.
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 60, 8)]);
    const light = add(d, '2026-01-07', [ex('Leg_Press', 40, 28)]);
    expect(result(game(d), light).prs).toEqual([]);
  });

  it('counts heavier as a beat only with at least half of last time’s reps', () => {
    const press = exerciseMap(emptyData()).get('Machine_Bench_Press');
    const last = [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }, { kg: 40, reps: 10 }];
    const single = compareToLast(press, 'x', [{ kg: 60, reps: 1 }], last);
    expect(single).toMatchObject({ beat: false, kg: 20 });
    expect(fmtBeat(press, single)).toBe('Heavier, too few reps');
    expect(compareToLast(press, 'x', [{ kg: 42.5, reps: 8 }, { kg: 42.5, reps: 7 }], last).beat).toBe(true); // 15 of 30
    expect(compareToLast(press, 'x', [{ kg: 42.5, reps: 8 }, { kg: 42.5, reps: 6 }], last).beat).toBe(false); // 14 of 30
    expect(compareToLast(press, 'x', [{ kg: 40, reps: 11 }, { kg: 40, reps: 10 }, { kg: 40, reps: 10 }], last).beat).toBe(true); // more reps, as before
    expect(toBeatText(press, last)).toBe('To beat: 40 kg for 31+ reps, or go heavier for 15+');
    // Less assistance follows the same rule.
    const assisted = exerciseMap(emptyData()).get('Assisted_Pull-Up_Machine');
    const less = compareToLast(assisted, 'x', [{ kg: 20, reps: 2 }], [{ kg: 30, reps: 8 }, { kg: 30, reps: 8 }]);
    expect(less.beat).toBe(false);
    expect(fmtBeat(assisted, less)).toBe('Less assist, too few reps');
  });

  it('names a workout by its split', () => {
    const exMap = exerciseMap(emptyData());
    const title = (...items: [string, number][]) => sessionTitle(sess('2026-03-02', items.map(([id, n]) => ex(id, 20, ...Array(n).fill(10)))), exMap);
    expect(title(['Machine_Bench_Press', 4], ['Machine_Shoulder_Military_Press', 3], ['Side_Lateral_Raise', 3], ['Triceps_Pushdown', 3])).toBe('Push');
    expect(title(['Wide-Grip_Lat_Pulldown', 4], ['Seated_Cable_Rows', 3], ['Face_Pull', 3], ['Machine_Bicep_Curl', 3])).toBe('Pull');
    expect(title(['Leg_Press', 4], ['Seated_Leg_Curl', 3], ['Standing_Calf_Raises', 3])).toBe('Legs');
    expect(title(['Leg_Press', 4], ['Seated_Leg_Curl', 3], ['Standing_Calf_Raises', 3], ['Cable_Crunch', 3])).toBe('Legs & Core');
    expect(title(['Leg_Press', 4], ['Barbell_Deadlift', 3], ['Romanian_Deadlift', 3])).toBe('Legs'); // a deadlift doesn't make it a back day
    expect(title(['Machine_Bench_Press', 4], ['Seated_Cable_Rows', 4], ['Machine_Bicep_Curl', 2])).toBe('Upper body');
    expect(title(['Machine_Bench_Press', 4], ['Seated_Cable_Rows', 4], ['Leg_Press', 4])).toBe('Full body');
    expect(title(['Machine_Bicep_Curl', 4], ['Triceps_Pushdown', 4], ['Hammer_Curls', 3])).toBe('Arms');
    expect(title(['Side_Lateral_Raise', 4], ['Reverse_Machine_Flyes', 4], ['Machine_Shoulder_Military_Press', 4])).toBe('Shoulders');
    expect(title(['Cable_Crunch', 3], ['Plank', 3])).toBe('Core');
    expect(sessionTitle(sess('2026-03-02', [], { watch: { durationMin: 40 } }), exMap)).toBe('Cardio & conditioning');
    expect(sessionTitle(sess('2026-03-02', []), exMap)).toBe('Gym visit');
  });
});

describe('health review: body and safety', () => {
  const weigh = (d: AppData, date: string, kg: number) => d.weights.push({ id: `w${date}`, updatedAt: 1, date, kg });

  it('reads weight as a trend, and never tracks a goal below a healthy weight', () => {
    expect(trendKg([80, 79])).toBeNull();
    expect(trendKg([82, 80, 79, 78])).toBe(79);
    expect(goalReached([80, 76, 74.5], 75, 175)).toBe(false); // one low reading isn't the goal
    expect(goalReached([80, 76, 74.5, 74, 74], 75, 175)).toBe(true);
    expect(goalReached([60, 64, 66, 66, 66], 65, 175)).toBe(true); // gaining works the same way
    expect(minGoalKg(180)).toBe(60); // BMI 18.5 at 1.80 m is 59.94 kg
    expect(minGoalKg(null)).toBeNull();
    expect(goalAllowed(55, 180)).toBe(false);
    expect(goalAllowed(55, null)).toBe(true); // without a height there's nothing to judge it by
    expect(goalReached([60, 56, 54, 54, 54], 55, 180)).toBe(false);
    expect(bmiApplies(17)).toBe(false);
    expect(bmiApplies(null)).toBe(true);
    expect(whtrOf(84, 175)).toBeCloseTo(0.48);
    expect([0.38, 0.48, 0.52, 0.65].map(whtrLabel)).toEqual(['on the low side', 'in the healthy range', 'above the healthy range', 'well above the healthy range']);
  });

  it('awards Goal Weight on the trend, not on one weigh-in', () => {
    const d = emptyData();
    d.profile.goalWeightKg = 75;
    d.profile.heightCm = 175;
    weigh(d, '2026-01-01', 80);
    weigh(d, '2026-01-08', 76);
    weigh(d, '2026-01-15', 74.5);
    expect(game(d).unlockedIds.has('body-goal')).toBe(false);
    weigh(d, '2026-01-22', 74);
    weigh(d, '2026-01-29', 74);
    expect(game(d).unlockedIds.has('body-goal')).toBe(true);
    const low = emptyData();
    low.profile.goalWeightKg = 55;
    low.profile.heightCm = 180;
    [60, 56, 54, 54, 54].forEach((kg, i) => weigh(low, `2026-02-0${i + 1}`, kg));
    expect(game(low).unlockedIds.has('body-goal')).toBe(false);
  });

  it('judges a hard heart rate by age', () => {
    expect(hardHeartRate(30)).toBe(140);
    expect(hardHeartRate(60)).toBe(125);
    expect(hardHeartRate(null)).toBe(140); // until a birth year is set
    const at = (birthYear: number | null) => {
      const d = emptyData();
      d.profile.birthYear = birthYear;
      add(d, '2026-03-02', [ex('Leg_Press', 50, 10)], { watch: { durationMin: 50, avgHr: 130 } });
      return game(d).unlockedIds.has('hab-heart');
    };
    expect(at(1966)).toBe(true); // 130 bpm is hard work at 60
    expect(at(1996)).toBe(false); // and moderate at 30
    expect(at(null)).toBe(false);
  });

  it('pays no star for training in the heat, though the trophy stays', () => {
    const d = emptyData();
    add(d, '2026-01-05', [ex('Leg_Press', 50, 10)]);
    const hot = add(d, '2026-01-07', [ex('Leg_Press', 50, 10)], { weather: { tempC: 36 } });
    const cold = add(d, '2026-01-09', [ex('Leg_Press', 50, 10)], { weather: { tempC: 2 } });
    const g = game(d);
    expect(result(g, hot).items.some((i) => i.kind === 'surprise')).toBe(false);
    expect(result(g, cold).items.some((i) => i.kind === 'surprise')).toBe(true);
    expect(g.unlockedIds.has('wx-heat')).toBe(true);
  });
});
