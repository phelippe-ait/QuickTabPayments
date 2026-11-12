import { describe, expect, it } from "vitest"
import { mapStaffOrderError } from "./staffOrders"

describe("mapStaffOrderError", () => {
  it("maps the transition guard error to friendly copy", () => {
    expect(mapStaffOrderError("invalid_status_transition")).toBe(
      "That status change isn't allowed. Refresh the order and try again.",
    )
  })

  it("passes unknown database errors through unchanged", () => {
    expect(mapStaffOrderError("permission denied for table orders")).toBe(
      "permission denied for table orders",
    )
  })
})
