import type { Session, Exercise } from '../lib/types';
import type { SessionResult } from '../lib/xp';
import { sessionTitle } from '../lib/today';
import { fmtDate, fmtKg, fmtNum, parseDate, plural } from '../lib/util';

/** Calendar-tile row for a workout: date, auto title, key numbers and XP earned. */
export function WorkoutRow({ s, r, exMap }: { s: Session; r?: SessionResult; exMap: Map<string, Exercise> }) {
  const d = parseDate(s.date);
  const parts = [
    s.exercises.length ? plural(s.exercises.length, 'exercise') : null,
    r?.volume ? fmtKg(r.volume) : null,
    s.watch?.durationMin ? `${Math.round(s.watch.durationMin)} min` : null,
  ].filter(Boolean);
  return (
    <a className="cell" href={`#/session/${s.id}`} style={{ '--inset': '74px' } as React.CSSProperties}>
      <div className="date-tile" aria-label={fmtDate(s.date)}>
        <span className="wd">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
        <span className="dd">{d.getDate()}</span>
      </div>
      <div className="grow">
        <div className="cell-title ellipsis">
          {sessionTitle(s, exMap)}
          {r && r.prs.length > 0 && <span className="tag gold" style={{ marginLeft: 8 }}>🏆 {r.prs.length}</span>}
          {s.estimated && <span className="tag" style={{ marginLeft: 8 }}>≈</span>}
        </div>
        <div className="cell-sub ellipsis">{parts.join(' · ') || 'Visit only'}</div>
      </div>
      <span className="xp-pill">+{fmtNum(r?.xp ?? 0)}</span>
    </a>
  );
}
