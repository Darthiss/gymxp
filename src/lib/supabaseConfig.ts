// The two Supabase projects (roadmap Phase A). The URL and publishable key are public by
// design: they only work within each table's Row Level Security rules. Secret keys and
// database passwords never go in the repo.
const PROJECTS = {
  live: { url: 'https://hfoeqdrcqwkpwuegajzg.supabase.co', key: 'sb_publishable_ujrCqX6hIvS0CyFLRqNVPg_ARqbP1Ih' },
  test: { url: 'https://rpyuqtltopvyfrziedex.supabase.co', key: 'sb_publishable_ZZcx-9rUD7wWl11eZIp_Tg_HhNTQ7gs' },
};

/** Real accounts in the production build; the test project in dev and tests. */
export const SUPABASE = import.meta.env.PROD ? PROJECTS.live : PROJECTS.test;
