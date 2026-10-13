import type { CSSProperties } from 'react';
import { useGame } from '../lib/game';
import { HERO_STAGES, HERO_TARGETS } from '../lib/hero';
import { fmtDate } from '../lib/util';
import { PageHead, Ring, XpBar } from '../components/ui';
import { Icon } from '../components/Icon';

const SOURCES = [
  { label: "Men's Health AU: Tom Holland's 'monster' workout", url: 'https://menshealth.com.au/tom-holland-monster-workout/' },
  { label: 'Generation Iron: How Tom Holland bulked up', url: 'https://generationiron.com/how-tom-holland-bulked-up-spider-man/' },
  { label: 'Fitbook: The brutal bodyweight training of Tom Holland', url: 'https://www.fitbook-magazine.com/fitness/the-brutal-bodyweight-training-of-spider-man-star-tom-holland' },
];

export function Hero() {
  const g = useGame();
  const h = g.hero;
  const unlocked = new Map(g.unlocked.map((a) => [a.id, a]));
  const stageIdx = HERO_STAGES.indexOf(h.stage);
  const toNext = h.next ? (h.pct - h.stage.min) / (h.next.min - h.stage.min) : 1;

  return (
    <div className="stack-lg">
      <PageHead title="Hero Physique" backTo="awards" />

      <div className="card glow stack" style={{ '--glow': 'var(--accent)', alignItems: 'center', textAlign: 'center', gap: 14, padding: '24px 16px' } as CSSProperties}>
        <Ring pct={h.pct} size={150} stroke={12}>
          <div>
            <div className="display" style={{ fontSize: '2.6rem' }}>{Math.round(h.pct * 100)}<span style={{ fontSize: '0.5em' }}>%</span></div>
            <div className="kicker" style={{ marginTop: 4 }}>Hero</div>
          </div>
        </Ring>
        <div>
          <div className="rank-name" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{h.stage.icon} {h.stage.name}</div>
          <div className="small dim" style={{ marginTop: 4 }}>Lean, athletic, strong and natural: the Tom Holland look.</div>
        </div>
        {h.next && (
          <div style={{ width: '100%' }}>
            <div className="meta row between tiny dim" style={{ marginBottom: 6 }}>
              <span>Next: {h.next.icon} {h.next.name} at {Math.round(h.next.min * 100)}%</span>
              <span className="xp-chip">+{h.next.xp}</span>
            </div>
            <XpBar pct={toNext} />
          </div>
        )}
        {!g.heroBodyweightKnown && (
          <a className="notice warn small" href="#/progress?tab=body" style={{ width: '100%', textAlign: 'left' }}>Log your bodyweight (Progress → Body). Pull-up and dip estimates use it; until then 70 kg is assumed.</a>
        )}
      </div>

      <div className="stack">
        <div className="section-title">Five pillars</div>
        {h.pillars.map((p) => (
          <div key={p.id} className="card stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <Ring pct={p.score} size={48} stroke={4.5}><span style={{ fontSize: '1.2rem' }}>{p.icon}</span></Ring>
              <div className="grow">
                <div className="bold">{p.name}</div>
                <div className="tiny dim">{Math.round(p.weight * 100)}% of your Hero score</div>
              </div>
              <span className="display" style={{ fontSize: '1.3rem' }}>{Math.round(p.score * 100)}%</span>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {p.metrics.map((m) => (
                <div key={m.label} className="stack" style={{ gap: 5 }}>
                  <div className="row between small">
                    <span className="dim">{m.label}</span>
                    <span className="num bold">
                      {m.value}
                      {m.estimated && <span className="tag" style={{ marginLeft: 6 }}>est.</span>}
                    </span>
                  </div>
                  <XpBar thin gold pct={m.score} />
                  {m.hint && <span className="tiny muted">{m.hint}</span>}
                </div>
              ))}
            </div>
            <div className="notice small dim" style={{ lineHeight: 1.45 }}>💡 {p.tip}</div>
            {p.id === 'benchmarks' && (
              <div className="row-wrap">
                <a className="btn sm tint grow" href="#/log?add=Hero_Ladder"><Icon name="play" size={12} fill stroke={0} /> Ladder</a>
                <a className="btn sm tint grow" href="#/log?add=Hero_Cindy"><Icon name="play" size={12} fill stroke={0} /> Cindy</a>
                <a className="btn sm" href="#/guide/Hero_Ladder">How?</a>
              </div>
            )}
            {p.id === 'bodyweight' && (
              <div className="chips" style={{ margin: 0, padding: 0 }}>
                <a className="chip" href="#/guide/Pullups">Pull-up</a>
                <a className="chip" href="#/guide/Assisted_Pull-Up_Machine">Assisted pull-up</a>
                <a className="chip" href="#/guide/Parallel_Bar_Dip">Dip</a>
                <a className="chip" href="#/guide/Pushups">Push-up</a>
                <a className="chip" href="#/guide/Inverted_Row">Inverted row</a>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="stack">
        <div className="section-title">Hero stages</div>
        <div className="group ladder">
          {HERO_STAGES.map((st, i) => {
            const a = unlocked.get(`hero-stage-${i}`);
            const reached = i <= stageIdx;
            return (
              <div key={st.name} className={`rung${i === stageIdx ? ' current' : ''}`} style={{ opacity: reached || a ? 1 : 0.55 }}>
                <span style={{ width: 22, textAlign: 'center' }}>{st.icon}</span>
                <span className="grow bold">{st.name}</span>
                <span className="tiny muted num" style={{ textAlign: 'right' }}>
                  {Math.round(st.min * 100)}%{st.xp ? ` · +${st.xp} XP` : ''}
                  {a && <><br />✓ {fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="tiny muted">Stages unlock the first time you reach them. Your live % can dip if you train less (physique volume is your last 12 weeks), which is how real fitness works.</p>
      </div>

      <div className="stack">
        <div className="section-title">About the goal</div>
        <div className="card stack prose">
          <div>Trained by <b>Duffy Gaver</b>, Tom Holland is reported to do a Monday <b>bodyweight ladder</b> of pull-ups, dips, push-ups, sit-ups and squats (1→10→1, about 1,500 reps), plus a "bodybuilding mindset" for upper-body size. He doesn't chase 1-rep-max records. He's about 1.73 m and ~63–70 kg (unofficial).</div>
          <div>So your Hero % rewards <b>relative strength</b>, <b>enough weekly volume</b> to build muscle, <b>steady progression</b> and <b>years of consistency</b>. Targets are our estimate of a fit, natural "hero" level, not his personal stats.</div>
        </div>
      </div>

      <div className="card stack small dim" style={{ lineHeight: 1.5 }}>
        <b style={{ color: 'var(--text)' }}>Targets at a glance</b>
        <div>{HERO_TARGETS.pullups} strict pull-ups · {HERO_TARGETS.dips} dips · {HERO_TARGETS.pushups} push-ups · {HERO_TARGETS.legRaises} hanging leg raises</div>
        <div>The full ladder in ≤ {HERO_TARGETS.ladderMinutes} min · Cindy {HERO_TARGETS.cindyRounds}+ rounds</div>
        <div>{HERO_TARGETS.setsPerMuscle}+ sets per muscle per week · +{HERO_TARGETS.strengthGain * 100}% strength on your main lifts · {HERO_TARGETS.gymDays} gym days</div>
        <div className="muted">Not measured yet: body-fat % (the "lean" part), cardio and mobility. We'll add these later.</div>
      </div>

      <div className="stack">
        <div className="section-title">Sources</div>
        <div className="group">
          {SOURCES.map((s) => (
            <a key={s.url} className="cell small" href={s.url} target="_blank" rel="noopener noreferrer"><span className="grow">{s.label}</span><Icon name="external" size={15} style={{ color: 'var(--muted)' }} /></a>
          ))}
        </div>
      </div>
    </div>
  );
}
