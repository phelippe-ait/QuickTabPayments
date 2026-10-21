import type { OrderLineVM, PaymentVM } from "../../types"

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Succeeded payments minus everything already refunded. */
export function refundableBalance(
  payments: PaymentVM[],
  refundedTotal: number,
): number {
  const paid = payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((total, payment) => total + payment.amount, 0)
  return Math.max(0, roundMoney(paid - refundedTotal))
}

/** Partial refunds are keyed by order line id, never by item name. */
export function partialRefundAmount(
  lines: OrderLineVM[],
  quantities: Record<string, number>,
): number {
  return roundMoney(
    lines.reduce(
      (total, line) =>
        total + line.unitPrice * Math.max(0, quantities[line.id] ?? 0),
      0,
    ),
  )
}

export function validateRefundAmount(
  amount: number,
  balance: number,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a refund amount greater than zero."
  }
  if (amount > balance) {
    return "Refund cannot exceed the remaining balance."
  }
  return null
}
