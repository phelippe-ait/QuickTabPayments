/**
 * Bundle-budget check (`npm run bundle:budget`).
 *
 * Run after `npm run build`. It reads `dist/index.html` to discover the chunks
 * the browser downloads before any route renders (the entry script plus Vite's
 * `modulepreload` links), adds up their gzip sizes, and fails when the customer
 * initial bundle is over budget. Lazy route chunks are listed for visibility
 * and warn when they get unusually large, but they never fail the build.
 *
 * The pure logic lives in `src/shared/lib/budget.ts` so it can be unit-tested
 * by Vitest; Node's built-in type stripping lets this script import it
 * directly (Node >= 22.18, which satisfies the repo's `>=22.12.0` engine).
 */
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
import {
  chunkName,
  evaluateBudget,
  gzipSize,
  initialScripts,
  LAZY_CHUNK_WARN_BYTES,
} from "../src/shared/lib/budget.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(root, "dist")
const assetsDir = path.join(distDir, "assets")

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`
}

let html
try {
  html = await readFile(path.join(distDir, "index.html"), "utf8")
} catch {
  console.error(
    "Bundle budget: dist/index.html not found. Run `npm run build` first.",
  )
  process.exit(1)
}

let assetFiles
try {
  assetFiles = (await readdir(assetsDir)).filter((file) => file.endsWith(".js"))
} catch {
  console.error(
    "Bundle budget: dist/assets not found. Run `npm run build` first.",
  )
  process.exit(1)
}

const initialFiles = initialScripts(html)

const chunks = await Promise.all(
  assetFiles.map(async (name) => {
    const buffer = await readFile(path.join(assetsDir, name))
    return {
      file: `assets/${name}`,
      rawSize: buffer.byteLength,
      gzipSize: gzipSize(buffer, gzipSync),
    }
  }),
)

chunks.sort((a, b) => b.gzipSize - a.gzipSize)

const result = evaluateBudget({ chunks, initialFiles })
const initialSet = new Set(initialFiles)

const nameWidth = Math.max(
  "Chunk".length,
  ...chunks.map((chunk) => chunkName(chunk.file).length),
)
const line = (name, raw, gzip, kind) =>
  `  ${name.padEnd(nameWidth)}  ${raw.padStart(9)}  ${gzip.padStart(9)}  ${kind}`

console.log("\nBundle chunks (sorted by gzip size):\n")
console.log(
  line("Chunk", "Raw", "Gzip", "Loads"),
)
console.log(`  ${"-".repeat(nameWidth)}  ${"-".repeat(9)}  ${"-".repeat(9)}  -----`)
for (const chunk of chunks) {
  console.log(
    line(
      chunkName(chunk.file),
      formatBytes(chunk.rawSize),
      formatBytes(chunk.gzipSize),
      initialSet.has(chunk.file) ? "initial" : "lazy",
    ),
  )
}

console.log(
  `\nCustomer initial JS: ${formatBytes(result.initialGzipSize)} gzip ` +
    `(budget ${formatBytes(result.initialBudgetBytes)})`,
)

if (result.missingInitialFiles.length > 0) {
  console.error(
    `\nBundle budget: ${result.missingInitialFiles.length} initial asset(s) referenced by index.html were not built:\n` +
      result.missingInitialFiles.map((file) => `  - ${file}`).join("\n"),
  )
  process.exit(1)
}

for (const chunk of result.warnings) {
  console.warn(
    `\n⚠ Lazy chunk ${chunk.file} is ${formatBytes(chunk.gzipSize)} gzip ` +
      `(warning threshold ${formatBytes(LAZY_CHUNK_WARN_BYTES)}).`,
  )
}

if (result.overBudget) {
  console.error(
    `\n✖ Bundle budget exceeded: customer initial JS is ` +
      `${formatBytes(result.initialGzipSize)} gzip, ` +
      `${formatBytes(result.overByBytes)} over the ` +
      `${formatBytes(result.initialBudgetBytes)} budget.`,
  )
  console.error(
    "  Move route-only code behind React.lazy or a dynamic import before shipping.",
  )
  process.exit(1)
}

console.log("✔ Bundle budget met.\n")
