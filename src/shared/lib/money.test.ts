import { describe, expect, it } from "vitest"
import { computeTipPreview, formatMoney, roundMoney, splitInclusiveTax } from "./money"

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

describe("computeTipPreview", () => {
  it("returns zero for no tip", () => {
    expect(computeTipPreview(42, null)).toBe(0)
    expect(computeTipPreview(42, undefined)).toBe(0)
    expect(computeTipPreview(42, { type: "none" })).toBe(0)
  })

  it("computes percentage tips on the post-tax total", () => {
    expect(computeTipPreview(42, { type: "percent", value: 0 })).toBe(0)
    expect(computeTipPreview(42, { type: "percent", value: 10 })).toBe(4.2)
    expect(computeTipPreview(42, { type: "percent", value: 25 })).toBe(10.5)
    // 4.255 rounds half-up to 4.26, matching Postgres numeric rounding.
    expect(computeTipPreview(42.55, { type: "percent", value: 10 })).toBe(4.26)
  })

  it("computes fixed tips", () => {
    expect(computeTipPreview(42, { type: "fixed", value: 0 })).toBe(0)
    expect(computeTipPreview(42, { type: "fixed", value: 5.5 })).toBe(5.5)
    expect(computeTipPreview(42, { type: "fixed", value: 500 })).toBe(500)
    expect(computeTipPreview(42, { type: "fixed", value: 2.345 })).toBe(2.35)
  })

  it("rejects values outside the SQL caps", () => {
    expect(() => computeTipPreview(42, { type: "percent", value: -5 })).toThrow(
      "invalid_tip",
    )
    expect(() => computeTipPreview(42, { type: "percent", value: 25.01 })).toThrow(
      "invalid_tip",
    )
    expect(() => computeTipPreview(42, { type: "fixed", value: -1 })).toThrow(
      "invalid_tip",
    )
    expect(() => computeTipPreview(42, { type: "fixed", value: 500.01 })).toThrow(
      "invalid_tip",
    )
  })

  it("rejects bad types and non-finite values", () => {
    expect(() =>
      computeTipPreview(42, { type: "bogus" } as never),
    ).toThrow("invalid_tip")
    expect(() =>
      computeTipPreview(42, { type: "percent", value: Number.NaN }),
    ).toThrow("invalid_tip")
    expect(() =>
      computeTipPreview(42, { type: "fixed", value: Number.POSITIVE_INFINITY }),
    ).toThrow("invalid_tip")
  })
})
