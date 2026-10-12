// Minimal GitHub REST client for reading/writing files in the private data repo.
import { b64ToUtf8, utf8ToB64 } from './crypto';

export interface GhConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GhError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
export class ConflictError extends GhError {}
export class AuthError extends GhError {}

const API = 'https://api.github.com';

async function gh(cfg: GhConfig, path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: accept,
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GhError('Network error: you may be offline', 0);
  }
  if (res.ok || res.status === 404) return res;
  let msg = `GitHub error ${res.status}`;
  try {
    const j = await res.json();
    if (j?.message) msg = `${msg}: ${j.message}`;
  } catch { /* ignore */ }
  if (res.status === 401) throw new AuthError('GitHub rejected the token (expired or revoked?)', 401);
  if (res.status === 403 && /rate limit/i.test(msg)) throw new GhError('GitHub rate limit hit, try again in a few minutes', 403);
  if (res.status === 403) throw new AuthError(`Token lacks permission for this repo. ${msg}`, 403);
  if (res.status === 409 || (res.status === 422 && /sha/i.test(msg))) throw new ConflictError('File changed on another device', res.status);
  throw new GhError(msg, res.status);
}

export interface RepoInfo {
  fullName: string;
  isPrivate: boolean;
  canPush: boolean;
}

export async function checkRepo(cfg: GhConfig): Promise<RepoInfo> {
  const res = await gh(cfg, '');
  if (res.status === 404) throw new GhError('Repository not found. Check the owner/name, and that the token has access to it.', 404);
  const j = await res.json();
  return { fullName: j.full_name, isPrivate: !!j.private, canPush: !!j.permissions?.push };
}

const filePath = (p: string) => `/contents/${p.split('/').map(encodeURIComponent).join('/')}`;

export async function getTextFile(cfg: GhConfig, path: string): Promise<{ text: string; sha: string } | null> {
  const res = await gh(cfg, filePath(path));
  if (res.status === 404) return null;
  const j = await res.json();
  if (j.content && j.encoding === 'base64') return { text: b64ToUtf8(j.content), sha: j.sha };
  // Files over 1 MB come back without inline content: fetch the raw bytes.
  const raw = await gh(cfg, filePath(path), {}, 'application/vnd.github.raw+json');
  return { text: await raw.text(), sha: j.sha };
}

export async function putFile(cfg: GhConfig, path: string, contentB64: string, message: string, sha?: string): Promise<string> {
  const res = await gh(cfg, filePath(path), {
    method: 'PUT',
    body: JSON.stringify({ message, content: contentB64, ...(sha ? { sha } : {}) }),
  });
  if (res.status === 404) throw new GhError('Repository not found or token has no write access', 404);
  const j = await res.json();
  return j.content.sha as string;
}

export const putTextFile = (cfg: GhConfig, path: string, text: string, message: string, sha?: string) =>
  putFile(cfg, path, utf8ToB64(text), message, sha);

export async function getBinaryFile(cfg: GhConfig, path: string): Promise<Blob | null> {
  const res = await gh(cfg, filePath(path), {}, 'application/vnd.github.raw+json');
  if (res.status === 404) return null;
  return res.blob();
}
