import { describe, expect, it } from "vitest"
import {
  chunkName,
  evaluateBudget,
  gzipSize,
  initialScripts,
  type ChunkSize,
} from "./budget"

describe("chunkName", () => {
  it("strips the directory, extension, and Vite content hash", () => {
    expect(chunkName("assets/index-DFmMDr2A.js")).toBe("index")
    expect(chunkName("assets/CustomerDashboard-ltL542ma.js")).toBe(
      "CustomerDashboard",
    )
  })

  it("keeps names that contain hyphens before the hash", () => {
    expect(chunkName("assets/order.utils-CVtOh_Ic.js")).toBe("order.utils")
  })

  it("leaves unhashed files alone", () => {
    expect(chunkName("assets/vendor.js")).toBe("vendor")
  })
})

describe("gzipSize", () => {
  it("returns the length of the compressed buffer", () => {
    const input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const fakeGzip = (bytes: Uint8Array) =>
      new Uint8Array(Math.ceil(bytes.byteLength / 2))

    expect(gzipSize(input, fakeGzip)).toBe(4)
  })

  it("passes the exact bytes through to the compressor", () => {
    const input = new Uint8Array([9, 8, 7])
    let received: Uint8Array | null = null

    gzipSize(input, (bytes) => {
      received = bytes
      return new Uint8Array(1)
    })

    expect(received).toBe(input)
  })
})

describe("initialScripts", () => {
  it("collects the entry script and modulepreload links", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="module" crossorigin src="/assets/index-DFmMDr2A.js"></script>
          <link rel="modulepreload" crossorigin href="/assets/jsx-runtime-BkSabwWG.js">
          <link rel="modulepreload" crossorigin href="/assets/cn-B1qFrdWq.js">
          <link rel="stylesheet" href="/assets/index-5qQzdvwz.css">
        </head>
      </html>`

    expect(initialScripts(html)).toEqual([
      "assets/index-DFmMDr2A.js",
      "assets/jsx-runtime-BkSabwWG.js",
      "assets/cn-B1qFrdWq.js",
    ])
  })

  it("de-duplicates entries and ignores non-JS assets", () => {
    const html = `
      <script src="/assets/index-a.js"></script>
      <script src="/assets/index-a.js"></script>
      <link rel="modulepreload" href="/assets/style.css">`

    expect(initialScripts(html)).toEqual(["assets/index-a.js"])
  })

  it("returns an empty list when the HTML has no scripts", () => {
    expect(initialScripts("<html><body></body></html>")).toEqual([])
  })
})

describe("evaluateBudget", () => {
  const chunks: ChunkSize[] = [
    { file: "assets/index-entry.js", rawSize: 500, gzipSize: 100 },
    { file: "assets/react-vendor.js", rawSize: 400, gzipSize: 50 },
    { file: "assets/checkout-lazy.js", rawSize: 300, gzipSize: 40 },
    { file: "assets/huge-lazy.js", rawSize: 2000, gzipSize: 160 },
  ]

  it("sums only the initial chunks", () => {
    const result = evaluateBudget({
      chunks,
      initialFiles: ["assets/index-entry.js", "assets/react-vendor.js"],
    })

    expect(result.initialGzipSize).toBe(150)
    expect(result.overBudget).toBe(false)
    expect(result.overByBytes).toBe(0)
  })

  it("flags an over-budget initial bundle and reports the excess", () => {
    const result = evaluateBudget({
      chunks,
      initialFiles: ["assets/index-entry.js", "assets/react-vendor.js"],
      initialBudgetBytes: 120,
    })

    expect(result.overBudget).toBe(true)
    expect(result.overByBytes).toBe(30)
  })

  it("warns about large lazy chunks without failing the build", () => {
    const result = evaluateBudget({
      chunks,
      initialFiles: ["assets/index-entry.js"],
      lazyWarnBytes: 150,
    })

    expect(result.warnings.map((chunk) => chunk.file)).toEqual([
      "assets/huge-lazy.js",
    ])
    expect(result.overBudget).toBe(false)
  })

  it("does not warn about initial chunks that exceed the lazy threshold", () => {
    const result = evaluateBudget({
      chunks,
      initialFiles: ["assets/huge-lazy.js"],
      lazyWarnBytes: 100,
      initialBudgetBytes: 1000,
    })

    expect(result.warnings).toEqual([])
  })

  it("treats initial files missing from the build as zero bytes", () => {
    const result = evaluateBudget({
      chunks,
      initialFiles: ["assets/index-entry.js", "assets/missing.js"],
    })

    expect(result.initialGzipSize).toBe(100)
    expect(result.missingInitialFiles).toEqual(["assets/missing.js"])
  })
})
