import { useEffect, useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { sortSessions } from '../lib/engine';
import { ChallengeRow, GoalList, LevelCard, StreakCard } from '../components/Progression';
import { WorkoutRow } from '../components/WorkoutRow';
import { greeting, logHref, logMode, upNext } from '../lib/today';
import { holidayOn } from '../lib/holidays';
import { activeRoutines, lastDone, upNextRoutine } from '../lib/routines';
import { fmtDate, plural, today } from '../lib/util';
import { Icon } from '../components/Icon';
import { LargeTitle, SectionHead, SyncBadge } from '../components/ui';

interface DraftPeek { date: string; startTime: string; exercises: unknown[] }

export function Home() {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const recent = useMemo(() => sortSessions(data.sessions).reverse().slice(0, 3), [data.sessions]);
  // Routine shortcuts open the gym guide; the one you're due for comes first.
  const routines = useMemo(() => {
    const all = activeRoutines(data);
    const next = upNextRoutine(all, lastDone(data, all));
    return next ? [next, ...all.filter((r) => r !== next)].map((r) => ({ r, next: r === next })) : all.map((r) => ({ r, next: false }));
  }, [data]);
  const trainedToday = data.sessions.some((s) => !s.deleted && s.date === today());
  const feriado = holidayOn(today());
  const closest = useMemo(() => upNext(g).slice(0, 1), [g]);

  // An unfinished workout on this device turns the main button into "Resume".
  const [draft, setDraft] = useState<DraftPeek | null>(null);
  useEffect(() => {
    let live = true;
    getStore().loadDraft<DraftPeek>().then((d) => live && setDraft(d && d.exercises.length ? d : null));
    return () => {
      live = false;
    };
  }, []);

  const name = data.profile.name.split(' ')[0];
  const mode = logMode(); // how you last logged: live at the gym, or afterwards
  const after = mode === 'after' && !draft;

  return (
    <div className="stack-lg fade-in">
      <LargeTitle
        eyebrow={`${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'short' })}${name ? ` · ${greeting()}` : ''}`}
        title={name ? `Hey, ${name}` : greeting()}
        actions={
          <>
            <SyncBadge label={false} />
            <a className="icon-btn" href="#/settings" aria-label="Settings"><Icon name="gear" size={19} /></a>
          </>
        }
      />

      <StreakCard g={g} sessions={data.sessions} />

      <div className="stack" style={{ gap: 10 }}>
        {feriado && !trainedToday && (
          <div className="banner">🧉 <span><b>{feriado}</b>: train today for a bonus star</span></div>
        )}
        <a href={draft ? '#/log' : logHref(mode)} className="cta">
          <span className="cta-ico"><Icon name={draft ? 'play' : after ? 'pencil' : 'dumbbell'} size={24} stroke={2.4} fill={!!draft} /></span>
          <span className="grow">
            <div className="t">{draft ? 'Resume workout' : after ? (trainedToday ? 'Log another workout' : 'Log today’s workout') : trainedToday ? 'Start another workout' : 'Start workout'}</div>
            <div className="s">
              {draft
                ? `${plural(draft.exercises.length, 'exercise')}${draft.startTime ? ` · started ${draft.startTime}` : ''}`
                : after ? 'Fill it in after the gym, no phone needed there'
                : trainedToday ? 'A second workout can still earn a missing star' : 'Beat your last time for all 3 stars'}
            </div>
          </span>
          <Icon name="chevR" size={20} stroke={2.6} />
        </a>
        {!draft && (
          <div className="chips">
            <a className="chip" href={logHref(after ? 'live' : 'after')} style={{ color: 'var(--text-2)' }}>
              <Icon name={after ? 'clock' : 'history'} size={14} /> {after ? 'Start live instead' : 'Log it afterwards'}
            </a>
            {routines.map(({ r, next }) => (
              <a key={r.id} className={`chip${next ? ' accent' : ''}`} href={`#/routines/${r.id}`}>
                <Icon name="list" size={14} /> {next ? `Up next: ${r.name}` : r.name}
              </a>
            ))}
          </div>
        )}
      </div>

      <LevelCard g={g} href="#/awards" />

      {g.challenge && <ChallengeRow c={g.challenge} />}

      {closest.length > 0 && (
        <div className="stack">
          <SectionHead title="Closest" link="#/awards" linkLabel="Career" />
          <GoalList goals={closest} />
        </div>
      )}

      <div className="stack">
        <SectionHead title="Recent" link={recent.length ? '#/progress' : undefined} linkLabel="History" />
        {recent.length === 0 ? (
          <div className="card stack" style={{ alignItems: 'flex-start' }}>
            <div className="bold">No workouts yet</div>
            <div className="small dim">Your first workout earns all 3 stars. Already training?</div>
            <a className="btn sm tint" href="#/import"><Icon name="download" size={16} /> Import past workouts</a>
          </div>
        ) : (
          <div className="group">
            {recent.map((s) => <WorkoutRow key={s.id} s={s} r={g.sessions.get(s.id)} exMap={exMap} />)}
          </div>
        )}
      </div>
    </div>
  );
}
