import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env.js";

/** Bypasses RLS. Server-only. */
export function adminClient(): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Runs as the caller (auth.uid() works) by forwarding their JWT with the anon key. */
export function userClient(accessToken?: string | null): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = serverEnv();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}
