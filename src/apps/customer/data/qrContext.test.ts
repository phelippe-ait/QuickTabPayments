import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearStoredQrSource,
  mapResolveResult,
  persistQrSource,
  readStoredQrSource,
  resolveInitialQrContext,
  resolveQrContext,
  stripQrParams,
} from "./qrContext"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}))

const resolvedRow = {
  restaurant_id: "restaurant-1",
  restaurant_slug: "quicktab-demo-cafe",
  restaurant_name: "QuickTab Demo Cafe",
  currency: "AUD",
  tax_rate: 0.1,
  table_id: "table-1",
  table_token: "token-1",
  table_number: "T05",
}

describe("mapResolveResult", () => {
  it("maps a complete resolver response", () => {
    expect(mapResolveResult(resolvedRow)).toEqual({
      ok: true,
      context: {
        restaurantId: "restaurant-1",
        restaurantSlug: "quicktab-demo-cafe",
        restaurantName: "QuickTab Demo Cafe",
        currency: "AUD",
        taxRate: 0.1,
        tableId: "table-1",
        tableToken: "token-1",
        tableNumber: "T05",
      },
    })
  })

  it.each([
    "missing_params",
    "restaurant_not_found",
    "table_not_found",
    "table_inactive",
  ])("surfaces the %s error", (error) => {
    expect(mapResolveResult({ error })).toEqual({ ok: false, error })
  })

  it("maps unknown errors and malformed payloads defensively", () => {
    expect(mapResolveResult({ error: "something_else" })).toEqual({
      ok: false,
      error: "unknown",
    })
    expect(mapResolveResult(null)).toEqual({ ok: false, error: "unknown" })
    expect(mapResolveResult({ ...resolvedRow, table_id: undefined })).toEqual({
      ok: false,
      error: "unknown",
    })
  })
})

describe("resolveQrContext", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    window.sessionStorage.clear()
  })

  it("calls the resolver RPC with the slug and token", async () => {
    mocks.rpc.mockResolvedValue({ data: resolvedRow, error: null })

    const result = await resolveQrContext("quicktab-demo-cafe", "token-1")

    expect(mocks.rpc).toHaveBeenCalledWith("resolve_qr_context", {
      p_slug: "quicktab-demo-cafe",
      p_token: "token-1",
    })
    expect(result.ok).toBe(true)
  })

  it("throws a friendly error when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(resolveQrContext("cafe", "token")).rejects.toThrow(
      "We couldn't open this menu. Please try again.",
    )
  })
})

describe("resolveInitialQrContext", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    window.sessionStorage.clear()
    vi.stubEnv("VITE_RESTAURANT_SLUG", "")
    window.history.replaceState({}, "", "/")
  })

  it("rejects an incomplete QR without hitting the database", async () => {
    expect(await resolveInitialQrContext("?r=quicktab-demo-cafe")).toEqual({
      ok: false,
      error: "missing_params",
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("rejects a bare visit when there is no stored or dev context", async () => {
    expect(await resolveInitialQrContext("")).toEqual({
      ok: false,
      error: "no_context",
    })
  })

  it("resolves and persists the QR source, then strips the URL token", async () => {
    mocks.rpc.mockResolvedValue({ data: resolvedRow, error: null })
    window.history.replaceState({}, "", "/?r=quicktab-demo-cafe&t=token-1")

    const result = await resolveInitialQrContext(window.location.search)

    expect(result.ok).toBe(true)
    expect(readStoredQrSource()).toEqual({
      slug: "quicktab-demo-cafe",
      tableToken: "token-1",
    })
    expect(window.location.search).toBe("")
  })

  it("restores a stored source when the query string was dropped", async () => {
    persistQrSource({ slug: "quicktab-demo-cafe", tableToken: "token-1" })
    mocks.rpc.mockResolvedValue({ data: resolvedRow, error: null })

    const result = await resolveInitialQrContext("")

    expect(result.ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_qr_context", {
      p_slug: "quicktab-demo-cafe",
      p_token: "token-1",
    })
  })
})

describe("stripQrParams", () => {
  it("keeps unrelated query params", () => {
    window.history.replaceState({}, "", "/?r=cafe&t=token&utm_source=poster")
    stripQrParams()
    expect(window.location.pathname).toBe("/")
    expect(window.location.search).toBe("?utm_source=poster")
  })
})

describe("QR source storage", () => {
  it("round-trips and clears the source", () => {
    persistQrSource({ slug: "cafe", tableToken: "t" })
    expect(readStoredQrSource()).toEqual({ slug: "cafe", tableToken: "t" })
    clearStoredQrSource()
    expect(readStoredQrSource()).toBeNull()
  })

  it("ignores malformed storage", () => {
    window.sessionStorage.setItem("quicktab:qr-source", "{not json")
    expect(readStoredQrSource()).toBeNull()
  })
})
