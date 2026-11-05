// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { serverEnv } from "./env.js";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe("serverEnv", () => {
  it("throws when required secrets are missing", () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    expect(() => serverEnv()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("returns defaults for optional values", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const env = serverEnv();
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("");
    expect(env.SUPABASE_ANON_KEY).toBe("");
  });
});
