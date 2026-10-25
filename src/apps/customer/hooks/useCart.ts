import { useCallback, useEffect, useState } from "react"
import { roundMoney } from "@shared/lib/money"
import type { CartItem, MenuItem } from "../types"
import type { QrSource } from "../data/qrContext"

export const CART_STORAGE_PREFIX = "quicktab:cart"

export function cartStorageKey(source: QrSource): string {
  return `${CART_STORAGE_PREFIX}:${source.slug}:${source.tableToken}`
}

export function serializeCart(items: CartItem[]): string {
  return JSON.stringify({ version: 1, items })
}

/** Tolerant parser: malformed/old storage must never break ordering. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    const rows =
      parsed && typeof parsed === "object" && "items" in parsed
        ? (parsed as { items?: unknown }).items
        : parsed
    if (!Array.isArray(rows)) return []

    const seen = new Set<string>()
    return rows.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return []
      const row = entry as Record<string, unknown>
      if (typeof row.menuItemId !== "string") return []
      if (typeof row.name !== "string") return []
      const unitPrice = Number(row.unitPrice)
      const quantity = Math.trunc(Number(row.quantity))
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return []
      if (!Number.isFinite(quantity) || quantity <= 0) return []
      if (seen.has(row.menuItemId)) return []
      seen.add(row.menuItemId)
      return [{ menuItemId: row.menuItemId, name: row.name, unitPrice, quantity }]
    })
  } catch {
    return []
  }
}

export function readStoredCart(storageKey: string | null): CartItem[] {
  if (!storageKey) return []
  try {
    return parseCart(window.sessionStorage.getItem(storageKey))
  } catch {
    return []
  }
}

export function writeStoredCart(
  storageKey: string | null,
  items: CartItem[],
): void {
  if (!storageKey) return
  try {
    if (items.length === 0) {
      window.sessionStorage.removeItem(storageKey)
    } else {
      window.sessionStorage.setItem(storageKey, serializeCart(items))
    }
  } catch {
    // Storage may be unavailable; the in-memory cart still works.
  }
}

type CartState = { key: string | null; items: CartItem[] }

/**
 * Cart state keyed by `menu_item_id`, persisted per restaurant + table in
 * `sessionStorage`. A context switch loads that context's own cart; it never
 * carries lines across tables.
 */
export function useCart(source: QrSource | null) {
  const storageKey = source ? cartStorageKey(source) : null
  const [state, setState] = useState<CartState>(() => ({
    key: storageKey,
    items: readStoredCart(storageKey),
  }))

  // Adopt the persisted cart when the QR context changes (or arrives). This is
  // the documented "adjust state when props change" render-phase pattern, not
  // an effect, so it does not cascade renders.
  if (state.key !== storageKey) {
    setState({ key: storageKey, items: readStoredCart(storageKey) })
  }

  // Persist only the active context; a stale key must never write its lines
  // into the new table's cart.
  useEffect(() => {
    if (state.key === storageKey) writeStoredCart(storageKey, state.items)
  }, [state, storageKey])

  const update = useCallback(
    (updater: (items: CartItem[]) => CartItem[]) => {
      setState((current) => {
        const base =
          current.key === storageKey
            ? current.items
            : readStoredCart(storageKey)
        return { key: storageKey, items: updater(base) }
      })
    },
    [storageKey],
  )

  const add = useCallback(
    (item: MenuItem, amount = 1) => {
      const quantity = Math.max(1, Math.trunc(amount))
      update((items) => {
        const existing = items.find((line) => line.menuItemId === item.id)
        if (existing) {
          return items.map((line) =>
            line.menuItemId === item.id
              ? {
                  ...line,
                  name: item.name,
                  unitPrice: item.price,
                  quantity: line.quantity + quantity,
                }
              : line,
          )
        }
        return [
          ...items,
          {
            menuItemId: item.id,
            name: item.name,
            unitPrice: item.price,
            quantity,
          },
        ]
      })
    },
    [update],
  )

  const increase = useCallback(
    (menuItemId: string) =>
      update((items) =>
        items.map((line) =>
          line.menuItemId === menuItemId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        ),
      ),
    [update],
  )

  const decrease = useCallback(
    (menuItemId: string) =>
      update((items) =>
        items.flatMap((line) => {
          if (line.menuItemId !== menuItemId) return [line]
          if (line.quantity <= 1) return []
          return [{ ...line, quantity: line.quantity - 1 }]
        }),
      ),
    [update],
  )

  const remove = useCallback(
    (menuItemId: string) =>
      update((items) => items.filter((line) => line.menuItemId !== menuItemId)),
    [update],
  )

  const clear = useCallback(() => {
    writeStoredCart(storageKey, [])
    setState({ key: storageKey, items: [] })
  }, [storageKey])

  /**
   * Drop lines that are no longer on the menu and refresh names/prices from
   * the authoritative menu. Availability changes are reflected immediately.
   */
  const reconcile = useCallback(
    (menuItems: MenuItem[]) => {
      const byId = new Map(menuItems.map((item) => [item.id, item]))
      update((items) => {
        const next = items.flatMap((line) => {
          const item = byId.get(line.menuItemId)
          if (!item) return []
          if (
            line.name === item.name &&
            line.unitPrice === item.price
          ) {
            return [line]
          }
          return [{ ...line, name: item.name, unitPrice: item.price }]
        })
        const unchanged =
          next.length === items.length &&
          next.every(
            (line, index) =>
              line.menuItemId === items[index]?.menuItemId &&
              line.name === items[index]?.name &&
              line.unitPrice === items[index]?.unitPrice &&
              line.quantity === items[index]?.quantity,
          )
        return unchanged ? items : next
      })
    },
    [update],
  )

  const items = state.key === storageKey ? state.items : []
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = roundMoney(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  )

  return {
    items,
    count,
    total,
    canCheckout: Boolean(source) && items.length > 0,
    add,
    increase,
    decrease,
    remove,
    clear,
    reconcile,
  }
}
