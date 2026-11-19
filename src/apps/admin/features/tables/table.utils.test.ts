import { describe, expect, it } from "vitest"
import {
  formatElapsed,
  normaliseSeats,
  tableOccupancyState,
} from "./table.utils"

describe("formatElapsed", () => {
  const now = new Date("2026-10-21T10:00:00Z").getTime()

  it("formats minutes and hours from an ISO timestamp", () => {
    expect(formatElapsed("2026-10-21T09:35:00Z", now)).toBe("25 min ago")
    expect(formatElapsed("2026-10-21T08:30:00Z", now)).toBe("1h 30m ago")
    expect(formatElapsed("2026-10-21T10:00:00Z", now)).toBe("just now")
  })

  it("copes with an invalid timestamp", () => {
    expect(formatElapsed("not-a-date", now)).toBe("just now")
  })
})

describe("tableOccupancyState", () => {
  it("treats an open order or staff-seated table as occupied", () => {
    expect(tableOccupancyState("available", true)).toBe("occupied")
    expect(tableOccupancyState("occupied", false)).toBe("occupied")
  })

  it("keeps cleaning distinct only while no order is open", () => {
    expect(tableOccupancyState("needs_cleaning", false)).toBe("needs_cleaning")
    expect(tableOccupancyState("needs_cleaning", true)).toBe("occupied")
    expect(tableOccupancyState("available", false)).toBe("free")
  })
})

describe("normaliseSeats", () => {
  it("returns null for Pick-up tables", () => {
    expect(normaliseSeats("Pick-up", "4")).toBeNull()
    expect(normaliseSeats("pick-up", "")).toBeNull()
  })

  it("keeps numeric seats for dine-in tables", () => {
    expect(normaliseSeats("Indoors", "4")).toBe(4)
    expect(normaliseSeats("Outdoors", "")).toBeNull()
  })
})
