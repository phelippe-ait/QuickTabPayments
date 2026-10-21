import { supabase, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@shared/lib/supabase";

/**
 * Every data function goes through this guard so a fresh clone without env
 * vars fails with a useful message instead of "null is not an object".
 */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }
  return supabase;
}

export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error("Something went wrong. Please try again.");
}
