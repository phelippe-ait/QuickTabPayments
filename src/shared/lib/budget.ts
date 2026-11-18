/**
 * Pure helpers for the bundle-budget check (`scripts/check-bundle-size.mjs`).
 *
 * They live here rather than in `scripts/` because the Vitest include globs
 * only cover `src/**` and `api/**`. This module deliberately has no Node
 * imports: the script injects `zlib.gzipSync`, so the same logic is testable
 * in the browser-like jsdom environment.
 */

export type ChunkSize = {
  /** Path relative to `dist/`, e.g. `assets/index-abc123.js`. */
  file: string
  rawSize: number
  gzipSize: number
}

/** Injected gzip implementation (the script passes `zlib.gzipSync`). */
export type GzipFunction = (input: Uint8Array) => Uint8Array

/** Customer initial JS budget: entry chunk + its static imports. */
export const CUSTOMER_INITIAL_BUDGET_BYTES = 200 * 1024

/** Warn (but do not fail) when a lazy chunk exceeds this gzip size. */
export const LAZY_CHUNK_WARN_BYTES = 150 * 1024

const SCRIPT_SRC = /<script\b[^>]*\bsrc="([^"]+\.js)"/gi
const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"/gi

/** `assets/index-DFmMDr2A.js` → `index`; leaves unhashed names intact. */
export function chunkName(file: string): string {
  const base = (file.split("/").pop() ?? file).replace(/\.js$/i, "")
  const match = base.match(/^(.*)-[A-Za-z0-9_-]{8,}$/)
  return match ? match[1] : base
}

/**
 * Gzip size of a built chunk. Taking the compressor as an argument keeps this
 * helper free of Node built-ins while still measuring real compressed bytes.
 */
export function gzipSize(bytes: Uint8Array, gzip: GzipFunction): number {
  return gzip(bytes).byteLength
}

/**
 * Asset paths that load before any route renders: the entry `<script>` plus
 * every `<link rel="modulepreload">` Vite emits for statically imported
 * chunks. Dynamic-import chunks are not listed here, which is exactly what
 * the "initial JS" budget should measure.
 */
export function initialScripts(html: string): string[] {
  const files: string[] = []
  for (const pattern of [SCRIPT_SRC, MODULE_PRELOAD]) {
    for (const match of html.matchAll(pattern)) {
      files.push(normalizeAssetPath(match[1]))
    }
  }
  return [...new Set(files)]
}

function normalizeAssetPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")
}

export type BudgetResult = {
  initialGzipSize: number
  initialBudgetBytes: number
  overBudget: boolean
  overByBytes: number
  /** Non-initial chunks above the lazy warning threshold. */
  warnings: ChunkSize[]
  /** Initial assets referenced by the HTML but missing from the build. */
  missingInitialFiles: string[]
}

/**
 * Sum the gzip size of the initial chunks and flag budget violations.
 * Lazy chunks are only reported as warnings, never failures.
 */
export function evaluateBudget({
  chunks,
  initialFiles,
  initialBudgetBytes = CUSTOMER_INITIAL_BUDGET_BYTES,
  lazyWarnBytes = LAZY_CHUNK_WARN_BYTES,
}: {
  chunks: ChunkSize[]
  initialFiles: string[]
  initialBudgetBytes?: number
  lazyWarnBytes?: number
}): BudgetResult {
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]))
  const initialSet = new Set(initialFiles)
  const missingInitialFiles = initialFiles.filter((file) => !byFile.has(file))
  const initialGzipSize = initialFiles.reduce(
    (total, file) => total + (byFile.get(file)?.gzipSize ?? 0),
    0,
  )
  const warnings = chunks.filter(
    (chunk) => !initialSet.has(chunk.file) && chunk.gzipSize > lazyWarnBytes,
  )

  return {
    initialGzipSize,
    initialBudgetBytes,
    overBudget: initialGzipSize > initialBudgetBytes,
    overByBytes: Math.max(0, initialGzipSize - initialBudgetBytes),
    warnings,
    missingInitialFiles,
  }
}
