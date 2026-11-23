// End-to-end encryption for accounts (roadmap A.3). Each person has one random data key
// that seals everything uploaded. The server only ever stores:
//   - the data and photos, sealed with the data key, and
//   - a KeyBundle: the data key wrapped twice, once by a key from the password and once
//     by the recovery key.
// The password itself never leaves the phone. PBKDF2 turns it into a master secret, and
// HKDF splits that into two unrelated values: `login`, which is what Supabase sees as the
// password, and the key that wraps the data key. Bitwarden is built the same way.
import { b64ToBytes, bytesToB64, PBKDF2_ITERATIONS } from './crypto';
import type { Remote } from './remote';

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Wrapped {
  iv: string;
  ct: string;
}

export interface KeyBundle {
  v: 1;
  iterations: number; // PBKDF2 rounds used for the password, so they can grow later
  byPassword: Wrapped;
  byRecovery: Wrapped;
}

/** The password, the email or the recovery key didn't open the bundle. */
export class WrongKeyError extends Error {}

// ---- from the password ----

/** The email salts the password, so the same password gives different keys for different people. */
const saltFor = (email: string) => enc.encode(`bro e2e v1|${email.trim().toLowerCase()}`);

async function hkdf(ikm: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

const wrapKeyFrom = (base: CryptoKey, salt: Uint8Array<ArrayBuffer>, info: string) =>
  crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );

export interface PasswordKeys {
  /** What Supabase checks as the password. It can't be turned back into the password or the wrap key. */
  login: string;
  wrap: CryptoKey;
}

export async function passwordKeys(email: string, password: string, iterations = PBKDF2_ITERATIONS): Promise<PasswordKeys> {
  const salt = saltFor(email);
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const master = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256));
  const base = await hkdf(master);
  const login = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('bro login') }, base, 256),
  );
  master.fill(0);
  return { login: bytesToB64(login), wrap: await wrapKeyFrom(base, salt, 'bro wrap') };
}

// ---- the recovery key ----

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_BYTES = 20; // 160 bits: 32 characters, shown as 8 groups of 4

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

function fromBase32(text: string): Uint8Array<ArrayBuffer> | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== (RECOVERY_BYTES * 8) / 5) return null;
  const out = new Uint8Array(RECOVERY_BYTES);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const ch of clean) {
    const d = CROCKFORD.indexOf(ch);
    if (d < 0) return null;
    value = ((value << 5) | d) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out[i++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return out;
}

/** A new recovery key, formatted for people: 8 groups of 4 characters. */
export function newRecoveryKey(): string {
  const raw = toBase32(crypto.getRandomValues(new Uint8Array(RECOVERY_BYTES)));
  return raw.match(/.{4}/g)!.join('-');
}

/** Accepts the key however it was saved: any case, with or without dashes or spaces, O for 0, I or L for 1. */
export const isRecoveryKey = (text: string) => fromBase32(text) !== null;

async function recoveryWrapKey(recoveryKey: string): Promise<CryptoKey> {
  const raw = fromBase32(recoveryKey);
  if (!raw) throw new WrongKeyError('That recovery key is not the right length');
  // 160 random bits need no slow hashing: there's nothing to guess.
  return wrapKeyFrom(await hkdf(raw), new Uint8Array(0), 'bro recovery');
}

// ---- wrapping the data key ----

async function wrap(dataKey: CryptoKey, by: CryptoKey): Promise<Wrapped> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.wrapKey('raw', dataKey, by, { name: 'AES-GCM', iv });
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

async function unwrap(w: Wrapped, by: CryptoKey, extractable: boolean): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey('raw', b64ToBytes(w.ct), by, { name: 'AES-GCM', iv: b64ToBytes(w.iv) }, { name: 'AES-GCM', length: 256 }, extractable, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    throw new WrongKeyError('Wrong password or recovery key');
  }
}

// ---- what the account screens call ----

export interface NewAccount {
  bundle: KeyBundle;
  login: string;
  recoveryKey: string;
  /** Non-extractable: it can seal and open, but never be read back out, even by the app. */
  dataKey: CryptoKey;
}

export async function createAccountKeys(email: string, password: string, iterations = PBKDF2_ITERATIONS): Promise<NewAccount> {
  const extractable = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const { login, wrap: byPassword } = await passwordKeys(email, password, iterations);
  const recoveryKey = newRecoveryKey();
  const bundle: KeyBundle = {
    v: 1,
    iterations,
    byPassword: await wrap(extractable, byPassword),
    byRecovery: await wrap(extractable, await recoveryWrapKey(recoveryKey)),
  };
  // Keep only a non-extractable copy from here on.
  const dataKey = await unwrap(bundle.byPassword, byPassword, false);
  return { bundle, login, recoveryKey, dataKey };
}

/** Sign-in: open the data key with the password (the `login` part is checked by Supabase first). */
export async function openWithPassword(bundle: KeyBundle, email: string, password: string): Promise<CryptoKey> {
  const { wrap: by } = await passwordKeys(email, password, bundle.iterations);
  return unwrap(bundle.byPassword, by, false);
}

/** The same, when sign-in already derived the password keys (saves a second slow PBKDF2). */
export function openWithPasswordKeys(bundle: KeyBundle, keys: PasswordKeys): Promise<CryptoKey> {
  return unwrap(bundle.byPassword, keys.wrap, false);
}

export async function openWithRecovery(bundle: KeyBundle, recoveryKey: string): Promise<CryptoKey> {
  return unwrap(bundle.byRecovery, await recoveryWrapKey(recoveryKey), false);
}

export type Unlock = { email: string; password: string } | { recoveryKey: string };

async function extractableKey(bundle: KeyBundle, using: Unlock): Promise<CryptoKey> {
  if ('recoveryKey' in using) return unwrap(bundle.byRecovery, await recoveryWrapKey(using.recoveryKey), true);
  const { wrap: by } = await passwordKeys(using.email, using.password, bundle.iterations);
  return unwrap(bundle.byPassword, by, true);
}

/**
 * A new password or email: open the data key with the current password (or, when it's
 * forgotten, the recovery key) and wrap it again. The recovery key stays as it was.
 * Save `login` to Supabase as the new password, and the bundle with the account.
 */
export async function rewrapPassword(
  bundle: KeyBundle,
  using: Unlock,
  next: { email: string; password: string },
  iterations = PBKDF2_ITERATIONS,
): Promise<{ bundle: KeyBundle; login: string }> {
  const key = await extractableKey(bundle, using);
  const { login, wrap: by } = await passwordKeys(next.email, next.password, iterations);
  return { bundle: { ...bundle, iterations, byPassword: await wrap(key, by) }, login };
}

/** A new recovery key, for when the old one is lost or seen. The old one stops working. */
export async function replaceRecoveryKey(bundle: KeyBundle, email: string, password: string): Promise<{ bundle: KeyBundle; recoveryKey: string }> {
  const key = await extractableKey(bundle, { email, password });
  const recoveryKey = newRecoveryKey();
  return { bundle: { ...bundle, byRecovery: await wrap(key, await recoveryWrapKey(recoveryKey)) }, recoveryKey };
}

// ---- sealing what's uploaded ----

// The purpose is authenticated with each item, so a sealed photo can't be passed off as the data.
const aad = (purpose: string) => enc.encode(`bro ${purpose}`);
const VERSION = 1;

export async function sealBytes(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>, purpose: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(purpose) }, key, bytes));
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return out;
}

export async function openBytes(key: CryptoKey, sealed: Uint8Array<ArrayBuffer>, purpose: string): Promise<Uint8Array<ArrayBuffer>> {
  if (sealed[0] !== VERSION) throw new Error('Unknown format');
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(1, 13), additionalData: aad(purpose) }, key, sealed.subarray(13)),
    );
  } catch {
    throw new WrongKeyError('This data was sealed with a different key, or changed');
  }
}

/** Wraps another Remote so everything it stores is sealed with the data key, and opened again on the way back. */
export function sealedRemote(inner: Remote, dataKey: CryptoKey): Remote {
  return {
    async load() {
      const got = await inner.load();
      if (!got) return null;
      const bytes = await openBytes(dataKey, b64ToBytes(got.text), 'data');
      return { text: dec.decode(bytes), version: got.version };
    },
    async save(text, version, message) {
      const sealed = await sealBytes(dataKey, enc.encode(text), 'data');
      return inner.save(bytesToB64(sealed), version, message);
    },
    async putFile(path, file) {
      const sealed = await sealBytes(dataKey, new Uint8Array(await file.arrayBuffer()), `file ${path}`);
      await inner.putFile(path, new Blob([sealed]));
    },
    async getFile(path) {
      const blob = await inner.getFile(path);
      if (!blob) return null;
      return new Blob([await openBytes(dataKey, new Uint8Array(await blob.arrayBuffer()), `file ${path}`)], { type: 'image/jpeg' });
    },
  };
}
