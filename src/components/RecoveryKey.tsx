import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from './ui';

/** Shows a recovery key once, with a copy button and where to keep it. */
export function RecoveryKeyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast('Copy failed. Select the key and copy it by hand.');
    }
  };
  return (
    <div className="stack">
      <div className="recovery-key" aria-label="Recovery key">
        {value.split('-').map((g, i) => <span key={i}>{g}</span>)}
      </div>
      <button type="button" className="btn tint" onClick={copy}>
        <Icon name={copied ? 'check' : 'clipboard'} size={17} /> {copied ? 'Copied' : 'Copy the key'}
      </button>
      <ol className="steps-guide small">
        <li>Open the <b>Passwords</b> app, tap <b>+</b>, name it <b>Bro recovery key</b> and paste the key as the password.</li>
        <li>Keep a second copy away from this phone, such as on paper at home.</li>
      </ol>
      <p className="tiny muted">If you forget your password, this key and a code sent to your email get you back in. Without both, nobody can open your data, not even Bro.</p>
    </div>
  );
}
