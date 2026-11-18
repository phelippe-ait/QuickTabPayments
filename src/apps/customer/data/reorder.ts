import { roundMoney } from "@shared/lib/money"
import type { CartItem, MenuItem, ModifierChoice } from "../types"
import { buildOrderItemKey } from "./orderItemKey"

/** One line of a past order, as snapshotted when it was placed. */
export type ReorderSourceItem = {
  /** `null`/empty when the history row predates the id snapshot. */
  menuItemId: string | null
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  modifiers?: Array<{
    id: string | null
    name: string
    priceAdjustment: number
  }>
}

export type SkippedItem = {
  name: string
  quantity: number
  reason: string
}

export type ReorderCart = {
  items: CartItem[]
  skipped: SkippedItem[]
}

/**
 * Rebuild a cart from a past order using the *current* menu.
 *
 * Snapshots are display-only: item names, availability and prices all come
 * from `menuItems`, and every snapshotted modifier id is checked against the
 * live item's groups. Selections that disappeared are dropped (and reported)
 * so the cart never carries ids that `place_order` would reject.
 *
 * Public menu RLS already hides unavailable items, so an item missing from
 * `menuItems` covers both "sold out" and "removed".
 */
export function buildReorderCart(
  orderItems: ReorderSourceItem[],
  menuItems: MenuItem[],
): ReorderCart {
  const menuById = new Map(menuItems.map((item) => [item.id, item]))
  const skipped: SkippedItem[] = []
  const merged = new Map<string, CartItem>()

  for (const source of orderItems) {
    const quantity = Math.trunc(Number(source.quantity))
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const menuItem = source.menuItemId
      ? menuById.get(source.menuItemId)
      : undefined

    if (!menuItem) {
      skipped.push({
        name: source.name,
        quantity,
        reason: "No longer available",
      })
      continue
    }

    const choices: ModifierChoice[] = []
    const dropped = new Set<string>()
    for (const modifier of source.modifiers ?? []) {
      const choice = findCurrentModifier(menuItem, modifier.id)
      if (choice) {
        choices.push(choice)
      } else {
        dropped.add(modifier.name)
      }
    }

    const rule = firstUnsatisfiedGroup(menuItem, choices)
    if (rule) {
      skipped.push({
        name: menuItem.name,
        quantity,
        reason: `Required choice for ${rule} is no longer available`,
      })
      continue
    }

    for (const name of dropped) {
      skipped.push({
        name: menuItem.name,
        quantity,
        reason: `${name} unavailable — added without it`,
      })
    }

    const unitPrice = roundMoney(
      menuItem.price +
        choices.reduce((sum, modifier) => sum + modifier.priceAdjustment, 0),
    )
    const lineId = buildOrderItemKey(
      menuItem.id,
      choices.map((modifier) => modifier.id),
    )
    const existing = merged.get(lineId)
    if (existing) {
      existing.quantity += quantity
      continue
    }

    merged.set(lineId, {
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity,
      ...(choices.length > 0
        ? { lineId, baseUnitPrice: menuItem.price, modifiers: choices }
        : {}),
    })
  }

  return { items: [...merged.values()], skipped }
}

function findCurrentModifier(
  item: MenuItem,
  modifierId: string | null,
): ModifierChoice | null {
  if (!modifierId) return null
  for (const group of item.modifierGroups ?? []) {
    const option = group.options.find((entry) => entry.id === modifierId)
    if (option) {
      return {
        id: option.id,
        name: option.name,
        priceAdjustment: option.priceAdjustment,
        groupName: group.name,
      }
    }
  }
  return null
}

/**
 * Re-check the live group rules after unavailable modifiers are dropped.
 * Returns the first group that can no longer be satisfied, if any.
 */
function firstUnsatisfiedGroup(
  item: MenuItem,
  choices: ModifierChoice[],
): string | null {
  for (const group of item.modifierGroups ?? []) {
    const selected = choices.filter((choice) =>
      group.options.some((option) => option.id === choice.id),
    ).length

    if (selected < group.minSelections) return group.name
    if (group.selectionType === "single" && selected > 1) return group.name
    if (group.maxSelections > 0 && selected > group.maxSelections) {
      return group.name
    }
  }
  return null
}
