import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { getStore, useStore } from '../lib/store';
import { imgUrl } from '../lib/exercises';
import type { Exercise } from '../lib/types';
import type { LevelInfo } from '../lib/xp';
import { back } from '../lib/router';

export function LevelBadge({ info, size = 76 }: { info: LevelInfo; size?: number }) {
  return (
    <div className="badge" style={{ '--size': `${size}px`, '--pct': info.pct, '--rank-color': info.rank.color } as CSSProperties}>
      <small>LVL</small>
      <span>{info.level}</span>
    </div>
  );
}

export function XpBar({ pct, gold, thin }: { pct: number; gold?: boolean; thin?: boolean }) {
  return (
    <div className={`xpbar${gold ? ' gold' : ''}${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
    </div>
  );
}

export function PageHead({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      {backTo !== undefined && (
        <button className="icon-btn" aria-label="Back" onClick={() => back(backTo)}>
          ←
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Sheet({ onClose, children, full }: { onClose: () => void; children: ReactNode; full?: boolean }) {
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
        {children}
      </div>
    </div>
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
  if (failed) return <div className={className} style={{ display: 'grid', placeItems: 'center' }}>📷</div>;
  if (!src) return <div className={className} style={{ display: 'grid', placeItems: 'center' }}><span className="spinner" /></div>;
  return <img className={className} src={src} alt={alt} />;
}

export function ExerciseThumb({ ex, className = 'thumb' }: { ex?: Exercise; className?: string }) {
  if (!ex) return <div className={className}>❔</div>;
  if (ex.photo) return <div className={className}><RepoPhoto path={ex.photo} alt={ex.name} /></div>;
  if (ex.images[0]) return <div className={className}><img src={imgUrl(ex.images[1] ?? ex.images[0])} alt={ex.name} loading="lazy" /></div>;
  return <div className={className}>🏋️</div>;
}

export function SyncBadge() {
  const { status, dirty, error } = useStore();
  const map: Record<string, [string, string]> = {
    loading: ['var(--info)', 'Loading…'],
    synced: ['var(--accent)', dirty ? 'Pending' : 'Saved'],
    saving: ['var(--info)', 'Saving…'],
    offline: ['var(--fire)', dirty ? 'Offline · will sync' : 'Offline'],
    error: ['var(--danger)', 'Sync error'],
  };
  const [color, label] = map[status];
  return (
    <span className="row small dim" title={error} style={{ gap: 6 }}>
      <span className="sync-dot" style={{ background: color }} />
      {label}
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
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Confetti({ burst = 160 }: { burst?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
    };
    resize();
    const colors = ['#6ef09a', '#f6c847', '#6fb6ff', '#ff8a3d', '#b388ff', '#ffffff'];
    const parts = Array.from({ length: burst }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
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

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="card center stack" style={{ padding: 28 }}>
      <div style={{ fontSize: '2.4rem' }}>{icon}</div>
      <h3>{title}</h3>
      {children && <div className="dim small">{children}</div>}
    </div>
  );
}
