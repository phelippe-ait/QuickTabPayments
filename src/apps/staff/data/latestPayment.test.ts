import { describe, expect, it } from "vitest"
import { selectLatestPayment } from "./latestPayment"

describe("selectLatestPayment", () => {
  it("returns undefined when there are no payment rows", () => {
    expect(selectLatestPayment([])).toBeUndefined()
    expect(selectLatestPayment(undefined)).toBeUndefined()
  })

  it("prefers a settled payment over a newer pending retry", () => {
    const pending = {
      status: "pending" as const,
      created_at: "2026-11-17T10:05:00.000Z",
    }
    const paid = {
      status: "succeeded" as const,
      created_at: "2026-11-17T10:02:00.000Z",
    }

    expect(selectLatestPayment([pending, paid])).toBe(paid)
    expect(selectLatestPayment([paid, pending])).toBe(paid)
  })

  it("prefers the newest settled payment", () => {
    const older = {
      status: "succeeded" as const,
      created_at: "2026-11-17T10:00:00.000Z",
    }
    const refunded = {
      status: "refunded" as const,
      created_at: "2026-11-17T10:05:00.000Z",
    }

    expect(selectLatestPayment([older, refunded])).toBe(refunded)
  })

  it("falls back to the newest attempt when none settled", () => {
    const failed = {
      status: "failed" as const,
      created_at: "2026-11-17T10:00:00.000Z",
    }
    const pending = {
      status: "pending" as const,
      created_at: "2026-11-17T10:05:00.000Z",
    }

    expect(selectLatestPayment([failed, pending])).toBe(pending)
  })
})
