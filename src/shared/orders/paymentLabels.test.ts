import { describe, expect, it } from "vitest";
import { paymentSummaryLabel, paymentSummaryTone } from "./paymentLabels";

describe("paymentSummaryLabel", () => {
  it("returns null when there is no payment", () => {
    expect(paymentSummaryLabel(null, 0)).toBeNull();
  });

  it("labels a succeeded payment with refunds as partially refunded", () => {
    expect(paymentSummaryLabel("succeeded", 1.2)).toBe("Partially refunded");
    expect(paymentSummaryTone("succeeded", 1.2)).toBe("warning");
  });

  it("labels a fully refunded payment as refunded", () => {
    expect(paymentSummaryLabel("refunded", 4.7)).toBe("Refunded");
    expect(paymentSummaryTone("refunded", 4.7)).toBe("warning");
  });

  it("passes through other statuses", () => {
    expect(paymentSummaryLabel("succeeded", 0)).toBe("Paid");
    expect(paymentSummaryLabel("pending", 0)).toBe("Payment confirming");
    expect(paymentSummaryLabel("failed", 0)).toBe("Payment failed");
  });
});
