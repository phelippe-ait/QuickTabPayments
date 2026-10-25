/** Running time for an open order, from its ISO `created_at`. */
export function formatRunningTime(createdAt: string, now: number): string {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return "unknown"

  const minutes = Math.max(0, Math.floor((now - created) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Refund state from numeric values only — never parse a formatted money
 * string. Returns null when nothing has been refunded.
 */
export function getRefundStatus(
  refundedTotal: number,
  total: number,
): "Refunded" | "Partial refund" | null {
  if (refundedTotal <= 0) return null
  return refundedTotal >= total ? "Refunded" : "Partial refund"
}
