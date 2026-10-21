import { describe, expect, it } from "vitest"
import type { OrderStatus } from "@shared/lib/database.types"
import {
  ORDER_STATUSES,
  canTransitionStatus,
  nextStatuses,
  orderStatusLabels,
  orderStatusTones,
} from "./status"

describe("order status transitions", () => {
  const legal: Array<[OrderStatus, OrderStatus]> = [
    ["pending", "confirmed"],
    ["pending", "cancelled"],
    ["confirmed", "preparing"],
    ["confirmed", "cancelled"],
    ["preparing", "ready"],
    ["preparing", "cancelled"],
    ["ready", "completed"],
    ["ready", "cancelled"],
  ]

  it("accepts exactly the legal transitions", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = legal.some(
          ([legalFrom, legalTo]) => legalFrom === from && legalTo === to,
        )
        expect(canTransitionStatus(from, to)).toBe(expected)
      }
    }
  })

  it("never advances out of a terminal state", () => {
    expect(nextStatuses("completed")).toEqual([])
    expect(nextStatuses("cancelled")).toEqual([])
  })

  it("labels and tones every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(orderStatusLabels[status]).toBeTruthy()
      expect(orderStatusTones[status]).toBeTruthy()
    }
  })
})
