import { describe, expect, it } from "vitest"
import { formatMoney, roundMoney, splitInclusiveTax } from "./money"

describe("formatMoney", () => {
  it("formats numeric amounts with the restaurant currency", () => {
    expect(formatMoney(4.7, "AUD", "en-AU")).toBe("$4.70")
    expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,234.50")
  })

  it("never requires the caller to parse a formatted string", () => {
    const formatted = formatMoney(12.4, "AUD", "en-AU")
    expect(formatted).toBe("$12.40")
    expect(typeof formatted).toBe("string")
  })
})

describe("roundMoney", () => {
  it("rounds half-up without binary-float drift", () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.4272727)).toBe(0.43)
    expect(roundMoney(9.999)).toBe(10)
  })

  it("returns zero for non-finite input", () => {
    expect(roundMoney(Number.NaN)).toBe(0)
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe("splitInclusiveTax", () => {
  it("splits a GST-inclusive total to the cent", () => {
    // 4.70 is the paid price; 0.43 of it is the 10% GST component.
    expect(splitInclusiveTax(4.7, 0.1)).toEqual({ subtotal: 4.27, tax: 0.43 })
  })

  it("keeps subtotal + tax exactly equal to the total", () => {
    for (const total of [4.7, 12.5, 99.99, 100, 1234.56]) {
      const split = splitInclusiveTax(total, 0.1)
      expect(roundMoney(split.subtotal + split.tax)).toBe(total)
    }
  })

  it("returns the full total when the tax rate is zero", () => {
    expect(splitInclusiveTax(12.34, 0)).toEqual({ subtotal: 12.34, tax: 0 })
  })

  it("treats a negative or invalid rate as zero", () => {
    expect(splitInclusiveTax(10, -0.1)).toEqual({ subtotal: 10, tax: 0 })
    expect(splitInclusiveTax(10, Number.NaN)).toEqual({ subtotal: 10, tax: 0 })
  })
})
