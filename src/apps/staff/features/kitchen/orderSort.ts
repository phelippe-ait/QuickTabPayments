/**
 * Kitchen boards are worked oldest-first: the guest who has waited longest is
 * the most urgent. Missing/unparseable `created_at` values sink to the top so
 * they cannot hide behind a valid timestamp.
 */
export function sortOrdersOldestFirst<T extends { createdAt?: string }>(
  orders: readonly T[],
): T[] {
  return [...orders].sort(
    (left, right) => createdAtMs(left.createdAt) - createdAtMs(right.createdAt),
  )
}

function createdAtMs(createdAt: string | undefined): number {
  if (!createdAt) return 0
  const parsed = Date.parse(createdAt)
  return Number.isNaN(parsed) ? 0 : parsed
}
