/**
 * Pure secret-scanning matchers used by `scripts/scan-secrets.mjs`
 * (`npm run scan:secrets`).
 *
 * Kept dependency-free and Node-API-free so the script can import it through
 * Node's built-in type stripping (same pattern as `budget.ts`) and Vitest can
 * unit-test the matchers directly.
 */

export type SecretRuleId =
  | "stripe-secret-key"
  | "stripe-webhook-secret"
  | "stripe-restricted-key"
  | "jwt"
  | "generic-credential"
  | "registry-auth-token"

export type BundleRuleId =
  | "dist-service-role"
  | "dist-stripe-key"
  | "dist-webhook-secret"
  | "dist-restricted-key"

export type SecretHit = {
  path: string
  /** 1-based line number. */
  line: number
  /** 1-based column of the first character of the match. */
  column: number
  rule: SecretRuleId
  /** Masked excerpt. The full secret is never included. */
  preview: string
}

export type BundleHit = {
  path: string
  line: number
  column: number
  rule: BundleRuleId
  preview: string
}

export type SecretScanAllowlistEntry = {
  /** Exact repo-relative path, a directory prefix ending in `/`, or a RegExp. */
  path: string | RegExp
  /** Restrict the entry to specific rules (default: every rule). */
  rules?: readonly SecretRuleId[]
  /** Only allow lines that contain this text. */
  match?: string
  reason: string
}

/**
 * Explicit, justified allowlist. Anything here is skipped by
 * `findSecretHits`; keep the list short and the reasons specific.
 */
export const SECRET_SCAN_ALLOWLIST: readonly SecretScanAllowlistEntry[] = [
  {
    path: "DEMO_CREDENTIALS.md",
    reason:
      "Demo-only logins for the hosted demo project, intentionally shipped with the submission. The file is gitignored but allowlisted so submission archives can be scanned too.",
  },
  {
    path: "src/apps/admin/mappers.test.ts",
    rules: ["generic-credential"],
    match: "tracking_token",
    reason:
      "Test fixture value `tracking-token-1`; tracking tokens in fixtures are fake and this match only covers that line.",
  },
]

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
])

/** Values that are obviously placeholders, not credentials. */
const PLACEHOLDER_MARKERS = [
  "your",
  "here",
  "placeholder",
  "example",
  "changeme",
  "change-me",
  "replace",
  "redacted",
  "dummy",
  "fake",
  "sample",
  "todo",
  "xxxx",
]

function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return true
  if (
    normalized.startsWith("$") ||
    normalized.startsWith("<") ||
    normalized.startsWith("env(") ||
    normalized.startsWith("process.env")
  ) {
    return true
  }
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "")
}

export function isLockfile(filePath: string): boolean {
  const name = normalizePath(filePath).split("/").pop() ?? ""
  return LOCKFILE_NAMES.has(name)
}

type TextRule = {
  id: SecretRuleId
  pattern: RegExp
  /** Capture group holding the value (defaults to the whole match). */
  valueGroup?: number
}

const TEXT_RULES: readonly TextRule[] = [
  {
    id: "stripe-secret-key",
    pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
  },
  {
    id: "stripe-webhook-secret",
    pattern: /whsec_[0-9A-Za-z]{16,}/g,
  },
  {
    id: "stripe-restricted-key",
    pattern: /rk_live_[0-9A-Za-z]{16,}/g,
  },
  {
    id: "jwt",
    pattern:
      /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
  {
    id: "generic-credential",
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*["']([^"']{16,})["']/g,
    valueGroup: 2,
  },
]

/**
 * Lockfiles are mostly hashes and URLs, so the generic rules would be noise.
 * The only thing worth checking there is registry auth material.
 */
const REGISTRY_RULE: TextRule = {
  id: "registry-auth-token",
  pattern: /(?:_authToken|_auth|_password)["']?\s*[:=]\s*["']?([^\s"',}]{8,})/g,
  valueGroup: 1,
}

const BUNDLE_RULES: readonly {
  id: BundleRuleId
  pattern: RegExp
  masked: boolean
}[] = [
  { id: "dist-service-role", pattern: /service_role/g, masked: false },
  {
    id: "dist-stripe-key",
    pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
    masked: true,
  },
  {
    id: "dist-webhook-secret",
    pattern: /whsec_[0-9A-Za-z]{16,}/g,
    masked: true,
  },
  {
    id: "dist-restricted-key",
    pattern: /rk_live_[0-9A-Za-z]{16,}/g,
    masked: true,
  },
]

/** Masks a credential so reports never contain the full value. */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return `${"*".repeat(value.length)} (${value.length} chars)`
  }
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`
}

function pathMatches(entryPath: string | RegExp, filePath: string): boolean {
  if (entryPath instanceof RegExp) return entryPath.test(filePath)
  const normalized = normalizePath(entryPath)
  if (normalized.endsWith("/")) return filePath.startsWith(normalized)
  return filePath === normalized
}

function isAllowlisted(
  filePath: string,
  rule: SecretRuleId,
  lineText: string,
  allowlist: readonly SecretScanAllowlistEntry[],
): boolean {
  return allowlist.some((entry) => {
    if (!pathMatches(entry.path, filePath)) return false
    if (entry.rules && !entry.rules.includes(rule)) return false
    if (entry.match && !lineText.includes(entry.match)) return false
    return true
  })
}

function lineHits(
  text: string,
  filePath: string,
  rule: TextRule,
  allowlist: readonly SecretScanAllowlistEntry[],
): SecretHit[] {
  const hits: SecretHit[] = []
  for (const match of text.matchAll(rule.pattern)) {
    const value =
      rule.valueGroup === undefined ? match[0] : (match[rule.valueGroup] ?? "")
    // Generic assignments are the noisiest rule: skip placeholder values.
    if (rule.id === "generic-credential" && isPlaceholderValue(value)) continue
    if (rule.id === "registry-auth-token" && isPlaceholderValue(value)) continue
    if (isAllowlisted(filePath, rule.id, text, allowlist)) continue
    hits.push({
      path: filePath,
      line: 0,
      column: (match.index ?? 0) + 1,
      rule: rule.id,
      preview: maskSecret(value),
    })
  }
  return hits
}

/**
 * Returns every potential secret in `fileText`. The caller is responsible for
 * skipping binary files; lockfiles are handled here (registry tokens only).
 */
export function findSecretHits(
  fileText: string,
  filePath: string,
  allowlist: readonly SecretScanAllowlistEntry[] = SECRET_SCAN_ALLOWLIST,
): SecretHit[] {
  const path = normalizePath(filePath)
  const lockfile = isLockfile(path)
  const rules = lockfile ? [REGISTRY_RULE] : TEXT_RULES
  const hits: SecretHit[] = []

  const lines = fileText.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    if (!text) continue
    const found: SecretHit[] = []
    for (const rule of rules) {
      const current = lineHits(text, path, rule, allowlist)
      // A specific match already explains the line; skip noisy generic dupes.
      if (rule.id === "generic-credential" && found.length > 0) continue
      found.push(...current)
    }
    for (const hit of found) hits.push({ ...hit, line: index + 1 })
  }

  return hits
}

/** Scans a built asset (`dist/`) for server-only material. */
export function findBundleHits(
  fileText: string,
  filePath: string,
): BundleHit[] {
  const path = normalizePath(filePath)
  const hits: BundleHit[] = []
  const lines = fileText.split(/\r?\n/)

  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    if (!text) continue
    for (const rule of BUNDLE_RULES) {
      for (const match of text.matchAll(rule.pattern)) {
        hits.push({
          path,
          line: index + 1,
          column: (match.index ?? 0) + 1,
          rule: rule.id,
          preview: rule.masked ? maskSecret(match[0]) : match[0],
        })
      }
    }
  }

  return hits
}
