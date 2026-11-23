// Create account, sign in and forgot password (roadmap A.4). Loaded on demand, so the
// Supabase client only downloads for people who use an account.
import { useState } from 'react';
import { DISCLAIMER } from '../lib/body';
import { createAccount, MIN_PASSWORD, resetPassword, sendResetCode, signIn, type Account } from '../lib/account';
import { RecoveryKeyBox } from '../components/RecoveryKey';
import { PrivacyText } from '../components/Privacy';
import { LogoMark } from './Auth';

type View =
  | { kind: 'welcome' }
  | { kind: 'privacy' }
  | { kind: 'create' }
  | { kind: 'signin' }
  | { kind: 'forgot'; sent: boolean }
  | { kind: 'save-key'; account: Account; recoveryKey: string };

export default function AccountGate({ onOpen, onGithub }: { onOpen: (a: Account) => void; onGithub: () => void }) {
  const [view, setView] = useState<View>({ kind: 'welcome' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = (v: View) => {
    setErr('');
    setPassword('');
    setView(v);
  };
  const run = async (fn: () => Promise<void>) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const done = (r: { account: Account; recoveryKey?: string }) =>
    r.recoveryKey ? go({ kind: 'save-key', account: r.account, recoveryKey: r.recoveryKey }) : onOpen(r.account);

  const emailField = (
    <label className="field">
      Email
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
    </label>
  );
  const back = (
    <div className="center">
      <button type="button" className="btn ghost sm muted" onClick={() => go({ kind: 'welcome' })}>Back</button>
    </div>
  );
  const submit = (label: string, wait: string) => (
    <button className="btn primary big block" disabled={busy}>
      {busy ? <><span className="spinner" /> {wait}</> : label}
    </button>
  );
  const error = err && <div className="notice bad small">{err}</div>;

  let body: React.ReactNode;
  if (view.kind === 'welcome') {
    body = (
      <div className="stack-lg">
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">Your gym bro, in your pocket.</p>
        </div>
        <div className="stack">
          <button className="btn primary big block" onClick={() => go({ kind: 'create' })}>Create account</button>
          <button className="btn big block" onClick={() => go({ kind: 'signin' })}>Sign in</button>
        </div>
        <p className="small dim center" style={{ lineHeight: 1.5 }}>
          Invite only for now. Your log is locked on this phone before it's uploaded, so only you can read it.{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); go({ kind: 'privacy' }); }}>How it stays private</a>
        </p>
        <div className="center">
          <button type="button" className="btn ghost sm muted" onClick={onGithub}>Use a GitHub repo instead</button>
        </div>
      </div>
    );
  } else if (view.kind === 'privacy') {
    body = (
      <div className="stack-lg">
        <h1 className="center">Privacy</h1>
        <PrivacyText />
        {back}
      </div>
    );
  } else if (view.kind === 'create') {
    body = (
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); void run(async () => done(await createAccount(email, password))); }}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">Create your account</p>
        </div>
        <div className="card stack">
          {emailField}
          <label className="field">
            Password
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </label>
          <p className="tiny muted">At least {MIN_PASSWORD} characters. Let iPhone suggest a strong one and save it for you. It also locks your data, so nobody else can read it.</p>
        </div>
        {error}
        {submit('Create account', 'Locking your data…')}
        {back}
        <p className="tiny muted center" style={{ lineHeight: 1.5 }}>{DISCLAIMER}</p>
      </form>
    );
  } else if (view.kind === 'signin') {
    body = (
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); void run(async () => done(await signIn(email, password))); }}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">Welcome back</p>
        </div>
        <div className="card stack">
          {emailField}
          <label className="field">
            Password
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
        </div>
        {error}
        {submit('Sign in', 'Opening your data…')}
        <div className="center">
          <button type="button" className="btn ghost sm" onClick={() => go({ kind: 'forgot', sent: false })}>Forgot password?</button>
        </div>
        {back}
      </form>
    );
  } else if (view.kind === 'forgot' && !view.sent) {
    body = (
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); void run(async () => { await sendResetCode(email); go({ kind: 'forgot', sent: true }); }); }}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">Forgot your password</p>
        </div>
        <div className="card stack">
          <p className="small dim">You'll need two things: a code we email you, and your recovery key from when you created the account.</p>
          {emailField}
        </div>
        {error}
        {submit('Email me a code', 'Sending…')}
        {back}
      </form>
    );
  } else if (view.kind === 'forgot') {
    body = (
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); void run(async () => done(await resetPassword(email, code, recovery, password))); }}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">Set a new password</p>
        </div>
        <div className="card stack">
          <p className="small dim">We sent a code to <b>{email}</b>. It can take a minute; check spam too.</p>
          <input type="email" value={email} autoComplete="username" readOnly hidden />
          <label className="field">
            Code from the email
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <label className="field">
            Recovery key
            <input className="input mono" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="XXXX-XXXX-…" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" required />
          </label>
          <label className="field">
            New password
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </label>
        </div>
        {error}
        {submit('Save and sign in', 'Opening your data…')}
        <div className="center">
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run(async () => { await sendResetCode(email); setErr(''); })}>Send a new code</button>
        </div>
        {back}
      </form>
    );
  } else {
    const { account, recoveryKey } = view;
    body = (
      <div className="stack-lg">
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <p className="dim">One last thing: your recovery key</p>
        </div>
        <div className="card stack">
          <RecoveryKeyBox value={recoveryKey} />
        </div>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span className="small">I saved it somewhere safe</span>
        </label>
        <button className="btn primary big block" disabled={!saved} onClick={() => onOpen(account)}>Start</button>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">{body}</div>
    </div>
  );
}
