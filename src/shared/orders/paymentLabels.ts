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
