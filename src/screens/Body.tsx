// The Body tab: your phase and how fast weight is moving, bodyweight as a weekly average, body
// composition from a tape measure, and the measurements themselves. The formulas live in lib/body.ts.
import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { addDays, fmtDate, fmtNum, num, today, uid, weekKey } from '../lib/util';
import { LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { Cell, Empty, ProgressBar, Ring, Segmented, Sheet, toast } from '../components/ui';
import {
  ageOn, bmiApplies, bmiLabel, bmiOf, bodyFatBand, compositionAt, currentPhase, DISCLAIMER_SHORT, ffmiLabel, ffmiMarks, goalAllowed, latestMeasure,
  liveWeights, MEASURE_DAYS, measureNear, measuresFor, PHASE_LABEL, phaseSummary, QUALITY_MIN_KG, QUALITY_MIN_WEEKS, qualityLabel, rateAdvice,
  rateBands, trendKg, weeklyAverages, WHTR_MAX, WHTR_MIN, whtrLabel, whtrOf, withPhase, type Composition, type Measure, type PhaseSummary,
} from '../lib/body';
import type { PhaseType, Profile, Sex, WeightEntry } from '../lib/types';

const LABEL: Record<Measure, string> = { waistCm: 'Waist', neckCm: 'Neck', armCm: 'Arm', chestCm: 'Chest', hipCm: 'Hips', thighCm: 'Thigh' };
/** Where to put the tape. The waist site follows the US Navy method, which differs by sex. */
function howTo(key: Measure, sex: Sex | ''): string {
  switch (key) {
    case 'waistCm': return sex === 'female'
      ? "At the narrowest part of your waist, usually a little above the belly button, standing relaxed, after a normal breath out. Don't suck in."
      : "At your belly button, standing relaxed, after a normal breath out. Don't suck in.";
    case 'neckCm': return sex === 'female' ? 'Just below the voice box, with the tape sloping slightly down to the front.' : "Just below the Adam's apple, with the tape sloping slightly down to the front.";
    case 'armCm': return 'Flexed, around the widest part of the upper arm. Same arm every time.';
    case 'chestCm': return 'At nipple height, arms down, after a normal breath out.';
    case 'hipCm': return 'Around the fullest part of your glutes, seen from the side, feet together.';
    case 'thighCm': return 'Around the fullest part of your thigh, just below the glutes, standing relaxed with your weight on both feet. Same leg every time.';
  }
}
const RANGE: Record<Measure, [number, number]> = { waistCm: [40, 250], neckCm: [20, 70], armCm: [15, 70], chestCm: [50, 200], hipCm: [50, 200], thighCm: [30, 120] };
const EMPTY: Record<Measure, string> = { waistCm: '', neckCm: '', armCm: '', chestCm: '', hipCm: '', thighCm: '' };

const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n), digits)}`;
const short = (date: string) => fmtDate(date, { day: 'numeric', month: 'short' });

/** Starting points for each phase. Calories are smaller for women, whose maintenance is usually lower. */
function phaseHelp(type: PhaseType, sex: Sex | ''): string {
  const f = sex === 'female';
  if (type === 'gain') return `Eat a small surplus, about ${f ? '150–250' : '200–300'} kcal a day over maintenance, with 1.6–2.2 g of protein per kg of bodyweight. Aim for ${f ? '0.5–1.25' : '0.75–1.5'}% of your bodyweight a month: slower than a classic bulk, so most of what you gain is muscle.`;
  if (type === 'cut') return `Eat about ${f ? '250–400' : '300–500'} kcal a day under maintenance, keep lifting heavy and keep protein high (1.6–2.2 g per kg or more). Lose 0.5–1% of your bodyweight a week, so the weight comes off as fat and your strength stays.${f ? ' If your period becomes irregular or stops, eat more and see a doctor: it is the main sign of eating too little for your training (IOC consensus on RED-S, 2023).' : ''}`;
  return 'Hold your weight within about 1% a month while your training keeps improving. Good between a gain and a cut, or as a break from either.';
}

const ALL = Object.keys(LABEL) as Measure[];
/** The measurement fields for a profile, with their labels and how to take them. */
const fieldsFor = (p: Profile) => measuresFor(p.sex).map((key) => ({ key, label: LABEL[key], how: howTo(key, p.sex) }));

/** The healthy pace for a phase, in kg a month at your weight. */
function paceText(type: PhaseType, kg: number, sex: Sex | ''): string {
  const [a, b] = rateBands(type, sex).good.map((pct) => fmtNum((Math.abs(pct) * kg) / 100, 1));
  return type === 'gain' ? `Lean-gain pace for you: +${a}–${b} kg a month` : type === 'cut' ? `Steady-cut pace for you: −${b}–${a} kg a month` : `Steady for you: within ±${b} kg a month`;
}

export function Body() {
  const data = useData();
  const p = data.profile;
  const entries = useMemo(() => liveWeights(data.weights), [data.weights]);
  const weeks = useMemo(() => weeklyAverages(entries), [entries]);
  const phase = currentPhase(p);
  const summary = useMemo(() => (phase ? phaseSummary(entries, phase, p) : null), [entries, phase, p]);
  const comp = useMemo(() => compositionAt(entries, p), [entries, p]);
  const [editPhase, setEditPhase] = useState(false);
  const week = weeks[weeks.length - 1];

  return (
    <div className="stack-lg">
      {!p.sex && entries.length > 0 && (
        <div className="notice small">Set your sex in Settings: body fat, healthy ranges, the lean-gain pace and heart rate all use formulas that differ for women and men.</div>
      )}
      <PhaseCard s={summary} nowKg={week?.kg ?? 0} sex={p.sex} onEdit={() => setEditPhase(true)} />
      {entries.length > 0 && <WeightCard entries={entries} p={p} />}
      {entries.some((e) => e.waistCm) && <CompositionCard entries={entries} p={p} comp={comp} since={phase?.start} />}
      {entries.length > 0 && <MeasuresCard entries={entries} p={p} since={phase?.start} />}
      <LogForm entries={entries} p={p} />
      <History entries={entries} />
      {editPhase && <PhaseSheet p={p} onClose={() => setEditPhase(false)} />}
    </div>
  );
}

function PhaseCard({ s, nowKg, sex, onEdit }: { s: PhaseSummary | null; nowKg: number; sex: Sex | ''; onEdit: () => void }) {
  if (!s)
    return (
      <div className="card stack" style={{ gap: 8 }}>
        <div className="kicker">Your phase</div>
        <div className="bold">Gaining, cutting or holding steady?</div>
        <p className="small dim" style={{ lineHeight: 1.45 }}>Pick one and Bro checks how fast your weight is moving against a healthy pace for it, and shows what's changed since you started.</p>
        <button className="btn sm tint" style={{ alignSelf: 'flex-start' }} onClick={onEdit}>Choose a phase</button>
      </div>
    );
  const { phase, rate, band } = s;
  const cls = band === 'good' ? 'rate-good' : band === 'ok' ? 'rate-ok' : 'rate-off';
  const dKg = s.startKg !== null && s.nowKg !== null ? s.nowKg - s.startKg : null;
  const dWaist = s.startWaist !== null && s.nowWaist !== null ? s.nowWaist - s.startWaist : null;
  const weeks = Math.floor(s.days / 7);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row between">
        <div className="kicker">{PHASE_LABEL[phase.type]} · week {weeks + 1}</div>
        <button className="btn ghost sm" style={{ minHeight: 0, padding: '2px 4px' }} onClick={onEdit}>Change</button>
      </div>
      {rate && band ? (
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className={`display ${cls}`} style={{ fontSize: '2rem' }}>{signed(rate.kgPerMonth)}</span>
            <span className="dim bold">kg a month</span>
            <span className="tiny muted num">{signed(rate.pctPerMonth)}% of bodyweight</span>
          </div>
          <div className="small">{rateAdvice(phase.type, band)}</div>
          {nowKg > 0 && <div className="tiny dim">{paceText(phase.type, nowKg, sex)}. Weekly averages, {short(rate.from.week)} → {short(rate.to.week)}.</div>}
        </div>
      ) : (
        <p className="small dim" style={{ lineHeight: 1.45 }}>Your rate shows from about week 4, comparing weekly averages. Weigh in 3–4 mornings a week, after the bathroom and before eating.{nowKg > 0 ? ` ${paceText(phase.type, nowKg, sex)}.` : ''}</p>
      )}
      {phase.type === 'cut' && sex === 'female' && (
        <div className="tiny muted" style={{ lineHeight: 1.45 }}>If your period becomes irregular or stops during a cut, eat more and see a doctor: it is the main sign of eating too little for your training (RED-S).</div>
      )}
      <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><div className="label">Since</div><div className="value" style={{ fontSize: '1.05rem', paddingTop: 4 }}>{short(phase.start)}</div></div>
        <div><div className="label">Weight</div><div className="value">{dKg !== null ? signed(dKg) : '—'}<small>kg</small></div></div>
        <div><div className="label">Waist</div><div className="value">{dWaist !== null ? signed(dWaist) : '—'}<small>cm</small></div></div>
      </div>
      {s.waistCheck === 'up' && dWaist !== null && (
        <div className="notice warn small">
          <b>Check-in:</b> your waist is up {fmtNum(dWaist, 1)} cm since this gain began. {sex === 'female' ? 'Check it again the week after your period, when bloating is lowest, and compare your photos. ' : 'Compare your photos: '}If most of the change sits around your middle, 2–4 weeks at maintenance, or a short cut, keeps the muscle and trims the extra fat before you gain again.
        </div>
      )}
      {s.waistCheck === 'whtr' && (
        <div className="notice warn small">
          <b>Check-in:</b> your waist has reached half your height, the usual healthy cut-off. A good moment to pause the gain: a few weeks at maintenance or a short cut.
        </div>
      )}
      {phase.type === 'gain' && (
        s.quality !== null ? (
          <div className="small">Gain quality <b className="num">{fmtNum(s.quality, 2)}</b>: {qualityLabel(s.quality)}. That's lean mass gained ÷ weight gained, from your tape measurements. Around 0.5 or more is a good lean gain.</div>
        ) : (
          <div className="tiny muted">Gain quality (how much of the gain is lean) shows from week {QUALITY_MIN_WEEKS} and {QUALITY_MIN_KG} kg gained, with your waist, neck{sex === 'female' ? ' and hips' : ''} measured near the start and since.</div>
        )
      )}
    </div>
  );
}

function PhaseSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const cur = currentPhase(p);
  const [type, setType] = useState<PhaseType>(cur?.type ?? 'gain');
  const [start, setStart] = useState(today());
  const save = () => {
    getStore().update((d) => { d.profile = { ...withPhase(d.profile, { type, start }), updatedAt: Date.now() }; }, `Start ${PHASE_LABEL[type].toLowerCase()} phase`);
    toast(`${PHASE_LABEL[type]} from ${short(start)}`);
    onClose();
  };
  return (
    <Sheet onClose={onClose} title="Your phase">
      <div className="stack">
        <Segmented<PhaseType> value={type} options={[['gain', 'Lean gain'], ['cut', 'Cut'], ['maintain', 'Maintain']]} onChange={setType} />
        <p className="small dim" style={{ lineHeight: 1.5 }}>{phaseHelp(type, p.sex)}</p>
        <label className="field">Starting<input className="input" type="date" value={start} max={today()} onChange={(e) => setStart(e.target.value || today())} /></label>
        <button className="btn primary block" onClick={save}>Start {PHASE_LABEL[type].toLowerCase()}</button>
        {cur && <p className="tiny muted">Your {PHASE_LABEL[cur.type].toLowerCase()} phase, since {short(cur.start)}, ends when this one starts.</p>}
        <p className="tiny muted">{DISCLAIMER_SHORT} Calorie numbers are rough starting points: adjust them by what your weekly average does.</p>
      </div>
    </Sheet>
  );
}

function WeightCard({ entries, p }: { entries: WeightEntry[]; p: Profile }) {
  const weeks = weeklyAverages(entries);
  const week = weeks[weeks.length - 1];
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const now = week.kg;
  const bmi = p.heightCm && bmiApplies(ageOn(p.birthYear, today())) ? bmiOf(now, p.heightCm) : null;
  const lastWaist = latestMeasure(entries, 'waistCm')?.cm;
  // Rounded first, so the label always agrees with the two decimals on screen.
  const whtr = lastWaist && p.heightCm ? Math.round(whtrOf(lastWaist, p.heightCm) * 100) / 100 : null;
  const delta = latest !== first ? now - first.kg : null;
  const goal = p.goalWeightKg && goalAllowed(p.goalWeightKg, p.heightCm) ? p.goalWeightKg : null;
  const toward = delta !== null && goal ? Math.sign(goal - first.kg) === Math.sign(delta) : null;
  const trend = trendKg(entries.map((e) => e.kg));
  // Weekly averages once there are two weeks: single weigh-ins zig-zag with water and food.
  const points = weeks.length >= 2 ? weeks.map((w) => ({ date: w.week, y: Math.round(w.kg * 10) / 10 })) : entries.map((e) => ({ date: e.date, y: e.kg }));
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="kicker">Week average</div>
          <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 2, flexWrap: 'wrap' }}>
            <span className="display" style={{ fontSize: '2.4rem' }}>{fmtNum(now, 1)}</span>
            <span className="dim bold">kg</span>
            {delta !== null && <span className={`tag ${toward ? 'accent' : ''}`}>{delta > 0 ? '+' : ''}{fmtNum(delta, 1)} since {short(first.date)}</span>}
          </div>
          <div className="tiny dim">{week.n === 1 ? '1 weigh-in' : `${week.n} weigh-ins`} {week.week === weekKey(today()) ? 'this week' : `in the week of ${short(week.week)}`} · last {fmtNum(latest.kg, 1)} kg on {fmtDate(latest.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {whtr !== null && (
            <Ring pct={Math.min(1, Math.max(0, (whtr - 0.3) / 0.4))} size={58} stroke={5} color={whtr >= WHTR_MIN && whtr < WHTR_MAX ? 'var(--accent)' : 'var(--fire)'}>
              <div style={{ lineHeight: 1 }}><div className="display" style={{ fontSize: '0.95rem' }}>{whtr.toFixed(2)}</div><div style={{ fontSize: '0.5rem', color: 'var(--text-2)', fontWeight: 700 }}>WAIST÷HT</div></div>
            </Ring>
          )}
          {bmi !== null && (
            <Ring pct={Math.min(1, Math.max(0, (bmi - 15) / 20))} size={58} stroke={5} color={bmi >= 18.5 && bmi < 25 ? 'var(--accent)' : 'var(--fire)'}>
              <div style={{ lineHeight: 1 }}><div className="display" style={{ fontSize: '0.95rem' }}>{fmtNum(bmi, 1)}</div><div style={{ fontSize: '0.55rem', color: 'var(--text-2)', fontWeight: 700 }}>BMI</div></div>
            </Ring>
          )}
        </div>
      </div>
      {points.length > 1 && (
        <LineChart points={points} unit="kg" color="var(--info)" label={weeks.length >= 2 ? 'Bodyweight, weekly average' : 'Bodyweight'} refLine={goal ? { y: goal, label: `goal ${goal} kg` } : undefined} />
      )}
      <div className="stack tiny muted" style={{ gap: 6, lineHeight: 1.45 }}>
        <p>One weigh-in swings a kilo either way with water, salt and food, so Bro reads the Monday–Sunday average. Weigh in 3–4 mornings a week, after the bathroom and before eating.</p>
        {p.sex === 'female' && <p>Around your period, water retention can add about half a kilo or more for a few days. The rate compares weeks 4 weeks apart, which lines up with a typical cycle, so it mostly cancels out. A heavier week around your period isn't fat.</p>}
        {goal && trend !== null && <p>Your goal weight is judged on the average of your last 3 weigh-ins: {fmtNum(trend, 1)} kg now.</p>}
        {whtr !== null && <p>Waist ÷ height {whtr.toFixed(2)}: {whtrLabel(whtr)}. Under 0.5 is the commonly used healthy cut-off, and muscle doesn't distort it.</p>}
        {bmi !== null && <p>BMI {fmtNum(bmi, 1)}: {bmiLabel(bmi)}. BMI can't tell muscle from fat, so people who lift often read high{whtr === null ? '. Add your waist below for a better guide' : ''}.</p>}
        {!p.heightCm && <p>Add your height in Settings to see BMI, waist ÷ height and body fat.</p>}
        {p.goalWeightKg && !goal && <p>Your goal weight is under a healthy weight for your height, so it isn't tracked. You can change it in Settings.</p>}
        <p>{DISCLAIMER_SHORT}</p>
      </div>
    </div>
  );
}

function CompositionCard({ entries, p, comp, since }: { entries: WeightEntry[]; p: Profile; comp: Composition | null; since?: string }) {
  const female = p.sex === 'female';
  if (p.sex !== 'male' && !female)
    return <p className="tiny muted" style={{ padding: '0 4px' }}>To estimate body fat from your tape measurements, set your sex to male or female in Settings: the formula is different for each.</p>;
  if (!p.heightCm) return null;
  if (!comp)
    return <p className="tiny muted" style={{ padding: '0 4px' }}>Log your {female ? 'hips and neck' : 'neck'} along with your waist to estimate body fat, lean mass and FFMI.</p>;
  // Change since the phase began (or your first full set of measurements).
  const firstWaist = entries.find((e) => e.waistCm)?.date;
  const start = compositionAt(entries, p, since ?? firstWaist);
  const changed = start && start.date < comp.date ? start : null;
  const marks = ffmiMarks(p.sex)!;
  const range = bodyFatBand(comp.bf, p.sex, ageOn(p.birthYear, today()));
  const rangeText = range && `${range.healthy[0]}–${range.healthy[1] - 1}%`;
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row between">
        <div className="kicker">Body composition</div>
        <span className="tiny dim">{fmtDate(comp.date, { day: 'numeric', month: 'short' })}</span>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="display" style={{ fontSize: '2rem' }}>~{fmtNum(comp.bf, 1)}%</span>
        <span className="dim bold">body fat</span>
        <span className="tag">tape estimate ±3–4%</span>
      </div>
      <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><div className="label">Lean mass</div><div className="value">{fmtNum(comp.leanKg, 1)}<small>kg</small></div></div>
        <div><div className="label">Fat mass</div><div className="value">{fmtNum(comp.fatKg, 1)}<small>kg</small></div></div>
        <div><div className="label">FFMI</div><div className="value">{fmtNum(comp.ffmi, 1)}</div></div>
      </div>
      {range && (
        <div className="small">
          {range.band === 'healthy' ? `In the healthy range for your age and sex (about ${rangeText}).`
            : range.band === 'low' ? (female
              ? `Below the general healthy range for women your age (about ${rangeText}). Common in athletes, but if your period gets irregular or stops, eat more and see a doctor.`
              : `Very lean: below the general range for men your age (about ${rangeText}). Fine for a while, hard to hold for long.`)
            : range.band === 'high' ? `Above the healthy range for your age and sex (about ${rangeText}).`
            : `Well above the healthy range for your age and sex (about ${rangeText}).`}
        </div>
      )}
      <div className="stack" style={{ gap: 5 }}>
        <div className="row between small">
          <span className="dim">FFMI · {ffmiLabel(comp.ffmi, marks)}</span>
          <span className="num bold">{fmtNum(comp.ffmi, 1)} <span className="muted">/ {marks.trained}</span></span>
        </div>
        <ProgressBar thin pct={(comp.ffmi - marks.barFrom) / (marks.trained - marks.barFrom)} />
      </div>
      {changed && (
        <div className="small">Since {short(changed.date)}: lean mass <b className="num">{signed(comp.leanKg - changed.leanKg)} kg</b>, fat <b className="num">{signed(comp.fatKg - changed.fatKg)} kg</b>.</div>
      )}
      <div className="stack tiny muted" style={{ gap: 6, lineHeight: 1.45 }}>
        <p>Body fat comes from the US Navy tape formula (waist, neck{female ? ', hips' : ''} and height). It can be 3–4% off, but mostly in the same direction for the same person, so watch how it changes over months, not the exact number.</p>
        {female
          ? <p>FFMI is lean mass for your height. Active women average about 15–16 and female college athletes about 19 (Harty et al. 2019), so about {marks.trained} is a visibly trained, athletic physique; about {marks.top} is near the top even for athletes.</p>
          : <p>FFMI is lean mass for your height, adjusted to 1.80 m. About {marks.trained} is a visibly trained natural physique, and about {marks.top} is where natural lifters top out after many years (Kouri et al. 1995).</p>}
        {range && <p>Healthy ranges are Gallagher et al. (2000): the body fat that matches a healthy BMI at your age and sex. They're provisional, and your estimate is ±3–4% on top.</p>}
      </div>
    </div>
  );
}

function MeasuresCard({ entries, p, since }: { entries: WeightEntry[]; p: Profile; since?: string }) {
  const t = today();
  return (
    <div className="stack">
      <div className="section-title">Measurements</div>
      <div className="group">
        {fieldsFor(p).map((m) => {
          const last = latestMeasure(entries, m.key);
          const firstOne = entries.find((e) => e[m.key]);
          const from = since ? measureNear(entries, m.key, since) : firstOne ? { date: firstOne.date, cm: firstOne[m.key]! } : null;
          const due = !last || last.date <= addDays(t, -MEASURE_DAYS[m.key]);
          const change = last && from && from.date < last.date ? last.cm - from.cm : null;
          return (
            <Cell key={m.key} title={m.label} sub={last ? `${short(last.date)}${change !== null ? ` · ${signed(change)} cm since ${short(from!.date)}` : ''}` : `Every ${MEASURE_DAYS[m.key] === 14 ? '2 weeks' : 'month'}`}>
              {due && <span className="tag fire">{last ? 'Due' : 'Not yet'}</span>}
              <b className="num">{last ? `${fmtNum(last.cm, 1)} cm` : '—'}</b>
            </Cell>
          );
        })}
      </div>
      <p className="tiny muted" style={{ padding: '0 4px', lineHeight: 1.45 }}>
        Waist every 2 weeks, the rest monthly, on a weigh-in morning.{p.sex === 'female' ? ' Measure at the same point in your cycle each month, for example the week after your period: bloating peaks on its first day and can add a centimetre or two to your waist.' : ''} Once a month, take progress photos too: front, side and back, same light, same spot, same time of day. Keep them on your phone; Bro doesn't store photos.
      </p>
    </div>
  );
}

function LogForm({ entries, p }: { entries: WeightEntry[]; p: Profile }) {
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(today());
  const [open, setOpen] = useState(false);
  const [cm, setCm] = useState(EMPTY);
  const latest = entries[entries.length - 1];
  const existing = entries.find((e) => e.date === date);
  const waist = latestMeasure(entries, 'waistCm');
  const waistDue = !waist || waist.date <= addDays(today(), -MEASURE_DAYS.waistCm);

  const add = () => {
    const v = kg.trim() ? num(kg) : 0;
    if (kg.trim() && (v < 20 || v > 400)) return toast('Enter your weight in kg');
    const cms: Partial<Record<Measure, number>> = {};
    for (const m of fieldsFor(p)) {
      const s = cm[m.key].trim();
      if (!s) continue;
      const c = num(s);
      if (c < RANGE[m.key][0] || c > RANGE[m.key][1]) return toast(`Enter your ${m.label.toLowerCase()} in cm`);
      cms[m.key] = c;
    }
    const measured = Object.keys(cms).length > 0;
    if (!v && !(measured && existing)) return toast(measured ? 'Add your weight too: measure on a weigh-in morning' : 'Enter your weight in kg');
    getStore().update((d) => {
      const same = d.weights.find((w) => w.date === date && !w.deleted);
      if (same) {
        if (v) same.kg = v;
        Object.assign(same, cms);
        same.updatedAt = Date.now();
      } else d.weights.push({ id: uid(), date, kg: v, ...cms, updatedAt: Date.now() });
    }, `Weigh-in ${date}`);
    setKg('');
    setCm(EMPTY);
    setOpen(false);
    toast(measured ? '📏 Weigh-in and measurements saved' : '⚖️ Weigh-in saved');
  };

  return (
    <div className="stack">
      <div className="section-title">Log a weigh-in</div>
      <div className="grid-2">
        <div className="unit-input">
          <input className="input" inputMode="decimal" placeholder={existing ? String(existing.kg) : latest ? String(latest.kg) : '75.0'} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Bodyweight in kg" />
          <span>kg</span>
        </div>
        <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date" />
      </div>
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={open ? 'chevU' : 'chevD'} size={15} /> Measurements{waistDue ? ' · waist due' : ''}
      </button>
      {open && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="measure-grid">
            {fieldsFor(p).map((m) => (
              <div key={m.key} className="unit-input">
                <input className="input" inputMode="decimal" placeholder={m.label} value={cm[m.key]} onChange={(e) => setCm({ ...cm, [m.key]: e.target.value })} aria-label={`${m.label} in cm, optional`} />
                <span>cm</span>
              </div>
            ))}
          </div>
          <div className="stack tiny muted" style={{ gap: 4, lineHeight: 1.45 }}>
            {fieldsFor(p).map((m) => <p key={m.key}><b style={{ color: 'var(--text-2)' }}>{m.label}:</b> {m.how}</p>)}
            <p>Use a soft tape, snug but not pressing into the skin. Fill in only what you measured today.</p>
          </div>
        </div>
      )}
      <button className="btn primary block" onClick={add}><Icon name="check" size={18} stroke={2.8} /> {existing && !kg.trim() ? 'Add to this weigh-in' : 'Save'}</button>
    </div>
  );
}

function History({ entries }: { entries: WeightEntry[] }) {
  if (!entries.length) return <Empty title="No weigh-ins yet">Weigh in 3–4 mornings a week. Your week average shows whether you're really gaining or losing, and it makes assisted machines count correctly.</Empty>;
  const del = (id: string) =>
    getStore().update((d) => {
      const w = d.weights.find((x) => x.id === id);
      if (w) { w.deleted = true; w.updatedAt = Date.now(); }
    }, 'Delete weigh-in');
  return (
    <div className="stack">
      <div className="section-title">History</div>
      <div className="group">
        {[...entries].reverse().map((w) => {
          const ms = ALL.filter((k) => w[k]).map((k) => `${LABEL[k].toLowerCase()} ${w[k]}`);
          return (
            <Cell key={w.id} title={fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} sub={ms.length ? `${ms.join(' · ')} cm` : undefined}>
              <b className="num">{w.kg} kg</b>
              <button className="icon-btn plain" aria-label="Delete entry" onClick={() => del(w.id)}><Icon name="trash" size={16} /></button>
            </Cell>
          );
        })}
      </div>
    </div>
  );
}
