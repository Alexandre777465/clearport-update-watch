import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Service-role client for backend operations — bypasses RLS
export const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// User-scoped client factory — respects RLS
export function userDb(accessToken: string) {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Missing SUPABASE_ANON_KEY');
  return createClient(supabaseUrl!, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
