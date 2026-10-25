import { describe, expect, it } from "vitest";
import { percentToTaxRate, taxRateToPercent } from "./settings.utils";

describe("tax rate mapping", () => {
  it("formats a stored fraction as a percent", () => {
    expect(taxRateToPercent(0.1)).toBe("10");
    expect(taxRateToPercent(0.075)).toBe("7.5");
    expect(taxRateToPercent(1)).toBe("100");
  });

  it("parses a percent back into a fraction", () => {
    expect(percentToTaxRate("10")).toBe(0.1);
    expect(percentToTaxRate("7.5")).toBe(0.075);
    expect(percentToTaxRate("0")).toBe(0);
  });

  it("returns NaN for invalid input", () => {
    expect(Number.isNaN(percentToTaxRate(""))).toBe(true);
    expect(Number.isNaN(percentToTaxRate("abc"))).toBe(true);
  });
});
