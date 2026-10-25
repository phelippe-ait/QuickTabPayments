import { describe, expect, it } from "vitest"
import { formatMoney } from "./money"

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
