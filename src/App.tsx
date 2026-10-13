import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasVault, forgetKey, tryResume, type Unlocked } from './lib/vault';
import { setCurrentStore, Store, useStore } from './lib/store';
import { Session } from './lib/session';
import { useRoute } from './lib/router';
import { Setup, Unlock } from './screens/Auth';
import { Home } from './screens/Home';
import { Log } from './screens/Log';
import { SessionView } from './screens/SessionView';
import { LiftDetail, Progress } from './screens/Progress';
import { CustomExerciseEdit, Guide, GuideDetail } from './screens/Guide';
import { Awards } from './screens/Awards';
import { RoutineEdit, Settings } from './screens/Settings';
import { Backfill } from './screens/Backfill';
import { Hero } from './screens/Hero';
import { ToastHost } from './components/ui';
import { Icon, type IconName } from './components/Icon';
import { logHref } from './lib/today';

type Phase = { kind: 'boot' } | { kind: 'setup' } | { kind: 'locked' } | { kind: 'open'; unlocked: Unlocked; store: Store };

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'boot' });

  const open = useCallback(async (u: Unlocked) => {
    const store = new Store(u.key, u.cfg);
    setCurrentStore(store);
    setPhase({ kind: 'open', unlocked: u, store });
    await store.open();
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return; // StrictMode runs effects twice in dev
    booted.current = true;
    (async () => {
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
        const { openDemo, demoData } = await import('./dev/demo');
        const { unlocked, store } = await openDemo();
        setCurrentStore(store);
        setPhase({ kind: 'open', unlocked, store });
        await store.open();
        store.update((d) => Object.assign(d, demoData()), 'Demo data');
        (store as unknown as { set: (p: object) => void }).set({ status: 'synced', dirty: false });
        return;
      }
      if (!hasVault()) return setPhase({ kind: 'setup' });
      const u = await tryResume();
      if (u) await open(u);
      else setPhase({ kind: 'locked' });
    })();
  }, [open]);

  const lock = useCallback(() => {
    if (phase.kind === 'open') phase.store.dispose();
    setCurrentStore(null);
    void forgetKey();
    setPhase({ kind: 'locked' });
  }, [phase]);

  const ctx = useMemo(
    () =>
      phase.kind === 'open'
        ? {
            unlocked: phase.unlocked,
            lock,
            setUnlocked: async (u: Unlocked) => {
              await phase.store.rekey(u.key, u.cfg);
              setPhase({ ...phase, unlocked: u });
            },
          }
        : null,
    [phase, lock],
  );

  if (phase.kind === 'boot') return <div className="auth-wrap"><span className="spinner" /></div>;
  if (phase.kind === 'setup') return <Setup onDone={open} />;
  if (phase.kind === 'locked') return <Unlock onDone={open} />;
  return (
    <Session.Provider value={ctx}>
      <Shell />
    </Session.Provider>
  );
}

function Shell() {
  const route = useRoute();
  const { ready } = useStore();
  const [p0, p1] = route.path;

  let page: React.ReactNode;
  if (!ready) page = <div className="center" style={{ padding: '30vh 0' }}><span className="spinner" /><p className="muted small" style={{ marginTop: 12 }}>Loading your data…</p></div>;
  else if (p0 === 'log') page = <Log key={p1 ?? 'new'} route={route} />;
  else if (p0 === 'session' && p1) page = <SessionView id={p1} />;
  else if (p0 === 'progress') page = <Progress route={route} />;
  else if (p0 === 'lift' && p1) page = <LiftDetail id={p1} />;
  else if (p0 === 'guide' && p1) page = <GuideDetail id={p1} />;
  else if (p0 === 'guide') page = <Guide />;
  else if (p0 === 'guide-edit' && p1) page = <CustomExerciseEdit key={p1} id={p1} />;
  else if (p0 === 'awards') page = <Awards route={route} />;
  else if (p0 === 'settings') page = <Settings />;
  else if (p0 === 'import') page = <Backfill />;
  else if (p0 === 'hero') page = <Hero />;
  else if (p0 === 'routine' && p1) page = <RoutineEdit key={p1} id={p1} />;
  else page = <Home />;

  const tab = p0 === 'progress' || p0 === 'lift' || p0 === 'session' ? 'progress' : p0 === 'guide' || p0 === 'guide-edit' ? 'guide' : p0 === 'awards' || p0 === 'hero' ? 'awards' : p0 === 'log' ? 'log' : 'home';
  const focus = p0 === 'log' || p0 === 'import'; // full-screen flows hide the tab bar
  const tabs: { id: string; href: string; ico: IconName; label: string }[] = [
    { id: 'home', href: '#/', ico: 'home', label: 'Today' },
    { id: 'progress', href: '#/progress', ico: 'chart', label: 'Progress' },
    { id: 'guide', href: '#/guide', ico: 'book', label: 'Guide' },
    { id: 'awards', href: '#/awards', ico: 'trophy', label: 'Career' },
  ];

  return (
    <div className={`app${focus ? ' focus' : ''}`}>
      <main className="main">{page}</main>
      <nav className="tabbar" aria-label="Main">
        <a className="brand logo" href="#/">Gym<span>XP</span></a>
        <div className="pill">
          {tabs.map((t) => (
            <a key={t.id} href={t.href} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.ico} size={22} stroke={tab === t.id ? 2.3 : 1.9} />
              {t.label}
            </a>
          ))}
        </div>
        <a className="fab" href={logHref()} aria-label="New workout">
          <Icon name="plus" size={28} stroke={2.8} />
          <span className="lbl">New workout</span>
        </a>
      </nav>
      <ToastHost />
    </div>
  );
}
