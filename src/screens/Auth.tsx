import { useState } from 'react';
import { checkRepo, type GhConfig } from '../lib/github';
import { Ring } from '../components/ui';
import { Icon } from '../components/Icon';
import { createVault, failedAttempts, MAX_FAILS, unlock, wipeDevice, WrongPinError, type Unlocked } from '../lib/vault';

/** App mark: a dumbbell inside a level ring. */
function LogoMark({ locked }: { locked?: boolean }) {
  return (
    <div style={{ alignSelf: 'center' }}>
      <Ring pct={0.72} size={84} stroke={6} color="var(--accent)">
        <Icon name={locked ? 'lock' : 'dumbbell'} size={34} stroke={2.2} style={{ color: 'var(--accent)' }} />
      </Ring>
    </div>
  );
}

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const NEW_REPO_URL = 'https://github.com/new';

export function Setup({ onDone }: { onDone: (u: Unlocked) => void }) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('gymxp-data');
  const [token, setToken] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pin.length < 6) return setErr('Use a PIN/passphrase of at least 6 characters.');
    if (pin !== pin2) return setErr('PINs do not match.');
    const cfg: GhConfig = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return setErr('Fill in all GitHub fields.');
    setBusy(true);
    try {
      const info = await checkRepo(cfg);
      if (!info.isPrivate) {
        setBusy(false);
        return setErr(`"${info.fullName}" is PUBLIC. Your gym data would be visible to everyone. Make it private (repo Settings → Danger Zone → Change visibility) and try again.`);
      }
      if (!info.canPush) {
        setBusy(false);
        return setErr('The token can read but not write. Give it "Contents: Read and write" permission.');
      }
      onDone(await createVault(pin, cfg));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-box stack-lg" onSubmit={submit}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark />
          <div className="logo">Gym<span>XP</span></div>
          <p className="dim">Level up at the gym. One-time setup for this device.</p>
        </div>

        <div className="card stack">
          <h2 className="row" style={{ gap: 10 }}><span className="xp-chip">1</span>Where your data lives</h2>
          <ol className="steps-guide small">
            <li>
              <a href={NEW_REPO_URL} target="_blank" rel="noopener noreferrer">Create a new repository</a> named <b>gymxp-data</b>, set to <b>Private</b>. Leave it empty.
            </li>
            <li>
              <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">Create a fine-grained token</a>: <b>Repository access → Only select repositories → gymxp-data</b>, <b>Permissions → Contents: Read and write</b>. Pick an expiration (e.g. 1 year).
            </li>
            <li>Paste it below. It is encrypted with your PIN and never leaves this device except to talk to GitHub.</li>
          </ol>
          <label className="field">
            GitHub username
            <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" />
          </label>
          <label className="field">
            Data repository
            <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="field">
            Fine-grained token
            <input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} />
          </label>
        </div>

        <div className="card stack">
          <h2 className="row" style={{ gap: 10 }}><span className="xp-chip">2</span>Lock it with a PIN</h2>
          <p className="small dim">
            You'll enter it when the app is locked. Use 6+ characters; a passphrase is stronger than digits. After {MAX_FAILS} wrong tries this device forgets the token (your data stays safe on GitHub).
          </p>
          <label className="field">
            PIN or passphrase
            <input className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">
            Repeat it
            <input className="input" type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} autoComplete="new-password" />
          </label>
        </div>

        {err && <div className="notice bad">{err}</div>}
        <button className="btn primary big block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Connect & start'}
        </button>
      </form>
    </div>
  );
}

export function Unlock({ onDone }: { onDone: (u: Unlocked) => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(() => {
    const f = failedAttempts();
    return f ? `${MAX_FAILS - f} attempts left before this device is wiped.` : '';
  });
  const [confirmReset, setConfirmReset] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    setErr('');
    try {
      onDone(await unlock(pin));
    } catch (e) {
      setBusy(false);
      setPin('');
      if (e instanceof WrongPinError && e.remaining === 0) {
        location.reload();
        return;
      }
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-box stack-lg" onSubmit={submit}>
        <div className="center stack" style={{ gap: 6 }}>
          <LogoMark locked />
          <div className="logo">Gym<span>XP</span></div>
          <p className="small dim">Enter your PIN to continue</p>
        </div>
        <input
          className="input pin-input"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoFocus
          autoComplete="current-password"
          aria-label="PIN or passphrase"
        />
        {err && <div className="notice bad small">{err}</div>}
        <button className="btn primary big block" disabled={busy || !pin}>
          {busy ? <span className="spinner" /> : 'Unlock'}
        </button>
        <div className="center">
          {!confirmReset ? (
            <button type="button" className="btn ghost sm muted" onClick={() => setConfirmReset(true)}>
              Forgot PIN?
            </button>
          ) : (
            <div className="notice stack small">
              <span>This removes the token from this device so you can set it up again. Your workouts are safe in your GitHub repo.</span>
              <button
                type="button"
                className="btn danger sm"
                onClick={async () => {
                  await wipeDevice();
                  location.reload();
                }}
              >
                Reset this device
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
