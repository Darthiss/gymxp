// The "vault" holds the GitHub token + repo, encrypted with a key derived from your PIN.
// Nothing sensitive is ever stored in plain text on the device.
import { deriveKey, PBKDF2_ITERATIONS, randomB64, seal, unseal, type Sealed } from './crypto';
import type { GhConfig } from './github';

const VAULT_KEY = 'gymxp:vault';
const FAILS_KEY = 'gymxp:fails';
const AUTOLOCK_KEY = 'gymxp:autolock';
export const CACHE_KEY = 'gymxp:cache';
export const MAX_FAILS = 10;

interface StoredVault extends Sealed {
  v: 1;
  salt: string;
  iter: number;
}

export interface Unlocked {
  key: CryptoKey;
  cfg: GhConfig;
}

function readVault(): StoredVault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? (JSON.parse(raw) as StoredVault) : null;
  } catch {
    return null;
  }
}

export const hasVault = () => readVault() !== null;

export async function createVault(pin: string, cfg: GhConfig): Promise<Unlocked> {
  const salt = randomB64(16);
  const key = await deriveKey(pin, salt);
  const sealed = await seal(key, cfg);
  const v: StoredVault = { v: 1, salt, iter: PBKDF2_ITERATIONS, ...sealed };
  localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  localStorage.removeItem(FAILS_KEY);
  await rememberKey(key);
  return { key, cfg };
}

export class WrongPinError extends Error {
  constructor(readonly remaining: number) {
    super(remaining > 0 ? `Wrong PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left before this device is wiped.` : 'Too many wrong attempts. This device was wiped.');
  }
}

export function failedAttempts(): number {
  return Number(localStorage.getItem(FAILS_KEY) ?? 0) || 0;
}

export async function unlock(pin: string): Promise<Unlocked> {
  const v = readVault();
  if (!v) throw new Error('No vault on this device');
  const key = await deriveKey(pin, v.salt, v.iter);
  try {
    const cfg = await unseal<GhConfig>(key, v);
    localStorage.removeItem(FAILS_KEY);
    await rememberKey(key);
    return { key, cfg };
  } catch {
    const fails = failedAttempts() + 1;
    if (fails >= MAX_FAILS) {
      await wipeDevice();
      throw new WrongPinError(0);
    }
    localStorage.setItem(FAILS_KEY, String(fails));
    throw new WrongPinError(MAX_FAILS - fails);
  }
}

export async function changePin(current: Unlocked, newPin: string): Promise<Unlocked> {
  const next = await createVault(newPin, current.cfg);
  return next;
}

export async function updateConfig(current: Unlocked, cfg: GhConfig): Promise<Unlocked> {
  const v = readVault();
  if (!v) throw new Error('No vault');
  const sealed = await seal(current.key, cfg);
  localStorage.setItem(VAULT_KEY, JSON.stringify({ ...v, ...sealed }));
  return { key: current.key, cfg };
}

export async function wipeDevice(): Promise<void> {
  for (const k of [VAULT_KEY, FAILS_KEY, CACHE_KEY, 'gymxp:draft', 'gymxp:import']) localStorage.removeItem(k);
  await forgetKey();
}

// ---------- Auto-lock: keep the (non-extractable) key in IndexedDB for a while ----------

export const AUTOLOCK_OPTIONS = [
  { min: 0, label: 'Every time I open the app' },
  { min: 15, label: 'After 15 minutes' },
  { min: 60, label: 'After 1 hour' },
  { min: 480, label: 'After 8 hours' },
  { min: 1440 * 7, label: 'After 7 days' },
];

export function getAutolockMin(): number {
  const v = localStorage.getItem(AUTOLOCK_KEY);
  return v === null ? 480 : Number(v);
}
export function setAutolockMin(min: number) {
  localStorage.setItem(AUTOLOCK_KEY, String(min));
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gymxp', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbOp<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => { resolve(req.result as T); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
  });
}

interface KeyEntry { key: CryptoKey; expires: number }

async function rememberKey(key: CryptoKey) {
  const min = getAutolockMin();
  if (min <= 0) return forgetKey();
  try {
    await idbOp('readwrite', (s) => s.put({ key, expires: Date.now() + min * 60_000 } satisfies KeyEntry, 'key'));
  } catch { /* private mode etc. – just ask for the PIN next time */ }
}

/** Slide the auto-lock window forward while the app is in use. */
export async function touchKey(key: CryptoKey) {
  await rememberKey(key);
}

export async function forgetKey() {
  try {
    await idbOp('readwrite', (s) => s.delete('key'));
  } catch { /* ignore */ }
}

/** Resume without asking for the PIN if the auto-lock window hasn't expired. */
export async function tryResume(): Promise<Unlocked | null> {
  const v = readVault();
  if (!v) return null;
  try {
    const e = await idbOp<KeyEntry | undefined>('readonly', (s) => s.get('key'));
    if (!e || e.expires < Date.now()) {
      await forgetKey();
      return null;
    }
    const cfg = await unseal<GhConfig>(e.key, v);
    return { key: e.key, cfg };
  } catch {
    return null;
  }
}
