import { describe, expect, it } from "vitest"
import { endOfDayInZone, startOfDayInZone } from "./time"

describe("zoned day bounds", () => {
  it("resolves Sydney midnight across DST", () => {
    // October 2026 is AEDT (UTC+11).
    expect(startOfDayInZone("2026-10-21", "Australia/Sydney")).toBe(
      "2026-10-20T13:00:00.000Z",
    )
    expect(endOfDayInZone("2026-10-21", "Australia/Sydney")).toBe(
      "2026-10-21T12:59:59.999Z",
    )
  })

  it("handles UTC and a whole-day span", () => {
    expect(startOfDayInZone("2026-01-05", "UTC")).toBe(
      "2026-01-05T00:00:00.000Z",
    )
    expect(endOfDayInZone("2026-01-05", "UTC")).toBe(
      "2026-01-05T23:59:59.999Z",
    )
  })
})
