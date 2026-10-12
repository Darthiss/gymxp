import { useState } from 'react';
import { Sheet } from './ui';

// Standard (IWF) plate colours so the picture matches what you see on the gym floor.
const PLATES: { kg: number; color: string; h: number }[] = [
  { kg: 25, color: '#e5484d', h: 64 },
  { kg: 20, color: '#3e7bfa', h: 64 },
  { kg: 15, color: '#f5c542', h: 56 },
  { kg: 10, color: '#46a758', h: 48 },
  { kg: 5, color: '#e8ecf3', h: 38 },
  { kg: 2.5, color: '#b0413e', h: 30 },
  { kg: 1.25, color: '#9aa3b2', h: 24 },
];
const BARS = [
  { kg: 20, label: 'Olympic 20' },
  { kg: 15, label: '15' },
  { kg: 10, label: '10 / EZ' },
  { kg: 0, label: 'No bar' },
];

/** Greedy split of a total into plates per side, used to pre-fill from an existing weight. */
function platesFor(total: number, bar: number): number[] {
  let side = (total - bar) / 2;
  const out: number[] = [];
  for (const p of PLATES) while (side >= p.kg - 1e-9) { out.push(p.kg); side -= p.kg; }
  return out;
}

/** Bar + plates calculator: tap the plates on ONE side, get the total to log. */
export function PlateCalc({ barKg, current, sets, onApply, onClose }: {
  barKg: number;
  current?: number;
  sets: number;
  onApply: (kg: number, setIndex: number | 'all') => void;
  onClose: () => void;
}) {
  const [bar, setBar] = useState(barKg);
  const [side, setSide] = useState<number[]>(() => (current && current > barKg ? platesFor(current, barKg) : []));
  const sum = side.reduce((a, b) => a + b, 0);
  const total = bar + 2 * sum;
  const fmt = (n: number) => String(+n.toFixed(2));
  const sorted = [...side].sort((a, b) => b - a);

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="row">
          <h2 className="grow">🧮 Bar + plates</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="small dim">Tap the plates on <b>one side</b> of the bar. GymXP doubles them and adds the bar.</p>

        <div className="chips">
          {BARS.map((b) => (
            <button key={b.kg} className={`chip${bar === b.kg ? ' on' : ''}`} onClick={() => setBar(b.kg)}>{b.label}{b.kg ? ' kg' : ''}</button>
          ))}
        </div>

        {/* Picture of one side of the bar */}
        <div className="card flat row" style={{ minHeight: 92, gap: 3, overflowX: 'auto' }} aria-label="Plates on one side">
          <div style={{ width: 34, height: 10, background: 'var(--muted)', borderRadius: 3, flex: 'none' }} />
          <div style={{ width: 8, height: 26, background: 'var(--muted)', borderRadius: 2, flex: 'none' }} />
          {sorted.map((kg, i) => {
            const p = PLATES.find((x) => x.kg === kg)!;
            return (
              <button key={i} onClick={() => setSide((s) => { const j = s.indexOf(kg); return s.filter((_, k) => k !== j); })}
                title={`Remove ${kg} kg`} aria-label={`Remove ${kg} kg plate`}
                style={{ width: kg >= 10 ? 16 : 12, height: p.h, background: p.color, border: 0, borderRadius: 3, flex: 'none', cursor: 'pointer' }} />
            );
          })}
          <div style={{ flex: 1, height: 10, background: 'var(--muted)', minWidth: 30, borderRadius: '0 3px 3px 0' }} />
        </div>

        <div className="row-wrap">
          {PLATES.map((p) => (
            <button key={p.kg} className="btn sm" style={{ flex: '1 0 22%' }} onClick={() => setSide((s) => [...s, p.kg])}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
              {fmt(p.kg)}
            </button>
          ))}
        </div>

        <div className="card center stack" style={{ gap: 2 }}>
          <div className="big-xp" style={{ fontSize: '2.4rem', color: 'var(--text)', fontWeight: 900 }}>{fmt(total)} kg</div>
          <div className="small muted">
            {bar ? `${bar} kg bar` : 'no bar'}{sum ? ` + 2 × ${fmt(sum)} kg` : ''}
          </div>
          {side.length > 0 && <button className="btn ghost sm" onClick={() => setSide([])}>Clear plates</button>}
        </div>

        <div className="small muted">Put {fmt(total)} kg in:</div>
        <div className="row-wrap">
          {Array.from({ length: sets }, (_, i) => (
            <button key={i} className="btn sm" onClick={() => onApply(total, i)}>Set {i + 1}</button>
          ))}
          <button className="btn primary sm" onClick={() => onApply(total, 'all')}>All sets</button>
        </div>
      </div>
    </Sheet>
  );
}
