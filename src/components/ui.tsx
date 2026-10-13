import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { getStore, useStore } from '../lib/store';
import { imgUrl } from '../lib/exercises';
import type { Exercise } from '../lib/types';
import type { LevelInfo } from '../lib/xp';
import { back } from '../lib/router';
import { Icon, type IconName } from './Icon';

/** Circular progress ring; children render in the middle. */
export function Ring({ pct, size = 44, stroke = 4, color = 'var(--accent)', track = 'rgba(255,255,255,0.09)', children, className = '' }: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {p > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />}
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}

/** Level number inside a ring that fills toward the next level, in the rank's colour. */
export function LevelBadge({ info, size = 76, pct }: { info: LevelInfo; size?: number; pct?: number }) {
  return (
    <Ring pct={pct ?? info.pct} size={size} stroke={Math.max(4, size / 13)} color={info.rank.color} className="lvl-ring">
      <div style={{ fontSize: size * 0.36 }}>
        <small>LVL</small>
        <b>{info.level}</b>
      </div>
    </Ring>
  );
}

export function XpBar({ pct, gold, thin, color }: { pct: number; gold?: boolean; thin?: boolean; color?: string }) {
  return (
    <div className={`xpbar${gold ? ' gold' : ''}${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

/** Pushed-page navigation bar: glass back button, inline title, optional actions. */
export function PageHead({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      {backTo !== undefined && (
        <button className="icon-btn glass" aria-label="Back" onClick={() => back(backTo)}>
          <Icon name="chevL" size={20} stroke={2.4} />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

/** Root-tab large title with an optional eyebrow and trailing actions. */
export function LargeTitle({ title, eyebrow, actions }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="large-head">
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function SectionHead({ title, link, onLink, linkLabel = 'See all' }: { title: ReactNode; link?: string; onLink?: () => void; linkLabel?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {link && <a href={link}>{linkLabel}</a>}
      {onLink && <button onClick={onLink}>{linkLabel}</button>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Coloured rounded-square icon used at the start of grouped-list cells. */
export function CellIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <span className="cell-icon" style={{ background: color }}>
      <Icon name={name} size={17} stroke={2.2} />
    </span>
  );
}

/** One row in an inset grouped list. Renders as a link, a button or a static row. */
export function Cell({ icon, title, sub, value, href, onClick, chevron, children, inset, style }: {
  icon?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  children?: ReactNode;
  inset?: number;
  style?: CSSProperties;
}) {
  const body = (
    <>
      {icon}
      {(title || sub) && (
        <div className="grow">
          {title && <div className="cell-title">{title}</div>}
          {sub && <div className="cell-sub">{sub}</div>}
        </div>
      )}
      {children}
      {value !== undefined && <span className="cell-value">{value}</span>}
      {(chevron ?? !!(href || onClick)) && <Icon name="chevR" size={16} stroke={2.4} className="chev" />}
    </>
  );
  const st = { ...(inset ? { '--inset': `${inset}px` } : {}), ...style } as CSSProperties;
  if (href) return <a className="cell" href={href} style={st}>{body}</a>;
  if (onClick) return <button className="cell" onClick={onClick} style={st}>{body}</button>;
  return <div className="cell static" style={st}>{body}</div>;
}

export function Sheet({ onClose, children, full, title }: { onClose: () => void; children: ReactNode; full?: boolean; title?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${full ? ' full' : ''}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <CloseButton onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label={label}>
      <Icon name="x" size={17} stroke={2.6} />
    </button>
  );
}

/** Photo stored in the private data repo (fetched with the token, shown as a blob URL). */
export function RepoPhoto({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getStore()
      .photoUrl(path)
      .then((u) => live && setSrc(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [path]);
  if (failed) return <div className={className} style={{ display: 'grid', placeItems: 'center', color: '#888' }}><Icon name="camera" /></div>;
  if (!src) return <div className={className} style={{ display: 'grid', placeItems: 'center' }}><span className="spinner" /></div>;
  return <img className={className} src={src} alt={alt} />;
}

export function ExerciseThumb({ ex, className = 'thumb' }: { ex?: Exercise; className?: string }) {
  if (!ex) return <div className={className} style={{ background: 'var(--surface-3)' }}>❔</div>;
  if (ex.photo) return <div className={className}><RepoPhoto path={ex.photo} alt={ex.name} /></div>;
  if (ex.images[0]) return <div className={className}><img src={imgUrl(ex.images[1] ?? ex.images[0])} alt={ex.name} loading="lazy" /></div>;
  return <div className={className} style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}><Icon name="dumbbell" size={22} /></div>;
}

export function SyncBadge({ label = true }: { label?: boolean }) {
  const { status, dirty, error } = useStore();
  const map: Record<string, [string, string]> = {
    loading: ['var(--info)', 'Loading…'],
    synced: [dirty ? 'var(--fire)' : 'var(--accent)', dirty ? 'Pending' : 'Saved'],
    saving: ['var(--info)', 'Saving…'],
    offline: ['var(--fire)', dirty ? 'Offline · will sync' : 'Offline'],
    error: ['var(--danger)', 'Sync error'],
  };
  const [color, text] = map[status];
  return (
    <span className="row tiny dim" title={error ?? text} aria-label={`Sync: ${text}`} style={{ gap: 6, fontWeight: 600 }}>
      <span className="sync-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label && text}
    </span>
  );
}

let toastSetter: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSetter?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => {
    toastSetter = (m) => {
      setMsg(m);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      toastSetter = null;
    };
  }, []);
  return msg ? <div className="toast" role="status" key={msg}>{msg}</div> : null;
}

export function Confetti({ burst = 160 }: { burst?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    const colors = ['#3ee08f', '#b4f45c', '#ffd25a', '#64b5ff', '#ff9f0a', '#bf8bff', '#ffffff'];
    const parts = Array.from({ length: burst }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 5 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t - t0 < 3500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst]);
  return <canvas ref={ref} className="confetti" style={{ width: '100vw', height: '100vh' }} />;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card center stack" style={{ padding: '32px 24px', alignItems: 'center' }}>
      <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>{icon}</div>
      <h3>{title}</h3>
      {children && <div className="dim small" style={{ lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}
