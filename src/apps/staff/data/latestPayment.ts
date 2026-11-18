import type { PaymentStatus } from "@shared/lib/database.types"

export type StaffPaymentRow = {
  status: PaymentStatus
  created_at?: string | null
}

function isSettled(status: PaymentStatus): boolean {
  return status === "succeeded" || status === "refunded"
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Mirrors `get_order_tracking`'s `latest_payment` lateral: prefer a settled
 * payment (succeeded/refunded) over a newer failed or pending attempt, then the
 * most recent row. Without this, a retried payment can leave the UI showing an
 * old "Payment confirming" row.
 */
export function selectLatestPayment<T extends StaffPaymentRow>(
  payments: T[] | null | undefined,
): T | undefined {
  if (!payments?.length) return undefined

  return payments.reduce((best, payment) => {
    const bestSettled = isSettled(best.status)
    const paymentSettled = isSettled(payment.status)

    if (bestSettled !== paymentSettled) {
      return paymentSettled ? payment : best
    }

    return timestamp(payment.created_at) > timestamp(best.created_at)
      ? payment
      : best
  })
}
