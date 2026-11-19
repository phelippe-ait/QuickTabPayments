import { describe, expect, it } from "vitest"
import {
  findBundleHits,
  findSecretHits,
  isLockfile,
  maskSecret,
  SECRET_SCAN_ALLOWLIST,
  type SecretScanAllowlistEntry,
} from "./secretScan"

/**
 * Fixtures are assembled at runtime instead of written literally so this test
 * file never trips the real scanner in `npm run scan:secrets`.
 */
const stripeLive = `sk_live_${"a".repeat(24)}`
const stripeTest = `sk_test_${"b".repeat(24)}`
const webhookSecret = `whsec_${"c".repeat(24)}`
const restrictedKey = `rk_live_${"d".repeat(24)}`
const jwt = ["eyJ" + "a".repeat(24), "eyJ" + "b".repeat(24), "c".repeat(24)].join(
  ".",
)

const assignment = (name: string, value: string) => `${name} = "${value}"`

function rules(text: string, path = "src/config.ts"): string[] {
  return findSecretHits(text, path).map((hit) => hit.rule)
}

describe("findSecretHits", () => {
  it("detects live and test Stripe secret keys", () => {
    expect(rules(`const key = "${stripeLive}"`)).toContain(
      "stripe-secret-key",
    )
    expect(rules(`const key = "${stripeTest}"`)).toContain(
      "stripe-secret-key",
    )
  })

  it("detects webhook secrets and restricted keys", () => {
    expect(rules(webhookSecret)).toContain("stripe-webhook-secret")
    expect(rules(restrictedKey)).toContain("stripe-restricted-key")
  })

  it("detects JWTs", () => {
    expect(rules(`const token = "${jwt}"`)).toContain("jwt")
  })

  it("detects quoted generic credential assignments", () => {
    const line = assignment("api_key", "q".repeat(24))
    expect(rules(line)).toContain("generic-credential")
  })

  it("reports 1-based line and column positions", () => {
    const text = ["// header", assignment("password", "q".repeat(24))].join(
      "\n",
    )
    const [hit] = findSecretHits(text, "src/config.ts")
    expect(hit.line).toBe(2)
    expect(hit.column).toBe(1)
  })

  it("ignores prose that merely mentions sk_test", () => {
    expect(rules("Rotate the sk_test key in the Stripe dashboard.")).toEqual(
      [],
    )
    expect(rules("Use sk_test_ or sk_live_ prefixes, never real values.")).toEqual(
      [],
    )
  })

  it("ignores short lookalike prefixes", () => {
    expect(rules(`const key = "${"sk_test_"}" + "abc"`)).toEqual([])
  })

  it("ignores placeholder values", () => {
    const envLine = assignment("STRIPE_SECRET_KEY", "your-stripe-key-here")
    expect(findSecretHits(envLine, ".env.example")).toEqual([])
    const serviceRole = assignment(
      "SUPABASE_SERVICE_ROLE_KEY",
      "your-service-role-key",
    )
    expect(rules(serviceRole)).toEqual([])
  })

  it("respects path allowlist entries", () => {
    const demoLine = assignment("password", "demo-password-1234")
    expect(findSecretHits(demoLine, "DEMO_CREDENTIALS.md")).toEqual([])
    expect(rules(demoLine, "src/other.ts")).toContain("generic-credential")
  })

  it("respects rule and line restrictions in allowlist entries", () => {
    const allowlist: SecretScanAllowlistEntry[] = [
      {
        path: "src/fixture.ts",
        rules: ["generic-credential"],
        match: "fixture-credential",
        reason: "test fixture",
      },
    ]
    const allowed = assignment("token", "fixture-credential-value")
    const notAllowed = assignment("token", "other-credential-value")
    expect(findSecretHits(allowed, "src/fixture.ts", allowlist)).toEqual([])
    expect(
      findSecretHits(notAllowed, "src/fixture.ts", allowlist),
    ).toHaveLength(1)
    // Other rules are not covered by the entry.
    expect(findSecretHits(jwt, "src/fixture.ts", allowlist)).toHaveLength(1)
  })

  it("accepts RegExp path allowlist entries", () => {
    const allowlist: SecretScanAllowlistEntry[] = [
      { path: /^src\/fixtures\//, reason: "fixtures" },
    ]
    expect(
      findSecretHits(assignment("token", jwt), "src/fixtures/keys.ts", allowlist),
    ).toEqual([])
  })

  it("masks the value in the reported preview", () => {
    const [hit] = findSecretHits(`const key = "${stripeLive}"`, "src/config.ts")
    expect(hit.preview).not.toContain(stripeLive)
    expect(hit.preview).toContain("…")
    expect(hit.preview).toContain(`${stripeLive.length} chars`)
  })

  it("only checks lockfiles for registry auth tokens", () => {
    const lockWithStripe = `{"resolved": "https://registry.npmjs.org/${stripeLive}"}`
    expect(findSecretHits(lockWithStripe, "package-lock.json")).toEqual([])

    const registryLine = `"//registry.npmjs.org/:_authToken": "npm_${"e".repeat(
      30,
    )}"`
    expect(
      rules(registryLine, "package-lock.json"),
    ).toContain("registry-auth-token")
  })

  it("ignores registry token interpolations", () => {
    const line = `"//registry.npmjs.org/:_authToken": "\${NPM_TOKEN}"`
    expect(findSecretHits(line, "package-lock.json")).toEqual([])
  })

  it("ships an explicitly justified allowlist", () => {
    expect(SECRET_SCAN_ALLOWLIST.length).toBeGreaterThan(0)
    for (const entry of SECRET_SCAN_ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(10)
    }
  })
})

describe("isLockfile", () => {
  it("recognises npm and yarn lockfiles", () => {
    expect(isLockfile("package-lock.json")).toBe(true)
    expect(isLockfile("nested/pnpm-lock.yaml")).toBe(true)
    expect(isLockfile("src/app.ts")).toBe(false)
  })
})

describe("findBundleHits", () => {
  it("detects server-only role references in built assets", () => {
    const hits = findBundleHits(
      'const role = "service_role";',
      "dist/assets/app.js",
    )
    expect(hits.map((hit) => hit.rule)).toContain("dist-service-role")
  })

  it("detects Stripe keys in built assets and masks them", () => {
    const [hit] = findBundleHits(
      `const key = "${stripeLive}"`,
      "dist/assets/app.js",
    )
    expect(hit.rule).toBe("dist-stripe-key")
    expect(hit.preview).not.toContain(stripeLive)
  })

  it("leaves clean bundles alone", () => {
    expect(
      findBundleHits(
        'console.log("QuickTab customer menu");',
        "dist/assets/app.js",
      ),
    ).toEqual([])
  })
})

describe("maskSecret", () => {
  it("never returns the full value", () => {
    expect(maskSecret("abcdefghijklmnop")).toBe("abcd…op (16 chars)")
    expect(maskSecret("short")).toBe("***** (5 chars)")
  })
})
