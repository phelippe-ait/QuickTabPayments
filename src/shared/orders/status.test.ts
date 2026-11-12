import { describe, expect, it } from "vitest"
import type { OrderStatus } from "@shared/lib/database.types"
import {
  ORDER_STATUSES,
  canTransitionStatus,
  nextStatuses,
  orderStatusLabels,
  orderStatusTones,
} from "./status"

// Copied from the CASE list in
// supabase/migrations/0022_order_status_transition_guard.sql. The duplicate is
// intentional: this test fails if the client matrix and the DB trigger drift.
const DB_TRANSITION_MATRIX: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

describe("order status transitions", () => {
  it("matches the DB trigger matrix for every status pair", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransitionStatus(from, to)).toBe(
          DB_TRANSITION_MATRIX[from].includes(to),
        )
      }
    }
  })

  it("exposes exactly the DB matrix through nextStatuses", () => {
    for (const from of ORDER_STATUSES) {
      expect(nextStatuses(from)).toEqual([...DB_TRANSITION_MATRIX[from]])
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
