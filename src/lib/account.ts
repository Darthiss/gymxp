// Accounts on Supabase (roadmap A.4): create, sign in, reset and change, built on
// lib/e2e.ts. Supabase only ever sees the derived `login`, never the password, and the
// data key stays on this phone as a non-extractable key in IndexedDB.
// Loaded on demand (App imports it dynamically), so GitHub users never download it.
import { sb, supabaseRemote } from './supabase';
import {
  createAccountKeys,
  isRecoveryKey,
  openWithPassword,
  openWithPasswordKeys,
  openWithRecovery,
  passwordKeys,
  replaceRecoveryKey,
  rewrapPassword,
  sealedRemote,
  WrongKeyError,
  type KeyBundle,
} from './e2e';
import { PBKDF2_ITERATIONS } from './crypto';
import { CACHE_KEY, forgetKey } from './vault';
import type { Remote } from './remote';

export interface Account {
  userId: string;
  email: string;
  dataKey: CryptoKey;
}

export const MIN_PASSWORD = 12;

export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters. The strong password iPhone suggests is perfect.`;
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "Don't use your email as the password.";
  return null;
}

const clean = (email: string) => email.trim().toLowerCase();

/** The Remote for this account: Supabase underneath, everything sealed with the data key. */
export const remoteFor = (a: Account): Remote => sealedRemote(supabaseRemote(a.userId), a.dataKey);

// ---- this phone's copy of the key ----

const DB = 'bro-account';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => { resolve(req.result as T); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
  });
}
const saveDevice = (a: Account) => kv('readwrite', (s) => s.put(a, 'me'));
async function loadDevice(): Promise<Account | null> {
  try {
    return (await kv<Account | undefined>('readonly', (s) => s.get('me'))) ?? null;
  } catch {
    return null;
  }
}
async function forgetDevice() {
  try {
    await kv('readwrite', (s) => s.delete('me'));
  } catch { /* nothing stored */ }
}

// ---- the keys row ----

async function keysOf(userId: string): Promise<KeyBundle | null> {
  const { data, error } = await sb().from('vaults').select('keys').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(friendly(error.message));
  return (data?.keys as KeyBundle | undefined) ?? null;
}

async function saveKeys(userId: string, bundle: KeyBundle) {
  const { error } = await sb().from('vaults').update({ keys: bundle }).eq('user_id', userId);
  if (error) throw new Error(friendly(error.message));
}

async function firstKeys(userId: string, email: string, password: string) {
  return storeKeys(userId, email, await createAccountKeys(email, password));
}

async function storeKeys(userId: string, email: string, acc: Awaited<ReturnType<typeof createAccountKeys>>) {
  const { error } = await sb().from('vaults').insert({ user_id: userId, keys: acc.bundle });
  if (error) throw new Error(friendly(error.message));
  const account = { userId, email, dataKey: acc.dataKey };
  await saveDevice(account);
  return { account, recoveryKey: acc.recoveryKey };
}

function friendly(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already exists/i.test(m)) return "There's already an account with this email. Sign in instead.";
  if (/guest list/i.test(m)) return m;
  if (/signups? not allowed|signup.*disabled/i.test(m)) return 'New accounts are closed right now. Ask whoever invited you.';
  if (/expired|invalid.*(otp|token)|(otp|token).*invalid/i.test(m)) return 'That code is wrong or has expired. Ask for a new one.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a few minutes and try again.';
  if (/failed to fetch|network|load failed/i.test(m)) return "No connection. Try again when you're online.";
  if (/same.*password|different from the old/i.test(m)) return 'Pick a password you haven\'t used here before.';
  return m;
}

// ---- what the screens call ----

/** A new account. Show the recovery key before opening the app: it's never shown again. */
export async function createAccount(emailIn: string, password: string): Promise<{ account: Account; recoveryKey: string }> {
  const email = clean(emailIn);
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(problem);
  const acc = await createAccountKeys(email, password);
  const { data, error } = await sb().auth.signUp({ email, password: acc.login });
  if (error) throw new Error(friendly(error.message));
  if (!data.session || !data.user) throw new Error('The account was created but needs a confirmation email, which Bro doesn\'t use. Turn off "Confirm email" in Supabase, then sign in.');
  return storeKeys(data.user.id, email, acc);
}

/** Returns a recovery key too when the account existed but its keys were never saved (sign-up cut short). */
export async function signIn(emailIn: string, password: string): Promise<{ account: Account; recoveryKey?: string }> {
  const email = clean(emailIn);
  const keys = await passwordKeys(email, password);
  const { data, error } = await sb().auth.signInWithPassword({ email, password: keys.login });
  if (error) throw new Error(friendly(error.message));
  const userId = data.user.id;
  const bundle = await keysOf(userId);
  if (!bundle) return firstKeys(userId, email, password);
  let dataKey: CryptoKey;
  try {
    dataKey = bundle.iterations === PBKDF2_ITERATIONS ? await openWithPasswordKeys(bundle, keys) : await openWithPassword(bundle, email, password);
  } catch {
    await sb().auth.signOut({ scope: 'local' });
    throw new Error('Your password signed you in but didn\'t open your data. Use "Forgot password" with your recovery key.');
  }
  const account = { userId, email, dataKey };
  await saveDevice(account);
  return { account };
}

/** Emails a code for "Forgot password". */
export async function sendResetCode(emailIn: string) {
  const { error } = await sb().auth.resetPasswordForEmail(clean(emailIn));
  if (error) throw new Error(friendly(error.message));
}

/** The emailed code proves the email; the recovery key opens the data; the new password replaces the old. */
export async function resetPassword(emailIn: string, code: string, recoveryKey: string, password: string): Promise<{ account: Account; recoveryKey?: string }> {
  const email = clean(emailIn);
  // Check everything before using the code: a failed attempt after it would burn it.
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(problem);
  if (!isRecoveryKey(recoveryKey)) throw new Error("That isn't a recovery key. It's 8 groups of 4 letters and numbers.");
  const { data, error } = await sb().auth.verifyOtp({ email, token: code.replace(/\s/g, ''), type: 'recovery' });
  if (error || !data.user) throw new Error(friendly(error?.message ?? 'That code is wrong or has expired.'));
  const userId = data.user.id;
  const bundle = await keysOf(userId);
  if (!bundle) {
    const login = (await passwordKeys(email, password)).login;
    const { error: e } = await sb().auth.updateUser({ password: login });
    if (e) throw new Error(friendly(e.message));
    return firstKeys(userId, email, password);
  }
  let next: { bundle: KeyBundle; login: string };
  try {
    next = await rewrapPassword(bundle, { recoveryKey }, { email, password });
  } catch (e) {
    await sb().auth.signOut({ scope: 'local' });
    throw new Error(e instanceof WrongKeyError ? "That recovery key doesn't match this account." : String(e));
  }
  await saveKeys(userId, next.bundle);
  const { error: e2 } = await sb().auth.updateUser({ password: next.login });
  if (e2) throw new Error(friendly(e2.message));
  await sb().auth.signOut({ scope: 'others' });
  const account = { userId, email, dataKey: await openWithRecovery(next.bundle, recoveryKey) };
  await saveDevice(account);
  return { account };
}

/** Needs the current password: the key on this phone can never be read back out to wrap again. */
export async function changePassword(a: Account, current: string, password: string) {
  const problem = passwordProblem(password, a.email);
  if (problem) throw new Error(problem);
  const bundle = await keysOf(a.userId);
  if (!bundle) throw new Error('Your account has no keys yet. Sign out and in again.');
  let next: { bundle: KeyBundle; login: string };
  try {
    next = await rewrapPassword(bundle, { email: a.email, password: current }, { email: a.email, password });
  } catch (e) {
    throw new Error(e instanceof WrongKeyError ? 'Your current password is wrong.' : String(e));
  }
  await saveKeys(a.userId, next.bundle);
  const { error } = await sb().auth.updateUser({ password: next.login });
  if (error) throw new Error(friendly(error.message));
  await sb().auth.signOut({ scope: 'others' });
}

/** A new recovery key; the old one stops working. */
export async function newRecoveryKey(a: Account, password: string): Promise<string> {
  const bundle = await keysOf(a.userId);
  if (!bundle) throw new Error('Your account has no keys yet. Sign out and in again.');
  try {
    const next = await replaceRecoveryKey(bundle, a.email, password);
    await saveKeys(a.userId, next.bundle);
    return next.recoveryKey;
  } catch (e) {
    throw new Error(e instanceof WrongKeyError ? 'Wrong password.' : e instanceof Error ? e.message : String(e));
  }
}

/** The account this phone was signed in to, if it still is. Opens offline too. */
export async function resume(): Promise<Account | null> {
  const device = await loadDevice();
  if (!device) return null;
  const { data, error } = await sb().auth.getSession();
  if (error) return device; // most likely offline: open with what's on the phone, sync later
  if (data.session?.user.id === device.userId) return device;
  await forgetDevice();
  return null;
}

/** This phone forgets the account, the key and the cached data. The account keeps everything. */
export async function signOut() {
  try {
    await sb().auth.signOut({ scope: 'local' });
  } catch { /* offline: the local session is cleared anyway */ }
  await forgetDevice();
  await forgetKey();
  for (const k of [CACHE_KEY, 'gymxp:draft', 'gymxp:import']) localStorage.removeItem(k);
}
