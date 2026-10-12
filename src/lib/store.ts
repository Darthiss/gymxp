// App data store: encrypted local cache for instant/offline use + sync to data.json
// in the private GitHub repo. Concurrent edits from two devices are merged per record.
import { useSyncExternalStore } from 'react';
import { seal, unseal, bytesToB64, type Sealed } from './crypto';
import { ConflictError, AuthError, getBinaryFile, getTextFile, putFile, putTextFile, type GhConfig } from './github';
import { mergeData, normalizeData } from './merge';
import { emptyData, type AppData } from './types';
import { CACHE_KEY, touchKey } from './vault';
import { uid } from './util';

const DATA_PATH = 'data.json';
const DRAFT_KEY = 'gymxp:draft';
export const IMPORT_DRAFT_KEY = 'gymxp:import';

export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

export interface StoreState {
  data: AppData;
  status: SyncStatus;
  error?: string;
  dirty: boolean;
  lastSync?: number;
  ready: boolean;
}

interface CachePayload {
  data: AppData;
  sha?: string;
  dirty: boolean;
  lastSync?: number;
}

export class Store {
  private state: StoreState = { data: emptyData(), status: 'loading', dirty: false, ready: false };
  private listeners = new Set<() => void>();
  private sha?: string;
  private version = 0; // bumps on every local edit
  private pushTimer?: number;
  private pushing = false;
  private pendingMessages: string[] = [];
  private photoCache = new Map<string, Promise<string>>();
  private lastPull = 0;
  private disposed = false;

  constructor(private key: CryptoKey, private cfg: GhConfig) {}

  // ---- subscription ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  get config() {
    return this.cfg;
  }

  // ---- lifecycle ----
  async open() {
    const cached = await this.readCache();
    if (cached) {
      this.sha = cached.sha;
      this.set({ data: normalizeData(cached.data), dirty: cached.dirty, lastSync: cached.lastSync, ready: true });
    }
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
    await this.pull();
    this.set({ ready: true });
  }

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.pushTimer);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.photoCache.forEach((p) => p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
  }

  private onOnline = () => {
    if (this.state.dirty) this.schedulePush(0);
    else void this.pull();
  };

  private onVisible = () => {
    if (document.visibilityState !== 'visible' || this.disposed) return;
    void touchKey(this.key);
    if (Date.now() - this.lastPull > 15_000) void this.pull();
  };

  /** Replace the encryption key (after a PIN change) and re-encrypt the cache. */
  async rekey(key: CryptoKey, cfg: GhConfig) {
    const drafts = await Promise.all([DRAFT_KEY, IMPORT_DRAFT_KEY].map(async (k) => [k, await this.loadDraft(k)] as const));
    this.key = key;
    this.cfg = cfg;
    await this.writeCache();
    for (const [k, d] of drafts) if (d) await this.saveDraft(d, k);
  }

  // ---- cache ----
  private async readCache(): Promise<CachePayload | null> {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return await unseal<CachePayload>(this.key, JSON.parse(raw) as Sealed);
    } catch {
      return null;
    }
  }

  private async writeCache() {
    try {
      const payload: CachePayload = { data: this.state.data, sha: this.sha, dirty: this.state.dirty, lastSync: this.state.lastSync };
      localStorage.setItem(CACHE_KEY, JSON.stringify(await seal(this.key, payload)));
    } catch (e) {
      console.warn('cache write failed', e);
    }
  }

  // ---- edits ----
  /** Apply a change. The mutator gets a deep copy it can modify freely. */
  update(mutator: (d: AppData) => void, message = 'Update') {
    const next = structuredClone(this.state.data);
    mutator(next);
    this.version++;
    this.pendingMessages.push(message);
    this.set({ data: next, dirty: true });
    void this.writeCache();
    void touchKey(this.key);
    this.schedulePush(1200);
  }

  private schedulePush(ms: number) {
    window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => void this.push(), ms);
  }

  async syncNow() {
    if (this.state.dirty) await this.push();
    else await this.pull();
  }

  // ---- remote ----
  async pull() {
    if (this.pushing) return;
    this.lastPull = Date.now();
    if (!this.state.ready) this.set({ status: 'loading' });
    const v0 = this.version;
    try {
      const remote = await getTextFile(this.cfg, DATA_PATH);
      if (!remote) {
        // First run against an empty repo: create the file.
        this.sha = undefined;
        this.set({ dirty: true });
        await this.push(true);
        return;
      }
      const remoteData = normalizeData(JSON.parse(remote.text));
      if (this.state.dirty || this.version !== v0) {
        // Local edits exist (possibly made while we were fetching): merge, never overwrite.
        this.sha = remote.sha;
        this.set({ data: mergeData(this.state.data, remoteData) });
        await this.push(true);
      } else {
        this.sha = remote.sha;
        this.set({ data: remoteData, status: 'synced', error: undefined, lastSync: Date.now() });
        await this.writeCache();
      }
    } catch (e) {
      this.handleError(e);
    }
  }

  private async push(force = false, attempt = 0): Promise<void> {
    if (this.pushing && !force) {
      this.schedulePush(800);
      return;
    }
    this.pushing = true;
    window.clearTimeout(this.pushTimer);
    const versionAtStart = this.version;
    const msgs = [...new Set(this.pendingMessages)];
    const message = msgs.length ? msgs.slice(0, 5).join('; ') + (msgs.length > 5 ? ` (+${msgs.length - 5} more)` : '') : 'Sync';
    this.set({ status: 'saving' });
    try {
      const text = JSON.stringify(this.state.data);
      this.sha = await putTextFile(this.cfg, DATA_PATH, text, message, this.sha);
      this.pendingMessages = this.pendingMessages.slice(msgs.length);
      const stillDirty = this.version !== versionAtStart;
      this.set({ dirty: stillDirty, status: 'synced', error: undefined, lastSync: Date.now() });
      await this.writeCache();
      this.pushing = false;
      if (stillDirty) this.schedulePush(500);
    } catch (e) {
      this.pushing = false;
      if (e instanceof ConflictError && attempt < 3) {
        // Someone (another device) changed data.json: fetch, merge, retry.
        try {
          const remote = await getTextFile(this.cfg, DATA_PATH);
          if (remote) {
            this.sha = remote.sha;
            this.set({ data: mergeData(this.state.data, normalizeData(JSON.parse(remote.text))) });
          }
          return this.push(true, attempt + 1);
        } catch (e2) {
          this.handleError(e2);
          return;
        }
      }
      this.handleError(e);
    }
  }

  private handleError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = !navigator.onLine || (e as { status?: number })?.status === 0;
    this.set({ status: offline ? 'offline' : 'error', error: offline ? undefined : msg, ready: true });
    if (e instanceof AuthError) return; // don't retry with a bad token
    if (this.state.dirty && !this.disposed) this.schedulePush(30_000);
  }

  // ---- in-progress workout draft (encrypted, this device only) ----
  async saveDraft(draft: unknown | null, slot = DRAFT_KEY) {
    try {
      if (draft === null) localStorage.removeItem(slot);
      else localStorage.setItem(slot, JSON.stringify(await seal(this.key, draft)));
    } catch { /* ignore */ }
  }

  async loadDraft<T>(slot = DRAFT_KEY): Promise<T | null> {
    try {
      const raw = localStorage.getItem(slot);
      return raw ? await unseal<T>(this.key, JSON.parse(raw) as Sealed) : null;
    } catch {
      return null;
    }
  }

  // ---- photos ----
  async uploadPhoto(file: Blob): Promise<string> {
    const jpeg = await downscaleJpeg(file, 1280, 0.8);
    const path = `photos/${uid()}.jpg`;
    const b64 = bytesToB64(new Uint8Array(await jpeg.arrayBuffer()));
    await putFile(this.cfg, path, b64, 'Add exercise photo');
    this.photoCache.set(path, Promise.resolve(URL.createObjectURL(jpeg)));
    return path;
  }

  photoUrl(path: string): Promise<string> {
    let p = this.photoCache.get(path);
    if (!p) {
      p = getBinaryFile(this.cfg, path).then((b) => {
        if (!b) throw new Error('Photo not found');
        return URL.createObjectURL(b);
      });
      p.catch(() => this.photoCache.delete(path));
      this.photoCache.set(path, p);
    }
    return p;
  }
}

async function downscaleJpeg(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality));
}

// ---- React glue ----
let current: Store | null = null;
export const setCurrentStore = (s: Store | null) => {
  current = s;
};
export function getStore(): Store {
  if (!current) throw new Error('Store not open');
  return current;
}

export function useStore(): StoreState {
  const s = getStore();
  return useSyncExternalStore(s.subscribe, s.getState);
}

export function useData(): AppData {
  return useStore().data;
}
