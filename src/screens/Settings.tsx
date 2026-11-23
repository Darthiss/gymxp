import { useState } from 'react';
import { getStore, useData, useStore } from '../lib/store';
import { useSession, type AccountSession, type GithubSession } from '../lib/session';
import { checkRepo } from '../lib/github';
import { AUTOLOCK_OPTIONS, changePin, getAutolockMin, setAutolockMin, touchKey, updateConfig, wipeDevice } from '../lib/vault';
import { mergeData, normalizeData } from '../lib/merge';
import { RULES, withWeeklyGoal } from '../lib/engine';
import { fmtDate, num, toISODate, today } from '../lib/util';
import type { Profile, Sex } from '../lib/types';
import { BMI_MAX, DISCLAIMER, goalAllowed, kgAtBmi, minGoalKg } from '../lib/body';
import { CellIcon, PageHead, SyncBadge, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { RecoveryKeyBox } from '../components/RecoveryKey';
import { PrivacyText } from '../components/Privacy';
import type { Moved } from '../lib/account';

export function Settings() {
  const session = useSession();
  return (
    <div className="stack-lg">
      <PageHead title="Settings" backTo="" />
      <ProfileCard />
      <WatchCard />
      {session.kind === 'github' ? <SecurityCard session={session} /> : <AccountCard session={session} />}
      {session.kind === 'github' && <MoveCard />}
      <DataCard />
      <p className="tiny muted center" style={{ lineHeight: 1.5 }}>{DISCLAIMER}</p>
      <p className="tiny muted center">Bro · exercise photos & instructions from free-exercise-db (public domain)</p>
    </div>
  );
}

function ProfileCard() {
  const data = useData();
  const p = data.profile;
  const [f, setF] = useState({
    name: p.name, sex: p.sex, heightCm: p.heightCm ? String(p.heightCm) : '', birthYear: p.birthYear ? String(p.birthYear) : '',
    weeklyGoal: String(p.weeklyGoal || 3), goalWeightKg: p.goalWeightKg ? String(p.goalWeightKg) : '',
  });
  const height = num(f.heightCm) || null;
  const save = () => {
    const goalKg = num(f.goalWeightKg) || null;
    if (goalKg && !goalAllowed(goalKg, height)) return toast(`That goal is under a healthy weight for your height. The lowest Bro tracks is ${minGoalKg(height)} kg.`);
    const next: Profile = {
      ...p,
      updatedAt: Date.now(),
      name: f.name.trim(),
      sex: f.sex as Sex | '',
      heightCm: num(f.heightCm) || null,
      birthYear: Math.round(num(f.birthYear)) || null,
      goalWeightKg: num(f.goalWeightKg) || null,
    };
    const goal = Math.min(7, Math.max(1, Math.round(num(f.weeklyGoal)) || 3));
    const hasWorkouts = data.sessions.some((s) => !s.deleted);
    getStore().update((d) => { d.profile = withWeeklyGoal(next, goal, today(), hasWorkouts); }, 'Update profile');
    toast('Profile saved');
  };
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  return (
    <div className="card stack">
      <h2 className="row" style={{ gap: 10 }}><CellIcon name="user" color="#0a84ff" />Profile</h2>
      <label className="field">Name<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid-2">
        <label className="field">
          Sex
          <select className="input" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value as Sex })}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </label>
        <label className="field">Birth year{age ? ` (${age})` : ''}<input className="input" inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })} /></label>
        <label className="field">Height (cm)<input className="input" inputMode="decimal" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></label>
        <label className="field">Goal weight (kg)<input className="input" inputMode="decimal" value={f.goalWeightKg} onChange={(e) => setF({ ...f, goalWeightKg: e.target.value })} placeholder="optional" /></label>
      </div>
      <p className="tiny muted">Sex and birth year pick the formulas that differ between women and men: body fat and its healthy range, FFMI, the lean-gain pace, which measurements to take, and max heart rate. With Other, Bro uses the ones that don't depend on sex.</p>
      {height && height > 100 && height < 250 && (
        <p className="tiny muted">For your height, {minGoalKg(height)}–{Math.floor(kgAtBmi(BMI_MAX, height))} kg is the range usually called healthy (BMI 18.5–25). Muscle can put you above it.</p>
      )}
      <label className="field">
        Weekly goal: gym days per week{data.sessions.some((s) => !s.deleted) ? ' (a change starts next Monday)' : ''}
        <div className="chips">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} className={`chip${String(n) === f.weeklyGoal ? ' on' : ''}`} onClick={() => setF({ ...f, weeklyGoal: String(n) })}>{n}</button>
          ))}
        </div>
        {num(f.weeklyGoal) > RULES.perfectGoalCap && <span className="tiny muted">Perfect Weeks pay the same from {RULES.perfectGoalCap} days up, because rest is part of training.</span>}
      </label>
      <button className="btn primary" onClick={save}>Save profile</button>
      {p.weatherLat != null && (
        <div className="row between small dim">
          <span>🌦️ Weather location saved (≈ {p.weatherLat}, {p.weatherLon}, rounded to ~10 km)</span>
          <button className="btn ghost sm" onClick={() => getStore().update((d) => { d.profile = { ...d.profile, weatherLat: null, weatherLon: null, updatedAt: Date.now() }; }, 'Forget weather location')}>Forget</button>
        </div>
      )}
    </div>
  );
}

function WatchCard() {
  const appUrl = `${location.origin}${location.pathname}`;
  const [open, setOpen] = useState(false);
  return (
    <div className="card stack">
      <div className="row between">
        <h2 className="row" style={{ gap: 10 }}><CellIcon name="watch" color="#30d158" />Apple Watch</h2>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Set up'}</button>
      </div>
      <p className="small dim">Keep workout minutes and active calories with your stats. Enter them by hand, or build a one-tap iOS Shortcut that grabs your latest workout.</p>
      {open && (
        <div className="stack small">
          <ol className="steps-guide">
            <li>Install the free app <b>Actions</b> (by Sindre Sorhus) from the App Store. It adds a <b>Find Workouts</b> action to Shortcuts, which can read your Apple Health workouts.</li>
            <li>Open <b>Shortcuts</b> → <b>+</b> → name it <b>Bro</b>.</li>
            <li>Add <b>Find Workouts</b> (Actions app): sort by <b>start date, latest first</b>, limit <b>1</b>. Allow Health access when asked.</li>
            <li>Add a <b>Text</b> action and type the line below. Replace each [bracket] by tapping the workout variable and picking its <b>Duration</b>, <b>Active Energy</b>, <b>Average Heart Rate</b> and <b>Start Date</b> (format the date as HH:mm):
              <div className="code" style={{ marginTop: 6 }}>dur=[Duration] kcal=[Active Energy] hr=[Average Heart Rate] start=[Start Date]</div>
            </li>
            <li>Add <b>Copy to Clipboard</b>.</li>
            <li>After the gym: run the Shortcut (or ask Siri “Bro”), open Bro → Workout → ⌚ <b>Paste from Shortcut</b>.</li>
          </ol>
          <div className="notice small">
            <b>Alternative:</b> instead of Copy to Clipboard, use <b>Open URLs</b> with:
            <div className="code" style={{ marginTop: 6 }}>{appUrl}#/log?dur=[Duration]&kcal=[Active Energy]&hr=[Average Heart Rate]</div>
            <span className="muted">On iPhone this opens in Safari (not the home-screen app), which keeps its own login, so you'd set Bro up in Safari too. The clipboard route avoids that.</span>
          </div>
          <p className="muted tiny">Duration can arrive as minutes, seconds or h:mm:ss; Bro understands all of them. Plain text like “62 min 410 kcal 128 bpm” pastes fine too.</p>
        </div>
      )}
    </div>
  );
}

function AccountCard({ session }: { session: AccountSession }) {
  const [mode, setMode] = useState<'none' | 'password' | 'recovery' | 'signout' | 'delete'>('none');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const open = (m: typeof mode) => {
    setMode(mode === m ? 'none' : m);
    setCurrent('');
    setNext('');
    setNewKey('');
    setErr('');
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  // Lets iPhone's Passwords app match the change to the right account.
  const username = <input type="email" value={session.email} autoComplete="username" readOnly hidden />;

  return (
    <div className="card stack">
      <h2 className="row" style={{ gap: 10 }}><CellIcon name="shield" color="#8e8e93" />Account</h2>
      <p className="small dim">
        Signed in as <b>{session.email}</b>. Your log is locked on this phone before it's uploaded, and only your password or recovery key can open it.{' '}
        <a href="#/privacy">How your data stays private</a>
      </p>
      <div className="row-wrap">
        <button className="btn sm grow" onClick={() => open('password')}>Change password</button>
        <button className="btn sm grow" onClick={() => open('recovery')}>New recovery key</button>
      </div>
      {mode === 'password' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(async () => { await session.changePassword(current, next); open('none'); toast('🔐 Password changed. Other devices are signed out.'); }); }}>
          {username}
          <input className="input" type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          <input className="input" type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          {err && <div className="notice bad small">{err}</div>}
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Save new password'}</button>
        </form>
      )}
      {mode === 'recovery' && !newKey && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(async () => setNewKey(await session.newRecoveryKey(current))); }}>
          <p className="small dim">Makes a new key and retires the old one. Do this if you lost it or someone else saw it.</p>
          {username}
          <input className="input" type="password" placeholder="Your password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          {err && <div className="notice bad small">{err}</div>}
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Make a new key'}</button>
        </form>
      )}
      {mode === 'recovery' && newKey && (
        <div className="stack">
          <RecoveryKeyBox value={newKey} />
          <p className="small">Your old key no longer works.</p>
          <button className="btn" onClick={() => open('none')}>Done</button>
        </div>
      )}
      {mode === 'delete' ? (
        <form className="notice bad stack small" onSubmit={(e) => { e.preventDefault(); void run(() => session.deleteAccount(current)); }}>
          Deletes your account for good: your log, photos and sign-in, from the server and every device. Export first if you want a copy. Backups
          expire within 30 days. This can't be undone.
          {username}
          <input className="input" type="password" placeholder="Your password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          {err && <div>{err}</div>}
          <div className="row">
            <button className="btn danger grow" disabled={busy}>{busy ? <span className="spinner" /> : 'Delete account'}</button>
            <button type="button" className="btn grow" onClick={() => open('none')}>Cancel</button>
          </div>
        </form>
      ) : mode !== 'signout' ? (
        <div className="row-wrap">
          <button className="btn danger grow" onClick={() => open('signout')}>Sign out of this phone…</button>
          <button className="btn ghost sm" onClick={() => open('delete')}>Delete account…</button>
        </div>
      ) : (
        <div className="notice bad stack small">
          This phone forgets your data and key. Everything stays in your account: sign in again to get it back.
          <div className="row">
            <button className="btn danger grow" disabled={busy} onClick={() => void run(session.signOut)}>Sign out</button>
            <button className="btn grow" onClick={() => open('none')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** GitHub mode only: move this log into a Bro account (roadmap A.6). */
function MoveCard() {
  const data = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('');
  const [err, setErr] = useState('');
  const [moved, setMoved] = useState<Moved | null>(null);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const move = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setStep('Starting…');
    try {
      const acc = await import('../lib/account');
      const store = getStore();
      setMoved(await acc.moveToAccount(email, password, data, (p) => store.readFile(p), setStep));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStep('');
    }
  };
  const switchOver = async () => {
    getStore().dispose();
    await wipeDevice();
    location.reload();
  };

  return (
    <div className="card stack">
      <h2 className="row" style={{ gap: 10 }}><CellIcon name="upload" color="#c3f73a" />Move to a Bro account</h2>
      {!moved ? (
        <>
          <p className="small dim">
            Your log moves from GitHub into a private Bro account, locked on this phone with your password before it's uploaded. Nothing changes in
            your GitHub repo, which stays as an archive. Finish any workout in progress first.
          </p>
          {!open ? (
            <button className="btn tint" onClick={() => setOpen(true)}>Start the move</button>
          ) : (
            <form className="stack" onSubmit={move}>
              <input className="input" type="email" placeholder="Email (must be on the guest list)" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
              <input className="input" type="password" placeholder="New password, 12+ characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              {err && <div className="notice bad small">{err}</div>}
              <button className="btn primary" disabled={!!step}>{step ? <><span className="spinner" /> {step}</> : 'Move my data'}</button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="notice good small">
            Moved and checked: {moved.workouts} workouts, {moved.weighIns} weigh-ins
            {moved.photos + moved.missingPhotos > 0 ? `, ${moved.photos} of ${moved.photos + moved.missingPhotos} photos` : ''}. Your GitHub repo is untouched.
          </div>
          {moved.recoveryKey && <RecoveryKeyBox value={moved.recoveryKey} />}
          {moved.recoveryKey && (
            <label className="row" style={{ gap: 10 }}>
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              <span className="small">I saved the recovery key somewhere safe</span>
            </label>
          )}
          <p className="small dim">
            Switching makes this phone use the account from now on. On any other device, use Remove Bro from this device, then sign in with
            your account.
          </p>
          <button className="btn primary" disabled={!!moved.recoveryKey && !saved} onClick={() => void switchOver()}>Switch this phone to the account</button>
        </>
      )}
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="stack-lg">
      <PageHead title="Privacy" backTo="settings" />
      <PrivacyText />
    </div>
  );
}

function SecurityCard({ session }: { session: GithubSession }) {
  const [autolock, setAutolock] = useState(getAutolockMin());
  const [mode, setMode] = useState<'none' | 'pin' | 'token' | 'wipe'>('none');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);

  const doPin = async () => {
    if (a.length < 6) return toast('At least 6 characters');
    if (a !== b) return toast('PINs do not match');
    setBusy(true);
    const u = await changePin(session.unlocked, a);
    await session.setUnlocked(u);
    setBusy(false);
    setMode('none');
    setA(''); setB('');
    toast('🔐 PIN changed');
  };

  const doToken = async () => {
    setBusy(true);
    try {
      const cfg = { ...session.unlocked.cfg, token: a.trim() };
      const info = await checkRepo(cfg);
      if (!info.isPrivate) throw new Error('That repository is public, so it was refused.');
      if (!info.canPush) throw new Error('Token has no write access.');
      await session.setUnlocked(await updateConfig(session.unlocked, cfg));
      setMode('none');
      setA('');
      toast('🔑 Token updated');
      void getStore().syncNow();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack">
      <h2 className="row" style={{ gap: 10 }}><CellIcon name="shield" color="#8e8e93" />Security</h2>
      <p className="small dim">
        Data repo: <b>{session.unlocked.cfg.owner}/{session.unlocked.cfg.repo}</b> (private). The token is stored on this device encrypted with your PIN (AES-256, PBKDF2 600k).
      </p>
      <label className="field">
        Auto-lock
        <select className="input" value={autolock} onChange={(e) => { const v = Number(e.target.value); setAutolock(v); setAutolockMin(v); void touchKey(session.unlocked.key); }}>
          {AUTOLOCK_OPTIONS.map((o) => <option key={o.min} value={o.min}>{o.label}</option>)}
        </select>
      </label>
      <div className="row-wrap">
        <button className="btn sm grow" onClick={session.lock}><Icon name="lock" size={16} /> Lock now</button>
        <button className="btn sm grow" onClick={() => setMode(mode === 'pin' ? 'none' : 'pin')}>Change PIN</button>
        <button className="btn sm grow" onClick={() => setMode(mode === 'token' ? 'none' : 'token')}>New token</button>
      </div>
      {mode === 'pin' && (
        <div className="stack">
          <input className="input" type="password" placeholder="New PIN / passphrase" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" />
          <input className="input" type="password" placeholder="Repeat" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
          <button className="btn primary" disabled={busy} onClick={doPin}>{busy ? <span className="spinner" /> : 'Save new PIN'}</button>
        </div>
      )}
      {mode === 'token' && (
        <div className="stack">
          <p className="small dim">When your token expires, create a new one the same way and paste it here.</p>
          <input className="input" type="password" placeholder="github_pat_…" value={a} onChange={(e) => setA(e.target.value)} autoComplete="off" />
          <button className="btn primary" disabled={busy || !a} onClick={doToken}>{busy ? <span className="spinner" /> : 'Verify & save'}</button>
        </div>
      )}
      {mode !== 'wipe' ? (
        <button className="btn danger" onClick={() => setMode('wipe')}>Remove Bro from this device…</button>
      ) : (
        <div className="notice bad stack small">
          Deletes the encrypted token and cached data from this device only. Your workouts stay in GitHub. Use this if you lose or sell a device (also revoke the token on GitHub).
          <div className="row">
            <button className="btn danger grow" onClick={async () => { await wipeDevice(); location.reload(); }}>Remove</button>
            <button className="btn grow" onClick={() => setMode('none')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataCard() {
  const session = useSession();
  const st = useStore();
  const data = st.data;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bro-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const incoming = normalizeData(JSON.parse(await f.text()));
      getStore().update((d) => Object.assign(d, mergeData(d, incoming)), 'Import backup');
      toast(`Imported ${incoming.sessions.length} workouts (merged)`);
    } catch {
      toast('That file is not a Bro backup');
    }
  };
  return (
    <div className="card stack">
      <div className="row between">
        <h2 className="row" style={{ gap: 10 }}><CellIcon name="sync" color="#64d2ff" />Data & sync</h2>
        <SyncBadge />
      </div>
      {st.error && <div className="notice bad small">{st.error}</div>}
      <p className="small dim">
        {data.sessions.filter((s) => !s.deleted).length} workouts · {data.weights.filter((w) => !w.deleted).length} weigh-ins
        {st.lastSync ? ` · last synced ${fmtDate(toISODate(new Date(st.lastSync)), { day: 'numeric', month: 'short' })} ${new Date(st.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
      </p>
      <p className="tiny muted">
        {session.kind === 'github'
          ? 'Every save is a commit in your private repo, so GitHub keeps the full history of your data as a free backup.'
          : 'Saved to your account, locked with your key. Export keeps a copy of your own.'}
      </p>
      <a className="btn tint" href="#/import"><Icon name="download" size={17} /> Import past workouts (from memory)</a>
      <div className="row-wrap">
        <button className="btn grow" onClick={() => void getStore().syncNow()}><Icon name="sync" size={16} /> Sync</button>
        <button className="btn grow" onClick={exportJson}><Icon name="download" size={16} /> Export</button>
        <label className="btn grow"><Icon name="upload" size={16} /> Import<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} /></label>
      </div>
    </div>
  );
}
