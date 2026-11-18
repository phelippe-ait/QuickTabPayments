/**
 * Secret scanning (`npm run scan:secrets`).
 *
 * 1. Pattern scan over every git-tracked text file: Stripe keys, JWTs,
 *    generic quoted credential assignments, and registry auth tokens in
 *    lockfiles. `--dist` (or an existing `dist/`) additionally scans built
 *    assets for server-only material that must never reach the browser.
 * 2. Exits 1 with a masked file:line report on any hit, 0 when clean.
 *
 * Zero dependencies. The pure matchers live in
 * `src/shared/lib/secretScan.ts` so Vitest can test them; Node's built-in
 * type stripping lets this script import that module directly. The explicit,
 * justified allowlist is `SECRET_SCAN_ALLOWLIST` in that module.
 */
import { execFileSync } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  findBundleHits,
  findSecretHits,
} from "../src/shared/lib/secretScan.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distOnly = process.argv.includes("--dist")

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "tiff",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "pdf",
  "zip",
  "gz",
  "tgz",
  "bz2",
  "7z",
  "mp3",
  "mp4",
  "mov",
  "webm",
  "wasm",
  "dump",
])

const DIST_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".json",
  ".map",
  ".svg",
])

function extensionOf(file) {
  const ext = path.extname(file).toLowerCase().replace(/^\./, "")
  return ext
}

function looksLikeBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0)
}

function listTrackedFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
    return output.split("\0").filter(Boolean)
  } catch (error) {
    console.error(
      "Secret scan: could not list git-tracked files (is this a git checkout?)",
    )
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function scanTrackedFiles() {
  const files = listTrackedFiles()
  const hits = []
  let scanned = 0
  let skipped = 0

  for (const file of files) {
    if (BINARY_EXTENSIONS.has(extensionOf(file))) {
      skipped++
      continue
    }

    let buffer
    try {
      buffer = await readFile(path.join(root, file))
    } catch {
      // Sparse checkouts or files removed without `git add -u`.
      skipped++
      continue
    }

    if (looksLikeBinary(buffer)) {
      skipped++
      continue
    }

    scanned++
    hits.push(...findSecretHits(buffer.toString("utf8"), file))
  }

  return { hits, scanned, skipped }
}

async function listDistFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listDistFiles(full)))
    } else if (entry.isFile() && DIST_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

async function scanDist() {
  const distDir = path.join(root, "dist")
  let files
  try {
    files = await listDistFiles(distDir)
  } catch {
    return null
  }

  const hits = []
  for (const file of files) {
    const buffer = await readFile(file)
    if (looksLikeBinary(buffer)) continue
    const relative = path.relative(root, file).split(path.sep).join("/")
    hits.push(...findBundleHits(buffer.toString("utf8"), relative))
  }

  return { hits, scanned: files.length }
}

function report(label, hits) {
  if (hits.length === 0) return false
  console.error(`\n✖ ${label}: ${hits.length} potential secret(s) found`)
  for (const hit of hits) {
    console.error(
      `  ${hit.path}:${hit.line}:${hit.column}  [${hit.rule}]  ${hit.preview}`,
    )
  }
  return true
}

if (distOnly) {
  const result = await scanDist()
  if (!result) {
    console.error(
      "Secret scan: dist/ not found. Run `npm run build` before `--dist`.",
    )
    process.exit(1)
  }
  const failed = report("Bundle scan", result.hits)
  if (failed) {
    console.error(
      "\nServer-only material must not be shipped to the browser. Rotate any real\n" +
        "credential outside this repo and fix the build before merging.",
    )
    process.exit(1)
  }
  console.log(
    `✔ Bundle scan clean (${result.scanned} file(s), no service-role or Stripe secrets).`,
  )
  process.exit(0)
}

const tracked = await scanTrackedFiles()
const trackedFailed = report("Tracked-file scan", tracked.hits)

const distResult = await scanDist()
const distFailed = report("Bundle scan", distResult?.hits ?? [])

if (trackedFailed || distFailed) {
  console.error(
    "\nPotential secrets must never be committed. If a real credential is listed\n" +
      "above, rotate it outside this repo before proceeding.",
  )
  process.exit(1)
}

const distNote = distResult
  ? `, bundle: ${distResult.scanned} file(s)`
  : ", bundle: dist/ not built (skipped)"
console.log(
  `✔ Secret scan clean (${tracked.scanned} tracked file(s) scanned, ` +
    `${tracked.skipped} skipped as binary${distNote}).`,
)
