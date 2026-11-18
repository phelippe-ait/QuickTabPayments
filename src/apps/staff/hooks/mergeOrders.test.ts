import { describe, expect, it } from "vitest"
import { mergeOrders } from "./mergeOrders"
import type { Order } from "../types"

function order(id: string, overrides: Partial<Order> = {}): Order {
  return {
    id,
    table: "Table 4",
    guest: "Guest",
    time: "12:30",
    total: 24,
    status: "In progress",
    kitchenStatus: "New",
    server: "—",
    guests: 1,
    payment: "Paid",
    items: [],
    ...overrides,
  }
}

describe("mergeOrders", () => {
  it("returns the fetched board when there is nothing known yet", () => {
    const fetched = [order("QT-1"), order("QT-2")]

    expect(mergeOrders([], fetched)).toEqual(fetched)
  })

  it("keeps last-known orders as a floor and de-duplicates by id", () => {
    const merged = mergeOrders(
      [order("QT-1", { kitchenStatus: "Preparing" }), order("QT-2")],
      [order("QT-2"), order("QT-2", { kitchenStatus: "Ready" })],
    )

    expect(merged.map((entry) => entry.id).sort()).toEqual(["QT-1", "QT-2"])
    expect(merged.filter((entry) => entry.id === "QT-2")).toHaveLength(1)
  })

  it("lets fetched data win for an order that changed on the server", () => {
    const merged = mergeOrders(
      [order("QT-1", { kitchenStatus: "New" })],
      [order("QT-1", { kitchenStatus: "Ready" })],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].kitchenStatus).toBe("Ready")
  })

  it("preserves unchanged existing objects so re-syncs do not churn the board", () => {
    const existing = order("QT-1")
    const merged = mergeOrders([existing], [])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toBe(existing)
  })
})
