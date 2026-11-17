import { describe, expect, it } from "vitest"
import {
  nextTableStatus,
  tableStatusActionLabels,
  tableStatusAnnouncement,
  tableStatusLabels,
  tableStatusTone,
} from "./tableStatus"

describe("nextTableStatus", () => {
  it("cycles available → occupied → needs_cleaning → available", () => {
    expect(nextTableStatus("available")).toBe("occupied")
    expect(nextTableStatus("occupied")).toBe("needs_cleaning")
    expect(nextTableStatus("needs_cleaning")).toBe("available")
  })
})

describe("table status presentation", () => {
  it("labels every state for staff", () => {
    expect(tableStatusLabels).toEqual({
      available: "Available",
      occupied: "Occupied",
      needs_cleaning: "Needs cleaning",
    })
    expect(tableStatusActionLabels.available).toBe("Seat guests")
    expect(tableStatusActionLabels.occupied).toBe("Mark for cleaning")
    expect(tableStatusActionLabels.needs_cleaning).toBe("Mark clean")
  })

  it("maps tones to the shared status palette", () => {
    expect(tableStatusTone("available")).toBe("success")
    expect(tableStatusTone("occupied")).toBe("info")
    expect(tableStatusTone("needs_cleaning")).toBe("warning")
  })

  it("builds the live-region announcement", () => {
    expect(tableStatusAnnouncement("4", "occupied")).toBe(
      "Table 4 is now occupied.",
    )
    expect(tableStatusAnnouncement("12", "needs_cleaning")).toBe(
      "Table 12 needs cleaning.",
    )
  })
})
