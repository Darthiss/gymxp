// Progress → Muscles: weekly sets per muscle on a body map, the same numbers as two lists, and a
// sheet per muscle with the exercises behind its sets.
import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { useExerciseMap } from '../lib/game';
import { averageVolume, bandLabel, BANDS, fmtSets, MAJOR_MUSCLES, MINOR_MUSCLES, MUSCLES, ranked, WARMUP_SHARE, weeklyBands, weekVolume, type Band, type Muscle, type MuscleVolume } from '../lib/muscles';
import { DISCLAIMER_SHORT } from '../lib/body';
import { navigate, type Route } from '../lib/router';
import { BodyMap } from '../components/BodyMap';
import { Cell, Empty, ExerciseThumb, Segmented, SectionHead, Sheet } from '../components/ui';
import type { CSSProperties } from 'react';
import type { Exercise } from '../lib/types';
import { plural } from '../lib/util';

type Span = 'avg' | 'week';

export function Muscles({ route }: { route: Route }) {
  const data = useData();
  const exMap = useExerciseMap();
  const span: Span = route.query.get('span') === 'week' ? 'week' : 'avg';
  const [pick, setPick] = useState<Muscle | null>(null);
  const vol = useMemo(() => (span === 'week' ? weekVolume(data.sessions, exMap) : averageVolume(data.sessions, exMap)), [data.sessions, exMap, span]);
  const bands = useMemo(() => weeklyBands(vol.sets), [vol]);
  const order = useMemo(() => ranked(vol.sets, MAJOR_MUSCLES), [vol]); // the lists and the summary are about the main muscles
  const minor = useMemo(() => ranked(vol.sets, MINOR_MUSCLES), [vol]);

  if (!data.sessions.some((s) => !s.deleted)) return <Empty title="No workouts yet">Log a workout and this shows which muscles it trained, set by set.</Empty>;

  const n = (...b: Band[]) => MAJOR_MUSCLES.filter((m) => b.includes(bands[m])).length;
  const summary = `Of ${MAJOR_MUSCLES.length} main muscles: ${[`${n('target', 'high')} at 10+ sets`, `${n('building')} building`, `${n('low', 'none')} under 4`].join(' · ')}`;
  const half = Math.ceil(order.length / 2);
  const row = (m: Muscle) => {
    const top = vol.by[m][0];
    return (
      <Cell key={m} onClick={() => setPick(m)} inset={44}
        icon={<span className={`bm-swatch band-${bands[m]}`} />}
        title={m}
        sub={top ? `${bandLabel(bands[m])} · mostly ${exMap.get(top.exerciseId)?.name ?? 'Unknown'}` : bandLabel(bands[m])}
        value={<span className="num">{fmtSets(vol.sets[m])} sets</span>} />
    );
  };

  return (
    <div className="stack-lg">
      <Segmented<Span> value={span} options={[['avg', '4-week average'], ['week', 'This week']]} onChange={(s) => navigate(`progress?tab=muscles${s === 'week' ? '&span=week' : ''}`, true)} />

      <div className="card stack" style={{ gap: 16 }}>
        <div>
          <h3>Hard sets per muscle</h3>
          <div className="tiny dim">{span === 'avg' ? 'An average week, over the last 4 weeks' : 'This week so far'}. {summary}</div>
        </div>
        <BodyMap bands={bands} selected={pick} onPick={setPick} width={150}
          label={`Hard sets per muscle, ${span === 'avg' ? 'average week' : 'this week'}: ${ranked(vol.sets, MUSCLES).map((m) => `${m} ${fmtSets(vol.sets[m])}`).join(', ')}`} />
        <div className="bm-legend" aria-hidden="true">
          {BANDS.map((b) => <span key={b.id}><i className={`bm-swatch band-${b.id}`} />{b.label} <small>{b.range}</small></span>)}
        </div>
      </div>

      <div className="stack">
        <SectionHead title="Most trained" />
        <div className="group">{order.slice(0, half).map(row)}</div>
      </div>
      <div className="stack">
        <SectionHead title="Least trained" />
        <div className="group">{order.slice(half).reverse().map(row)}</div>
      </div>

      <div className="stack">
        <SectionHead title="Smaller muscles" />
        <p className="small dim" style={{ padding: '0 4px', marginTop: -6 }}>Big lifts usually cover these, so a low number here isn't a gap.</p>
        <div className="group">{minor.map(row)}</div>
      </div>

      <p className="tiny muted" style={{ padding: '0 4px', lineHeight: 1.5 }}>
        Only hard sets count: a warm-up, meaning a set under {Math.round(WARMUP_SHARE * 100)}% of your heaviest weight on that exercise that day, is left out. A set counts in full for the muscle an exercise mainly trains, and half for the muscles that help. 10–20 hard sets a week is the range commonly recommended for muscle growth; fewer still builds, more slowly. {DISCLAIMER_SHORT}
      </p>

      {pick && <MuscleSheet muscle={pick} vol={vol} band={bands[pick]} span={span} exMap={exMap} onClose={() => setPick(null)} />}
    </div>
  );
}

const NOTE: Record<Band, string> = {
  none: 'No sets in this period.',
  low: 'Under 4 sets a week.',
  building: 'Between 4 and 9 sets a week.',
  target: 'In the 10–20 hard sets a week commonly recommended for muscle growth.',
  high: 'Over 20 sets a week. That’s plenty.',
};
const SCALE_MAX = 25;

function MuscleSheet({ muscle, vol, band, span, exMap, onClose }: {
  muscle: Muscle;
  vol: MuscleVolume;
  band: Band;
  span: Span;
  exMap: Map<string, Exercise>;
  onClose: () => void;
}) {
  const sets = vol.sets[muscle];
  const sources = vol.by[muscle];
  const period = span === 'week' ? 'this week' : `in the last ${plural(vol.weeks, 'week')}`;
  const total = sources.reduce((n, s) => n + s.sets, 0);
  return (
    <Sheet title={muscle} onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="display" style={{ fontSize: '2.6rem' }}>{fmtSets(sets)}</span>
            <span className="dim">{span === 'avg' ? 'hard sets in an average week' : 'hard sets this week'}</span>
            <span className="tag"><i className={`bm-swatch band-${band}`} style={{ width: 8, height: 8 }} />{bandLabel(band)}</span>
          </div>
          <div aria-hidden="true">
            <div className="band-scale">
              {(['low', 'building', 'target', 'high'] as Band[]).map((b) => <i key={b} className={`band-${b}`} />)}
              <span className="mark" style={{ left: `${(Math.min(sets, SCALE_MAX) / SCALE_MAX) * 100}%` }} />
            </div>
            <div className="band-ticks">
              {[0, 4, 10, 20].map((t) => <span key={t} style={{ left: `${(t / SCALE_MAX) * 100}%` } as CSSProperties}>{t}</span>)}
            </div>
          </div>
          <p className="small dim">{NOTE[band]}{span === 'avg' && total > 0 ? ` ${fmtSets(total)} sets in total ${period}.` : ''}</p>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title">Where it comes from · {period}</div>
          {sources.length ? (
            <div className="group">
              {sources.map((s) => {
                const ex = exMap.get(s.exerciseId);
                return (
                  <Cell key={s.exerciseId} href={`#/lift/${encodeURIComponent(s.exerciseId)}`} inset={68}
                    icon={<ExerciseThumb ex={ex} className="thumb sm" />}
                    title={ex?.name ?? 'Unknown'}
                    sub={s.share === 1 ? 'Main muscle' : 'Helps · counts half'}
                    value={<span className="num">{fmtSets(s.sets)} sets</span>} />
                );
              })}
            </div>
          ) : (
            <div className="notice small">Nothing logged for {muscle.toLowerCase()} {period}.</div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
