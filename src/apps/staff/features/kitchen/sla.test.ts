import { describe, expect, it } from "vitest"
import {
  SLA_AMBER_MINUTES,
  SLA_RED_MINUTES,
  formatElapsedMinutes,
  getElapsedMinutes,
  getSlaLevel,
} from "./sla"

describe("getSlaLevel", () => {
  it("is green below the amber threshold", () => {
    expect(getSlaLevel(0)).toBe("green")
    expect(getSlaLevel(SLA_AMBER_MINUTES - 1)).toBe("green")
  })

  it("is amber from 10 through 20 minutes inclusive", () => {
    expect(getSlaLevel(SLA_AMBER_MINUTES)).toBe("amber")
    expect(getSlaLevel(SLA_RED_MINUTES)).toBe("amber")
  })

  it("is red above 20 minutes", () => {
    expect(getSlaLevel(SLA_RED_MINUTES + 1)).toBe("red")
    expect(getSlaLevel(120)).toBe("red")
  })
})

describe("getElapsedMinutes", () => {
  const now = Date.parse("2026-11-17T10:20:00.000Z")

  it("floors whole minutes since created_at", () => {
    expect(getElapsedMinutes("2026-11-17T10:08:30.000Z", now)).toBe(11)
  })

  it("clamps future or invalid timestamps to zero", () => {
    expect(getElapsedMinutes("2026-11-17T10:25:00.000Z", now)).toBe(0)
    expect(getElapsedMinutes("not-a-date", now)).toBe(0)
    expect(getElapsedMinutes(undefined, now)).toBe(0)
  })
})

describe("formatElapsedMinutes", () => {
  it("renders the compact minutes label used on cards", () => {
    expect(formatElapsedMinutes(12)).toBe("12m")
    expect(formatElapsedMinutes(0)).toBe("0m")
    expect(formatElapsedMinutes(-2)).toBe("0m")
  })
})
