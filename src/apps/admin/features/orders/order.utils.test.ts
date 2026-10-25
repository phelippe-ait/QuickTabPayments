import { describe, expect, it } from "vitest"
import { formatRunningTime, getRefundStatus } from "./order.utils"

describe("formatRunningTime", () => {
  const now = new Date("2026-10-21T10:00:00Z").getTime()

  it("uses ISO timestamps", () => {
    expect(formatRunningTime("2026-10-21T09:42:00Z", now)).toBe("18 min")
    expect(formatRunningTime("2026-10-21T08:15:00Z", now)).toBe("1h 45m")
    expect(formatRunningTime("2026-10-21T10:00:00Z", now)).toBe("just now")
  })

  it("does not parse display strings", () => {
    expect(formatRunningTime("Today, 9:42 AM", now)).toBe("unknown")
  })
})

describe("getRefundStatus", () => {
  it("is numeric only", () => {
    expect(getRefundStatus(0, 20)).toBeNull()
    expect(getRefundStatus(5, 20)).toBe("Partial refund")
    expect(getRefundStatus(20, 20)).toBe("Refunded")
  })
})
