import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Lazy initialisation: importing this module never throws.
// The error surfaces only when a caller first accesses `db.from(...)` etc.
// This keeps unit tests that import pure functions from the same module tree
// working without Supabase credentials.

let _db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

// Service-role client for backend operations — bypasses RLS
export const db = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return (getDb() as Record<string | symbol, unknown>)[prop];
  },
});

// User-scoped client factory — respects RLS
export function userDb(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
