import { roundMoney } from "@shared/lib/money"
import { buildOrderItemKey } from "@shared/orders/orderItemKey"
import type {
  OrderingCartItem,
  OrderingMenuItem,
  OrderingModifierChoice,
} from "@shared/orders/orderingTypes"

/** A staff cart line always has the stable key used for merging. */
export type StaffOrderLine = OrderingCartItem & { lineId: string }

export function staffLineId(
  menuItemId: string,
  modifiers: OrderingModifierChoice[] = [],
): string {
  return buildOrderItemKey(
    menuItemId,
    modifiers.map((modifier) => modifier.id),
  )
}

/** Add a menu item + options, merging with an identical existing line. */
export function addStaffLine(
  lines: StaffOrderLine[],
  item: OrderingMenuItem,
  quantity: number,
  modifiers: OrderingModifierChoice[] = [],
): StaffOrderLine[] {
  const lineId = staffLineId(item.id, modifiers)
  const safeQuantity = Math.max(1, Math.trunc(quantity))
  const existing = lines.find((line) => line.lineId === lineId)
  if (existing) {
    return lines.map((line) =>
      line.lineId === lineId
        ? { ...line, quantity: line.quantity + safeQuantity }
        : line,
    )
  }

  const adjustment = modifiers.reduce(
    (sum, modifier) => sum + modifier.priceAdjustment,
    0,
  )
  return [
    ...lines,
    {
      lineId,
      menuItemId: item.id,
      name: item.name,
      baseUnitPrice: item.price,
      unitPrice: Math.max(0, roundMoney(item.price + adjustment)),
      quantity: safeQuantity,
      ...(modifiers.length > 0 ? { modifiers } : {}),
    },
  ]
}

/** Set a line quantity; zero or below removes the line. */
export function setStaffLineQuantity(
  lines: StaffOrderLine[],
  lineId: string,
  quantity: number,
): StaffOrderLine[] {
  if (!Number.isFinite(quantity) || Math.trunc(quantity) <= 0) {
    return removeStaffLine(lines, lineId)
  }
  return lines.map((line) =>
    line.lineId === lineId
      ? { ...line, quantity: Math.max(1, Math.trunc(quantity)) }
      : line,
  )
}

export function removeStaffLine(
  lines: StaffOrderLine[],
  lineId: string,
): StaffOrderLine[] {
  return lines.filter((line) => line.lineId !== lineId)
}

export function staffCartTotal(lines: StaffOrderLine[]): number {
  return roundMoney(
    lines.reduce(
      (total, line) => total + line.unitPrice * line.quantity,
      0,
    ),
  )
}

export function staffCartCount(lines: StaffOrderLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0)
}

/** RPC payload: only ids + quantities cross the wire; the server prices it. */
export type StaffOrderItemInput = {
  menu_item_id: string
  quantity: number
  modifiers?: string[]
}

export function toStaffOrderItems(
  lines: StaffOrderLine[],
): StaffOrderItemInput[] {
  return lines
    .filter((line) => line.quantity > 0)
    .map((line) => ({
      menu_item_id: line.menuItemId,
      quantity: Math.trunc(line.quantity),
      ...((line.modifiers?.length ?? 0) > 0
        ? { modifiers: line.modifiers!.map((modifier) => modifier.id) }
        : {}),
    }))
}
