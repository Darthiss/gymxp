// Small hand-rolled SVG charts (single series): 2px line + 10% area wash, end-dot with
// surface ring, hairline grid, crosshair + tooltip on hover/touch.
import { useEffect, useRef, useState } from 'react';
import { parseDate, fmtDate } from '../lib/util';

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null) as React.RefObject<T>;
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const compact = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${+v.toFixed(1)}`;

export interface LinePoint {
  date: string;
  y: number;
}

export function LineChart({
  points,
  color = 'var(--accent)',
  height = 200,
  unit = '',
  format = (v: number) => `${+v.toFixed(1)}${unit ? ' ' + unit : ''}`,
  refLine,
  label,
}: {
  points: LinePoint[];
  color?: string;
  height?: number;
  unit?: string;
  format?: (v: number) => string;
  refLine?: { y: number; label: string };
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const pad = { l: 40, r: 16, t: 14, b: 26 };
  const W = width;
  const H = height;
  const ts = points.map((p) => parseDate(p.date).getTime());
  let tMin = ts[0], tMax = ts[ts.length - 1];
  if (tMin === tMax) { tMin -= 86400000 * 3; tMax += 86400000 * 3; }
  const ys = points.map((p) => p.y).concat(refLine ? [refLine.y] : []);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const x = (t: number) => pad.l + ((t - tMin) / (tMax - tMin)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(ts[i]).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const area = `${path}L${x(ts[ts.length - 1]).toFixed(1)},${y(yMin)}L${x(ts[0]).toFixed(1)},${y(yMin)}Z`;

  // x labels: first, middle, last, skipping any that would collide
  const xLabels: number[] = [];
  for (const i of [0, Math.floor((points.length - 1) / 2), points.length - 1]) {
    if (xLabels.every((j) => Math.abs(x(ts[j]) - x(ts[i])) > 70)) xLabels.push(i);
  }

  const onMove = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0, bd = Infinity;
    ts.forEach((t, i) => {
      const d = Math.abs(x(t) - px);
      if (d < bd) { bd = d; best = i; }
    });
    setHover(best);
  };

  const last = points.length - 1;
  const hp = hover !== null ? points[hover] : null;

  return (
    <div
      ref={ref}
      className="chart"
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerDown={(e) => onMove(e.clientX)}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={`${label}: latest ${format(points[last].y)}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">{compact(t)}</text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} x={x(ts[i])} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
            {fmtDate(points[i].date, { day: 'numeric', month: 'short' })}
          </text>
        ))}
        {refLine && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(refLine.y)} y2={y(refLine.y)} stroke="var(--text-2)" strokeWidth={1} strokeDasharray="0" opacity={0.5} />
            <text x={W - pad.r} y={y(refLine.y) - 6} textAnchor="end" fontSize={11} fill="var(--text-2)">{refLine.label}</text>
          </g>
        )}
        <path d={area} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 40 && points.map((p, i) => i !== last && (
          <circle key={i} cx={x(ts[i])} cy={y(p.y)} r={2.5} fill={color} />
        ))}
        <circle cx={x(ts[last])} cy={y(points[last].y)} r={6} fill="var(--surface)" />
        <circle cx={x(ts[last])} cy={y(points[last].y)} r={4} fill={color} />
        {hover !== null && (
          <g>
            <line x1={x(ts[hover])} x2={x(ts[hover])} y1={pad.t} y2={H - pad.b} stroke="var(--text-2)" strokeWidth={1} opacity={0.6} />
            <circle cx={x(ts[hover])} cy={y(points[hover].y)} r={6} fill="var(--surface)" />
            <circle cx={x(ts[hover])} cy={y(points[hover].y)} r={4} fill={color} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div className="tip" style={{ left: Math.min(Math.max(x(ts[hover]), 60), W - 60), top: y(hp.y) - 8 }}>
          <strong>{format(hp.y)}</strong>
          <span>{fmtDate(hp.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}

export function ColumnChart({
  bars,
  height = 150,
  color = 'var(--accent)',
  refLine,
  label,
  format = (v: number) => String(v),
}: {
  bars: { key: string; label: string; value: number; tip: string }[];
  height?: number;
  color?: string;
  refLine?: { y: number; label: string };
  label: string;
  format?: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 28, r: 8, t: 14, b: 22 };
  const W = width, H = height;
  const max = Math.max(1, ...bars.map((b) => b.value), refLine?.y ?? 0);
  const ticks = niceTicks(0, max, 3);
  const top = ticks[ticks.length - 1];
  const band = (W - pad.l - pad.r) / Math.max(1, bars.length);
  const bw = Math.min(24, band - 2);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const base = y(0);

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setHover(null)} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">{compact(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = pad.l + band * i + band / 2;
          const h = Math.max(0, base - y(b.value));
          const r = Math.min(4, h);
          const x0 = cx - bw / 2;
          const d = h <= 0 ? '' : `M${x0},${base}V${base - h + r}Q${x0},${base - h} ${x0 + r},${base - h}H${x0 + bw - r}Q${x0 + bw},${base - h} ${x0 + bw},${base - h + r}V${base}Z`;
          return (
            <g key={b.key} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={cx - band / 2} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" />
              {d && <path d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {(i === 0 || i === bars.length - 1 || i === Math.floor(bars.length / 2)) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{b.label}</text>
              )}
            </g>
          );
        })}
        {refLine && (
          <g pointerEvents="none">
            <line x1={pad.l} x2={W - pad.r} y1={y(refLine.y)} y2={y(refLine.y)} stroke="var(--text-2)" strokeWidth={1} opacity={0.5} />
            <text x={W - pad.r} y={y(refLine.y) - 5} textAnchor="end" fontSize={11} fill="var(--text-2)">{refLine.label}</text>
          </g>
        )}
      </svg>
      {hover !== null && bars[hover] && (
        <div className="tip" style={{ left: Math.min(Math.max(pad.l + band * hover + band / 2, 60), W - 60), top: y(bars[hover].value) - 6 }}>
          <strong>{format(bars[hover].value)}</strong>
          <span>{bars[hover].tip}</span>
        </div>
      )}
    </div>
  );
}
