import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Reduce whatever was pasted down to the project origin
 * (`https://<ref>.supabase.co`).
 *
 * Pasting the dashboard's REST endpoint (`/rest/v1`) or leaving a trailing
 * slash makes supabase-js build doubled paths, which PostgREST and the auth
 * service reject with "Invalid path specified in request URL".
 */
function normalizeSupabaseUrl(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : rawUrl;

if (rawUrl && url !== rawUrl) {
  console.warn(
    `VITE_SUPABASE_URL should be an origin like https://<ref>.supabase.co (got "${rawUrl}"). Using "${url}".`,
  );
}

/**
 * Single Supabase client for the whole app.
 *
 * The anon/publishable key is intended to be public — Row Level Security is what
 * protects the data. `service_role` keys must never reach the browser.
 *
 * If the env vars are missing (e.g. a fresh clone or CI) we export `null` rather
 * than throwing at import time, so the UI can render and surface a helpful error
 * instead of a blank crash screen.
 */
export const supabase: SupabaseClient<Database> | null =
  url && anonKey
    ? createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Handles the `?code=...` / hash that OAuth providers redirect back with.
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key.";
