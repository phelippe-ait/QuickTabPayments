import { describe, expect, it } from "vitest"
import { sortOrdersOldestFirst } from "./orderSort"

describe("sortOrdersOldestFirst", () => {
  it("sorts ascending by created_at without mutating the input", () => {
    const orders = [
      { id: "new", createdAt: "2026-11-17T10:12:00.000Z" },
      { id: "old", createdAt: "2026-11-17T10:02:00.000Z" },
      { id: "middle", createdAt: "2026-11-17T10:07:00.000Z" },
    ]

    const sorted = sortOrdersOldestFirst(orders)

    expect(sorted.map((order) => order.id)).toEqual(["old", "middle", "new"])
    expect(orders.map((order) => order.id)).toEqual(["new", "old", "middle"])
  })

  it("puts orders without a usable timestamp first", () => {
    const sorted = sortOrdersOldestFirst([
      { id: "dated", createdAt: "2026-11-17T10:02:00.000Z" },
      { id: "missing" },
      { id: "invalid", createdAt: "not-a-date" },
    ])

    expect(sorted[0].id).toBe("missing")
    expect(sorted[1].id).toBe("invalid")
    expect(sorted[2].id).toBe("dated")
  })
})
