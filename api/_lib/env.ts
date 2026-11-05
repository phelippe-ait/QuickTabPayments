export type ServerEnv = {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export function serverEnv(): ServerEnv {
  const {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  }

  return {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET ?? "",
    SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY,
  };
}
