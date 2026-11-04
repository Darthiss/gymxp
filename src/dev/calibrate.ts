// Checks the star rules against a real log before they're trusted (see docs/GAME_DESIGN.md).
// Run it on a backup from Settings → Export: npm run calibrate -- path/to/backup.json
import { computeGame, medalOf, MEDALS } from '../lib/engine';
import { exerciseMap } from '../lib/exercises';
import { normalizeData } from '../lib/merge';
import { addDays, parseDate, weekKey } from '../lib/util';

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const weeksBetween = (a: string, b: string) => (parseDate(b).getTime() - parseDate(a).getTime()) / (7 * 86400000);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function calibrationReport(raw: unknown): string {
  const data = normalizeData(raw);
  const g = computeGame(data, exerciseMap(data));
  const live = data.sessions.filter((s) => !s.deleted);
  if (!live.length) return 'No workouts in this file.';

  const real = new Set(live.filter((s) => !s.estimated).map((s) => s.id));
  const results = [...g.sessions.values()];
  const realResults = results.filter((r) => real.has(r.id));
  // One row per gym day: its last workout carries the day's final rating.
  const days = new Map<string, (typeof results)[number]>();
  for (const r of realResults) days.set(r.date, r);
  const rated = [...days.values()].filter((r) => !r.firstEver);
  const count = (n: number) => rated.filter((r) => r.dayStars === n).length;
  const threeStar = pct(count(3), rated.length);
  const missedWork = pct(rated.filter((r) => !r.checks.work).length, rated.length);
  const beats = realResults.flatMap((r) => r.beats.filter((b) => !b.first));

  const first = results[0].date;
  const last = results[results.length - 1].date;
  const weeks = Math.max(1, Math.ceil(weeksBetween(weekKey(first), addDays(weekKey(last), 7))));

  const ups = results.filter((r) => Math.floor(Math.sqrt(r.starsAfter + 1)) > Math.floor(Math.sqrt(r.starsBefore + 1))).map((r) => r.date);
  const gaps = ups.slice(1).map((d, i) => weeksBetween(ups[i], d));
  const recentGaps = gaps.slice(-6);
  const medals = MEDALS.map((m, i) => `${m.icon} ${[...g.bests.values()].filter((b) => medalOf(b.points).tier === i).length}`).join('  ');

  const verdict = (ok: boolean) => (ok ? 'OK  ' : 'LOOK');
  const enough = rated.length >= 8;
  // 40-60 is a long-run rate. Most exercises still improve every session in the first months.
  const tooSoon = weeks < 26 || rated.length < 30;

  return [
    `${live.length} workouts over ${weeks} weeks (${live.length - real.size} imported from memory, left out of the rates below)`,
    '',
    `Level ${g.level.level} ${g.level.rank.title} · ${g.totalStars} stars · ${(g.totalStars / weeks).toFixed(1)} stars a week`,
    `Streak ${g.streak.weeks} weeks · best ${g.streak.best} · ${g.streak.shields} shields · Perfect Weeks ${g.perfectWeeks} (${pct(g.perfectWeeks, weeks)}% of weeks)`,
    `Workout ratings: 3 stars ${threeStar}% · 2 stars ${pct(count(2), rated.length)}% · 1 star ${pct(count(1), rated.length)}% (${rated.length} gym days)`,
    `Exercises beaten: ${pct(beats.filter((b) => b.beat).length, beats.length)}% · records in ${pct(realResults.filter((r) => r.prs.length).length, realResults.length)}% of workouts`,
    `Machine medals: ${medals}`,
    '',
    enough ? 'Against the targets in docs/GAME_DESIGN.md:' : `Only ${rated.length} rated gym days, so treat these as rough:`,
    tooSoon
      ? `WAIT 3-star workouts ${threeStar}% so far. The first months run high (about 70% for a simulated new lifter), so judge this after 6 months and 30 gym days. The long-run target is 40-60.`
      : `${verdict(threeStar >= 40 && threeStar <= 60)} 3-star workouts ${threeStar}% (target 40-60). If off, adjust beatsNeeded() in engine.ts.`,
    `${verdict(missedWork < 15)} Workouts missing the second star ${missedWork}% (target under 15). If off, adjust RULES.workSets.`,
    gaps.length
      ? `${verdict(median(recentGaps) >= 1 && Math.max(...recentGaps) <= 8)} Weeks between recent level-ups: median ${median(recentGaps).toFixed(1)}, longest ${Math.max(...recentGaps).toFixed(1)} (target 1-8). If off, adjust starsForLevel().`
      : 'LOOK Not enough level-ups yet to judge the pace.',
  ].join('\n');
}
