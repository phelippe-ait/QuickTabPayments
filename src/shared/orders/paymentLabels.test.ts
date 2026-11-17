import { describe, expect, it } from "vitest";
import type { PaymentStatus } from "@shared/lib/database.types";
import {
  paymentFlowLabel,
  paymentFlowLabels,
  paymentStatusLabels,
  paymentSummaryLabel,
  paymentSummaryTone,
} from "./paymentLabels";

describe("payment labels", () => {
  it("labels every stored payment status", () => {
    const statuses = Object.keys(paymentStatusLabels) as PaymentStatus[];
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(paymentStatusLabels[status].trim()).not.toBe("");
    }
  });

  it("labels every checkout progress state", () => {
    for (const label of Object.values(paymentFlowLabels)) {
      expect(label.trim()).not.toBe("");
    }
  });

  it("adds the reason to a failed payment announcement", () => {
    expect(paymentFlowLabel("failed")).toBe("Payment failed");
    expect(paymentFlowLabel("failed", "Your card was declined.")).toBe(
      "Payment failed — Your card was declined.",
    );
  });
});

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
