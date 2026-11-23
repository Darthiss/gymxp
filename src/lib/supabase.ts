// The Supabase client, and the Remote that keeps each person's data in their row of
// `vaults` (roadmap A.4, supabase/setup.sql). Everything passing through here is
// already sealed by lib/e2e.ts: wrap this Remote in sealedRemote() before use.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from './supabaseConfig';
import { AuthError, ConflictError, RemoteError, type Remote } from './remote';

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  return (client ??= createClient(SUPABASE.url, SUPABASE.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'bro:auth' },
  }));
}

function fail(error: { message: string; code?: string }, status?: number): never {
  const msg = error.message || 'Something went wrong';
  if (status === 0 || /failed to fetch|network|load failed/i.test(msg) || !navigator.onLine) throw new RemoteError('Network error: you may be offline', 0);
  if (status === 401 || /jwt|refresh token|not authenticated/i.test(msg)) throw new AuthError('Your session ended. Sign in again from Settings.', 401);
  throw new RemoteError(msg, status ?? 500);
}

const notFound = (error: { message: string; status?: number; statusCode?: string }) =>
  error.status === 404 || error.statusCode === '404' || /not.?found/i.test(error.message);

export function supabaseRemote(userId: string): Remote {
  const photo = (path: string) => `${userId}/${path}`;
  return {
    async load() {
      const { data, error, status } = await sb().from('vaults').select('data, version').eq('user_id', userId).maybeSingle();
      if (error) fail(error, status);
      if (!data || data.data == null) return null;
      return { text: data.data as string, version: String(data.version) };
    },
    async save(text, version) {
      const { data, error, status } = await sb().rpc('save_vault', { expected: version ? Number(version) : 0, body: text });
      if (error) fail(error, status);
      if (data == null) throw new ConflictError('Changed on another device', 409);
      return String(data);
    },
    async putFile(path, file) {
      const { error } = await sb().storage.from('photos').upload(photo(path), file, { contentType: 'application/octet-stream', upsert: true });
      if (error) fail(error);
    },
    async getFile(path) {
      const { data, error } = await sb().storage.from('photos').download(photo(path));
      if (error) {
        if (notFound(error as { message: string })) return null;
        fail(error);
      }
      return data;
    },
  };
}
