/**
 * Ids present in `incomingOrders` that were not in `previousIds`.
 *
 * `previousIds === null` means "this is the first hydration of the board", so
 * nothing is considered new — pre-existing orders must never trigger a sound.
 */
export function findNewOrderIds(
  previousIds: ReadonlySet<string> | null,
  incomingOrders: ReadonlyArray<{ id: string }>,
): string[] {
  if (!previousIds) return []

  const additions: string[] = []
  const seen = new Set<string>()

  for (const order of incomingOrders) {
    if (previousIds.has(order.id) || seen.has(order.id)) continue
    seen.add(order.id)
    additions.push(order.id)
  }

  return additions
}
