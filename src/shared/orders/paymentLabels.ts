import type {
  PaymentMethodType,
  PaymentStatus,
  RefundStatus,
} from "@shared/lib/database.types";
import type { StatusTone } from "@shared/ui/StatusPill";

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Payment confirming",
  succeeded: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

export const paymentStatusTones: Record<PaymentStatus, StatusTone> = {
  pending: "neutral",
  succeeded: "success",
  failed: "danger",
  refunded: "warning",
};

export const refundStatusLabels: Record<RefundStatus, string> = {
  requested: "Refund requested",
  succeeded: "Refunded",
  failed: "Refund failed",
};

export const refundStatusTones: Record<RefundStatus, StatusTone> = {
  requested: "warning",
  succeeded: "success",
  failed: "danger",
};

export const paymentMethodLabels: Record<PaymentMethodType, string> = {
  card: "Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  other: "Other",
};

export function paymentStatusLabel(
  status: PaymentStatus | null | undefined,
): string {
  return status ? paymentStatusLabels[status] : "Payment pending";
}

export function paymentMethodLabel(
  method: PaymentMethodType | null | undefined,
): string {
  return method ? paymentMethodLabels[method] : "—";
}

/**
 * Customer-facing payment label. A succeeded payment with refunds against it is
 * "Partially refunded"; the webhook flips it to `refunded` only when the whole
 * charge is refunded.
 */
export function paymentSummaryLabel(
  status: PaymentStatus | null | undefined,
  refundedTotal: number,
): string | null {
  if (!status) return null;
  if (status === "succeeded" && refundedTotal > 0) return "Partially refunded";
  return paymentStatusLabels[status];
}

export function paymentSummaryTone(
  status: PaymentStatus | null | undefined,
  refundedTotal: number,
): StatusTone | null {
  if (!status) return null;
  if (status === "succeeded" && refundedTotal > 0) return "warning";
  return paymentStatusTones[status];
}
