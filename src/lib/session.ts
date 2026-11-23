import { createContext, useContext } from 'react';
import type { Unlocked } from './vault';

/** Synced through the owner's GitHub repo, unlocked with a PIN (until roadmap A.6). */
export interface GithubSession {
  kind: 'github';
  unlocked: Unlocked;
  setUnlocked: (u: Unlocked) => Promise<void>;
  lock: () => void;
}

/** Signed in to a Bro account (roadmap A.4). The functions come from lib/account.ts, loaded on demand. */
export interface AccountSession {
  kind: 'account';
  email: string;
  changePassword: (current: string, next: string) => Promise<void>;
  newRecoveryKey: (password: string) => Promise<string>;
  signOut: () => Promise<void>;
}

export type SessionCtx = GithubSession | AccountSession;

export const Session = createContext<SessionCtx | null>(null);

export function useSession(): SessionCtx {
  const s = useContext(Session);
  if (!s) throw new Error('No session');
  return s;
}
