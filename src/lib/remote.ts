// The seam between Store and wherever the data lives (roadmap A.2). Store only talks to a
// Remote: github.ts is the first one, Supabase comes next. A Remote stores one text blob
// (data.json) with a version, and refuses a save made against an old version, so two
// devices never overwrite each other: Store fetches, merges and retries instead.

export class RemoteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
/** Someone saved since the version we had: fetch, merge, retry. */
export class ConflictError extends RemoteError {}
/** The credentials were rejected: retrying won't help. */
export class AuthError extends RemoteError {}

export interface Loaded {
  text: string;
  version: string;
}

export interface Remote {
  /** The saved data and its version, or null when nothing has been saved yet. */
  load(): Promise<Loaded | null>;
  /** Save, but only if the saved data is still at `version` (undefined: nothing saved yet).
   *  Returns the new version, or throws ConflictError. */
  save(text: string, version: string | undefined, message: string): Promise<string>;
  putFile(path: string, file: Blob): Promise<void>;
  /** The file, or null when there's none at that path. */
  getFile(path: string): Promise<Blob | null>;
}

/** Keeps everything in memory, for tests and the demo. */
export function memoryRemote(initial?: string) {
  let n = 0;
  let saved: Loaded | null = initial === undefined ? null : { text: initial, version: String(++n) };
  const files = new Map<string, Blob>();
  return {
    saves: 0,
    async load() {
      return saved && { ...saved };
    },
    async save(text: string, version: string | undefined) {
      if (saved?.version !== version) throw new ConflictError('Changed on another device', 409);
      saved = { text, version: String(++n) };
      this.saves++;
      return saved.version;
    },
    async putFile(path: string, file: Blob) {
      files.set(path, file);
    },
    async getFile(path: string) {
      return files.get(path) ?? null;
    },
    /** Another device saves, which moves the version on. */
    otherDeviceSaves(text: string) {
      saved = { text, version: String(++n) };
    },
    get text() {
      return saved?.text;
    },
  };
}
