import { useState } from 'react';
import { getStore, useData, useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { checkRepo } from '../lib/github';
import { AUTOLOCK_OPTIONS, changePin, getAutolockMin, setAutolockMin, touchKey, updateConfig, wipeDevice } from '../lib/vault';
import { mergeData, normalizeData } from '../lib/merge';
import { fmtDate, num, toISODate, today } from '../lib/util';
import type { Profile, Sex } from '../lib/types';
import { CellIcon, PageHead, SyncBadge, toast } from '../components/ui';
import { Icon } from '../components/Icon';

export function Settings() {
  return (
    <div className="stack-lg">
      <PageHead title="Settings" backTo="" />
      <ProfileCard />
      <WatchCard />
      <SecurityCard />
      <DataCard />
      <p className="tiny muted center">GymXP · exercise photos & instructions from free-exercise-db (public domain)</p>
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
  const save = () => {
    const next: Profile = {
      ...p,
      updatedAt: Date.now(),
      name: f.name.trim(),
      sex: f.sex as Sex | '',
      heightCm: num(f.heightCm) || null,
      birthYear: Math.round(num(f.birthYear)) || null,
      weeklyGoal: Math.min(7, Math.max(1, Math.round(num(f.weeklyGoal)) || 3)),
      goalWeightKg: num(f.goalWeightKg) || null,
    };
    getStore().update((d) => { d.profile = next; }, 'Update profile');
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
      <label className="field">
        Weekly goal: gym days per week
        <div className="chips">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} className={`chip${String(n) === f.weeklyGoal ? ' on' : ''}`} onClick={() => setF({ ...f, weeklyGoal: String(n) })}>{n}</button>
          ))}
        </div>
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
      <p className="small dim">Workout minutes and active calories earn XP. Enter them by hand, or build a one-tap iOS Shortcut that grabs your latest workout.</p>
      {open && (
        <div className="stack small">
          <ol className="steps-guide">
            <li>Install the free app <b>Actions</b> (by Sindre Sorhus) from the App Store. It adds a <b>Find Workouts</b> action to Shortcuts, which can read your Apple Health workouts.</li>
            <li>Open <b>Shortcuts</b> → <b>+</b> → name it <b>GymXP</b>.</li>
            <li>Add <b>Find Workouts</b> (Actions app): sort by <b>start date, latest first</b>, limit <b>1</b>. Allow Health access when asked.</li>
            <li>Add a <b>Text</b> action and type the line below. Replace each [bracket] by tapping the workout variable and picking its <b>Duration</b>, <b>Active Energy</b>, <b>Average Heart Rate</b> and <b>Start Date</b> (format the date as HH:mm):
              <div className="code" style={{ marginTop: 6 }}>dur=[Duration] kcal=[Active Energy] hr=[Average Heart Rate] start=[Start Date]</div>
            </li>
            <li>Add <b>Copy to Clipboard</b>.</li>
            <li>After the gym: run the Shortcut (or ask Siri “GymXP”), open GymXP → Workout → ⌚ <b>Paste from Shortcut</b>.</li>
          </ol>
          <div className="notice small">
            <b>Alternative:</b> instead of Copy to Clipboard, use <b>Open URLs</b> with:
            <div className="code" style={{ marginTop: 6 }}>{appUrl}#/log?dur=[Duration]&kcal=[Active Energy]&hr=[Average Heart Rate]</div>
            <span className="muted">On iPhone this opens in Safari (not the home-screen app), which keeps its own login, so you'd set GymXP up in Safari too. The clipboard route avoids that.</span>
          </div>
          <p className="muted tiny">Duration can arrive as minutes, seconds or h:mm:ss; GymXP understands all of them. Plain text like “62 min 410 kcal 128 bpm” pastes fine too.</p>
        </div>
      )}
    </div>
  );
}

function SecurityCard() {
  const session = useSession();
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
        <button className="btn danger" onClick={() => setMode('wipe')}>Remove GymXP from this device…</button>
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
  const st = useStore();
  const data = st.data;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gymxp-backup-${today()}.json`;
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
      toast('That file is not a GymXP backup');
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
      <p className="tiny muted">Every save is a commit in your private repo, so GitHub keeps the full history of your data as a free backup.</p>
      <a className="btn tint" href="#/import"><Icon name="download" size={17} /> Import past workouts (from memory)</a>
      <div className="row-wrap">
        <button className="btn grow" onClick={() => void getStore().syncNow()}><Icon name="sync" size={16} /> Sync</button>
        <button className="btn grow" onClick={exportJson}><Icon name="download" size={16} /> Export</button>
        <label className="btn grow"><Icon name="upload" size={16} /> Import<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} /></label>
      </div>
    </div>
  );
}
