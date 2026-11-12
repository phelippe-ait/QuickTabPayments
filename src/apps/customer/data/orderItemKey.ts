/**
 * Stable key for a cart line, mirroring the SQL grouping key used by
 * `place_order`: (menu_item_id, sorted modifier ids). Identical item + modifier
 * combinations share a key so the server can fold them into one order line.
 */
export function buildOrderItemKey(
  menuItemId: string,
  modifierIds: string[],
): string {
  const sorted = [...modifierIds].sort()
  return `${menuItemId}::${sorted.join(",")}`
}
