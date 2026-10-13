// View-model helpers for the Today screen: one ranked "Up next" feed that merges every
// long-term progression loop, the Mon–Sun strip, and human titles for workouts.
import { ACHIEVEMENTS, DIVISIONS, SEASON_TIERS, nextVisitMilestone, type AchievementCategory, type GameState } from './xp';
import { addDays, fmtDate, fmtNum, today, weekKey } from './util';
import type { Exercise, Session } from './types';

export interface Goal {
  id: string;
  icon: string;
  title: string;
  sub: string;
  pct: number;
  xp?: number;
  href: string;
  color?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Achievement progress in its natural unit: tonnes for volume, hours for time. */
export const fmtProgress = (cat: AchievementCategory, v: number) =>
  cat === 'Volume' ? `${fmtNum(v / 1000, 1)} t` : cat === 'Time' ? `${fmtNum(v / 60, 1)} h` : fmtNum(v);

/** Season tier progress, shared by the Today feed and the Career season card. */
export function seasonProgress(s: GameState['season']) {
  const nextIdx = s.tier + 1;
  const next = SEASON_TIERS[nextIdx];
  const champion = next?.name === 'Champion';
  const from = s.tier >= 0 ? s.targets[s.tier] : 0;
  const pct = !next ? 1 : champion ? s.goalWeeks / s.weeks : (s.visits - from) / (s.targets[nextIdx] - from);
  return { next, champion, pct: clamp01(pct), target: next ? s.targets[nextIdx] : 0 };
}

/** Every long-term unlock you're working toward, closest first. */
export function upNext(g: GameState): Goal[] {
  const out: Goal[] = [];
  const L = g.level;

  if (L.nextRank) {
    const rankUp = L.division === DIVISIONS;
    out.push({
      id: 'star', icon: rankUp ? '🎖️' : '⭐', color: L.rank.color,
      title: rankUp ? `Rank up to ${L.nextRank.title}` : `${L.rank.title} star ${L.division + 1}`,
      sub: `${L.rp}/100 rank points · ${L.limiter === 'visits' ? 'gym visits set the pace' : 'XP sets the pace'}`,
      pct: L.rp / 100, href: '#/awards',
    });
  }

  const ms = nextVisitMilestone(g.visits);
  if (ms?.target) {
    const prev = [...g.unlocked].reverse().find((a) => a.category === 'Visits')?.target ?? 0;
    out.push({ id: ms.id, icon: ms.icon, title: ms.title, sub: `${fmtNum(g.visits)} of ${fmtNum(ms.target)} gym visits`, pct: (g.visits - prev) / (ms.target - prev), xp: ms.xp, href: '#/awards?tab=achievements' });
  }

  const sp = seasonProgress(g.season);
  if (sp.next) {
    out.push({
      id: 'season', icon: sp.next.icon, color: sp.next.color, title: `${sp.next.name} · ${g.season.label} season`,
      sub: sp.champion ? `Weekly goal every week (${g.season.goalWeeks}/${g.season.weeks})` : `${g.season.visits} of ${sp.target} visits · ends ${fmtDate(g.season.end, { day: 'numeric', month: 'short' })}`,
      pct: sp.pct, xp: sp.next.xp, href: '#/awards',
    });
  }

  // Locked achievements already in motion (visit milestones are covered above).
  ACHIEVEMENTS.filter((a) => a.target && a.category !== 'Visits' && !g.unlockedIds.has(a.id) && (g.progress[a.id] ?? 0) > 0)
    .map((a) => ({ a, pct: (g.progress[a.id] ?? 0) / a.target! }))
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3)
    .forEach(({ a, pct }) => {
      const prog = `${fmtProgress(a.category, g.progress[a.id] ?? 0)} of ${fmtProgress(a.category, a.target!)}`;
      // "500 Sets" already says what to do; "Limit Breaker" needs the description.
      const selfExplained = a.title.includes(fmtNum(a.target!)) || a.title.includes(String(a.target));
      out.push({ id: a.id, icon: a.icon, title: a.title, sub: selfExplained ? prog : `${prog} · ${a.desc}`, pct, xp: a.xp, href: '#/awards?tab=achievements' });
    });

  return out.map((x) => ({ ...x, pct: clamp01(x.pct) })).sort((a, b) => b.pct - a.pct);
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

/** "Chest & Arms", "Legs", "Full body"… from the muscle groups with the most sets. */
export function sessionTitle(s: Session, exMap: Map<string, Exercise>): string {
  const sets = new Map<string, number>();
  for (const e of s.exercises) {
    const ex = exMap.get(e.exerciseId);
    const g = ex?.benchmark ? 'Hero benchmark' : ex?.group ?? 'Other';
    sets.set(g, (sets.get(g) ?? 0) + e.sets.length);
  }
  const groups = [...sets.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  if (!groups.length) return s.watch ? 'Cardio & conditioning' : 'Gym visit';
  if (groups.length >= 4) return 'Full body';
  if (groups.length === 1) return groups[0];
  return `${groups.slice(0, -1).join(', ')} & ${groups[groups.length - 1]}`;
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
