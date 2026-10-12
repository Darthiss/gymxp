import { createContext, useContext } from 'react';
import type { Unlocked } from './vault';

export interface SessionCtx {
  unlocked: Unlocked;
  setUnlocked: (u: Unlocked) => Promise<void>;
  lock: () => void;
}

export const Session = createContext<SessionCtx | null>(null);

export function useSession(): SessionCtx {
  const s = useContext(Session);
  if (!s) throw new Error('No session');
  return s;
}
