// View-model helpers for the Today screen: the streak message, the closest goal, the Mon–Sun
// strip, and human titles for workouts.
import { nextVisitMilestone, perfectWeekStars, RULES, SEASON_TIERS, seasonTarget, starsForLevel, type GameState } from './engine';
import { ACHIEVEMENTS, type AchievementCategory } from './trophies';
import { addDays, fmtDate, fmtNum, parseDate, plural, today, weekKey } from './util';
import type { Exercise, Session } from './types';
import { familyOf } from './muscles';

export interface Goal {
  id: string;
  icon: string;
  title: string;
  sub: string;
  pct: number;
  stars?: number;
  href: string;
  color?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Trophy progress in its natural unit: tonnes for volume, hours for time. */
export const fmtProgress = (cat: AchievementCategory, v: number) =>
  cat === 'Volume' ? `${fmtNum(v / 1000, 1)} t` : cat === 'Time' ? `${fmtNum(v / 60, 1)} h` : cat === 'Stronger' ? `${fmtNum(v)}%` : cat === 'Medals' ? `${fmtNum(v)} pts` : fmtNum(v);

/** Season medal progress, shared by the Today goal and the Career season card. */
export function seasonProgress(s: GameState['season']) {
  const next = SEASON_TIERS[s.tier + 1];
  const target = next ? seasonTarget(next, s) : 0;
  const from = s.tier >= 0 ? seasonTarget(SEASON_TIERS[s.tier], s) : 0;
  return { next, target, pct: next ? clamp01((s.perfect - from) / (target - from || 1)) : 1 };
}

/** Every long-term unlock you're working toward, closest first. */
export function upNext(g: GameState): Goal[] {
  const out: Goal[] = [];
  const L = g.level;

  if (L.nextRank) {
    const from = starsForLevel(L.rank.minLevel), to = starsForLevel(L.nextRank.minLevel);
    out.push({
      id: 'rank', icon: '🎖️', color: L.nextRank.color, title: L.nextRank.title,
      sub: `Next rank, at level ${L.nextRank.minLevel}`, pct: (g.totalStars - from) / (to - from), href: '#/awards',
    });
  }

  const ms = nextVisitMilestone(g.visits);
  if (ms?.target) {
    const prev = [...g.unlocked].reverse().find((a) => a.category === 'Visits')?.target ?? 0;
    out.push({ id: ms.id, icon: ms.icon, title: ms.title, sub: `${fmtNum(g.visits)} of ${fmtNum(ms.target)} gym visits`, pct: (g.visits - prev) / (ms.target - prev), stars: ms.stars, href: '#/awards?tab=achievements' });
  }

  const sp = seasonProgress(g.season);
  if (sp.next) {
    out.push({
      id: 'season', icon: sp.next.icon, color: sp.next.color, title: `${sp.next.name} · ${g.season.label} season`,
      sub: `${g.season.perfect} of ${sp.target} Perfect Weeks · ends ${fmtDate(g.season.end, { day: 'numeric', month: 'short' })}`,
      pct: sp.pct, stars: RULES.seasonMedalStars, href: '#/awards',
    });
  }

  // Locked trophies worth chasing that are already in motion (visit milestones are covered above).
  ACHIEVEMENTS.filter((a) => a.target && a.rarity !== 'common' && a.category !== 'Visits' && !g.unlockedIds.has(a.id) && (g.progress[a.id] ?? 0) > 0)
    .map((a) => ({ a, pct: (g.progress[a.id] ?? 0) / a.target! }))
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3)
    .forEach(({ a, pct }) => {
      const prog = `${fmtProgress(a.category, g.progress[a.id] ?? 0)} of ${fmtProgress(a.category, a.target!)}`;
      out.push({ id: a.id, icon: a.icon, title: a.title, sub: `${prog} · ${a.desc}`, pct, stars: a.stars, href: '#/awards?tab=achievements' });
    });

  return out.map((x) => ({ ...x, pct: clamp01(x.pct) })).sort((a, b) => b.pct - a.pct);
}

/** The line under the week strip: what this week still needs, stated calmly. */
export function weekMessage(g: GameState, date = today()): { text: string; tone: 'calm' | 'risk' | 'done' } {
  const { thisWeekVisits: visits, weekGoal: goal, streak } = g;
  if (g.perfectThisWeek) return { text: 'Perfect Week. Nice work.', tone: 'done' };
  const dow = (parseDate(date).getDay() + 6) % 7; // Mon = 0
  if (visits === 0 && streak.weeks > 0 && dow >= 3) {
    return {
      text: streak.shields > 0
        ? `Train by Sunday to keep your ${plural(streak.weeks, 'week')} going. A shield covers you if not.`
        : `Train by Sunday to keep your ${streak.weeks}-week streak.`,
      tone: 'risk',
    };
  }
  const left = goal - visits;
  const streakThen = visits > 0 ? streak.weeks : streak.weeks + 1;
  const pay = perfectWeekStars(goal, streakThen);
  return { text: `${left === 1 ? 'One more' : `${left} more`} for a Perfect Week +${pay}★`, tone: 'calm' };
}

/** A gentle note when a streak ended recently. Never blames anyone. */
export function streakNote(g: GameState, date = today()): string | null {
  const b = g.streak.lastBreak;
  if (!b || b.weeks < 2 || addDays(b.week, 21) < weekKey(date)) return null;
  return `Your streak ended at ${b.weeks} weeks. Your best is still ${g.streak.best}.`;
}

export interface WeekDay { date: string; letter: string; on: boolean; today: boolean; future: boolean }

/** Monday→Sunday of the current week, marking days with a workout. */
export function weekDays(sessions: Session[]): WeekDay[] {
  const t = today();
  const mon = weekKey(t);
  const trained = new Set(sessions.filter((s) => !s.deleted).map((s) => s.date));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mon, i);
    return { date, letter: 'MTWTFSS'[i], on: trained.has(date), today: date === t, future: date > t };
  });
}

/** What kind of workout it was, the way lifters name them: "Push", "Pull", "Legs", "Upper body",
 *  "Full body", "Arms"… judged by where the sets went, with "& Core" when core is a real share. */
export function sessionTitle(s: Session, exMap: Map<string, Exercise>): string {
  const n = { push: 0, pull: 0, legs: 0, core: 0 };
  let arms = 0, shoulders = 0, benchmark = 0;
  for (const e of s.exercises) {
    const ex = exMap.get(e.exerciseId);
    const sets = e.sets.filter((x) => x.reps > 0).length || e.sets.length;
    if (ex?.benchmark) { benchmark += sets; continue; }
    const fam = familyOf(ex);
    if (!ex || !fam) continue;
    n[fam] += sets;
    if (ex.group === 'Arms' && !ex.pattern) arms += sets; // curls and triceps work, not dips or presses
    if (ex.group === 'Shoulders') shoulders += sets;
  }
  const lifting = n.push + n.pull + n.legs;
  if (!lifting) return n.core ? 'Core' : benchmark ? 'Hero benchmark' : s.watch ? 'Cardio & conditioning' : 'Gym visit';
  const upper = n.push + n.pull;
  const title = n.legs >= 0.7 * lifting ? 'Legs'
    : n.legs > 0.15 * lifting ? 'Full body'
    : arms >= 0.6 * lifting ? 'Arms'
    : shoulders >= 0.6 * lifting ? 'Shoulders'
    : n.push >= 0.7 * upper ? 'Push'
    : n.pull >= 0.7 * upper ? 'Pull'
    : 'Upper body';
  return title !== 'Full body' && n.core >= 0.2 * (lifting + n.core) ? `${title} & Core` : title;
}

export interface BroLine { text: string; mood: 'happy' | 'hype' | 'wink' | 'focus' | 'sleep' }

/** What Bro says at the top of Today. Calm and on your side: it never guilts, and it never asks for
 *  more than the week needs (rest days cost nothing, so Bro is happy to see you take them). */
export function broSays(g: GameState, o: { trainedToday: boolean; draft: boolean }, date = today()): BroLine {
  const weeks = g.streak.weeks;
  if (o.draft) return { text: 'Your workout is still open. Pick it up whenever you’re ready.', mood: 'focus' };
  if (g.visits === 0) return { text: 'I’m Bro. Your first workout earns all 3 stars, and I’ll spot you.', mood: 'wink' };
  if (o.trainedToday) return { text: g.perfectThisWeek ? 'Perfect Week, done. Enjoy the rest, you earned it.' : 'Good work today. Rest counts too.', mood: 'hype' };
  if (g.perfectThisWeek) return { text: 'Perfect Week already. Take the rest, you earned it.', mood: 'happy' };
  if (weeks >= 2) {
    return g.thisWeekVisits > 0
      ? { text: `${weeks} weeks in a row. Solid.`, mood: 'happy' }
      : { text: `${weeks} weeks in a row. One visit this week keeps it rolling.`, mood: 'focus' };
  }
  const lines = ['Ready when you are.', 'Show up, do the work, beat last time. That’s the whole game.', 'One lift better than last time is a win.'];
  return { text: lines[parseDate(date).getDate() % lines.length], mood: 'happy' };
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

// How you like to log: live at the gym, or afterwards from memory. Remembered per device
// (not sensitive, so plain localStorage) and used by the Start buttons.
export type LogMode = 'live' | 'after';
const LOG_MODE_KEY = 'gymxp:logmode';

export function logMode(): LogMode {
  try {
    return localStorage.getItem(LOG_MODE_KEY) === 'after' ? 'after' : 'live';
  } catch {
    return 'live';
  }
}

export function setLogMode(m: LogMode) {
  try {
    localStorage.setItem(LOG_MODE_KEY, m);
  } catch { /* ignore */ }
}

/** Link that opens the logger in your preferred mode (extra query params optional). */
export function logHref(mode: LogMode = logMode(), extra = ''): string {
  const q = [mode === 'after' ? 'after=1' : '', extra].filter(Boolean).join('&');
  return `#/log${q ? `?${q}` : ''}`;
}
