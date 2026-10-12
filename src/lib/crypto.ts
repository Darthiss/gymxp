// WebCrypto helpers: PBKDF2-SHA256 key derivation + AES-256-GCM.
export const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation for PBKDF2-SHA256

export interface Sealed {
  iv: string;
  ct: string;
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const utf8ToB64 = (text: string) => bytesToB64(new TextEncoder().encode(text));
export const b64ToUtf8 = (b64: string) => new TextDecoder().decode(b64ToBytes(b64));

export function randomB64(n: number): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(n)));
}

export async function deriveKey(passphrase: string, saltB64: string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(saltB64), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the raw key can never be read back out, even by our own JS
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(sealed.iv) }, key, b64ToBytes(sealed.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
