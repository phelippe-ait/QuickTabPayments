import { describe, expect, it } from "vitest"
import {
  MAX_PERIOD_DAYS,
  addDaysToDateKey,
  dateKeyInZone,
  formatPeriodLabel,
  getCustomPeriod,
  getPeriodRange,
  validateCustomRange,
} from "./period"

const now = new Date("2026-11-12T10:30:00Z")

describe("getPeriodRange", () => {
  it("starts today at local midnight and ends now", () => {
    expect(getPeriodRange("today", now, "UTC")).toEqual({
      preset: "today",
      from: "2026-11-12T00:00:00.000Z",
      to: now.toISOString(),
      fromDate: "2026-11-12",
      toDate: "2026-11-12",
    })
  })

  it("includes today plus the six previous days for the 7-day preset", () => {
    const range = getPeriodRange("7d", now, "UTC")

    expect(range.fromDate).toBe("2026-11-06")
    expect(range.from).toBe("2026-11-06T00:00:00.000Z")
    expect(range.toDate).toBe("2026-11-12")
  })

  it("includes today plus the twenty-nine previous days for the 30-day preset", () => {
    const range = getPeriodRange("30d", now, "UTC")

    expect(range.fromDate).toBe("2026-10-14")
    expect(range.from).toBe("2026-10-14T00:00:00.000Z")
  })

  it("uses the restaurant timezone for local midnight", () => {
    const range = getPeriodRange("today", now, "Australia/Sydney")

    // 10:30 UTC is 21:30 AEDT on the same day.
    expect(range.fromDate).toBe("2026-11-12")
    expect(range.from).toBe("2026-11-11T13:00:00.000Z")
  })
})

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-11-12", -29)).toBe("2026-10-14")
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("resolves the calendar date in an IANA timezone", () => {
    expect(dateKeyInZone(new Date("2026-11-12T20:00:00Z"), "UTC")).toBe(
      "2026-11-12",
    )
    expect(
      dateKeyInZone(new Date("2026-11-12T20:00:00Z"), "Australia/Sydney"),
    ).toBe("2026-11-13")
  })
})

describe("validateCustomRange", () => {
  it("accepts a normal range", () => {
    expect(validateCustomRange("2026-11-01", "2026-11-12")).toBeNull()
  })

  it("requires both dates", () => {
    expect(validateCustomRange("", "2026-11-12")).toMatch(/both/i)
    expect(validateCustomRange("2026-11-01", "")).toMatch(/both/i)
  })

  it("rejects a start date that is not before the end date", () => {
    expect(validateCustomRange("2026-11-12", "2026-11-12")).toMatch(
      /before/i,
    )
    expect(validateCustomRange("2026-11-13", "2026-11-12")).toMatch(
      /before/i,
    )
  })

  it("caps the range at 366 days inclusive", () => {
    expect(validateCustomRange("2025-11-12", "2026-11-12")).toBeNull()
    expect(validateCustomRange("2025-11-11", "2026-11-12")).toMatch(
      new RegExp(String(MAX_PERIOD_DAYS)),
    )
  })
})

describe("getCustomPeriod", () => {
  it("builds a half-open range at local midnight", () => {
    expect(getCustomPeriod("2026-11-01", "2026-11-12", "UTC")).toEqual({
      preset: "custom",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-13T00:00:00.000Z",
      fromDate: "2026-11-01",
      toDate: "2026-11-12",
    })
  })

  it("throws instead of building an invalid range", () => {
    expect(() => getCustomPeriod("2026-11-12", "2026-11-12", "UTC")).toThrow(
      RangeError,
    )
  })
})

describe("formatPeriodLabel", () => {
  it("renders a readable caption", () => {
    expect(
      formatPeriodLabel({
        fromDate: "2026-11-01",
        toDate: "2026-11-12",
      }),
    ).toContain("Nov 2026")
  })

  it("collapses a single day", () => {
    expect(
      formatPeriodLabel({ fromDate: "2026-11-12", toDate: "2026-11-12" }),
    ).not.toContain("–")
  })
})
