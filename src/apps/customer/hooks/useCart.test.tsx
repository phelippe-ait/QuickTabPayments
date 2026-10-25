import { beforeEach, describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { MenuItem } from "../types"
import { cartStorageKey, parseCart, useCart } from "./useCart"

const coffee: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "",
  price: 4.7,
  imageUrl: null,
  allergens: [],
  categoryId: "category-1",
  displayOrder: 0,
}

const toast: MenuItem = {
  id: "item-2",
  name: "Toast",
  description: "",
  price: 11.5,
  imageUrl: null,
  allergens: [],
  categoryId: "category-1",
  displayOrder: 1,
}

const tableA = { slug: "quicktab-demo-cafe", tableToken: "table-a" }
const tableB = { slug: "quicktab-demo-cafe", tableToken: "table-b" }

describe("useCart", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("adds, increases, decreases and removes lines by menu item id", () => {
    const { result } = renderHook(() => useCart(tableA))

    act(() => result.current.add(coffee, 2))
    expect(result.current.count).toBe(2)
    expect(result.current.total).toBe(9.4)

    act(() => result.current.increase("item-1"))
    expect(result.current.items[0].quantity).toBe(3)

    act(() => result.current.decrease("item-1"))
    expect(result.current.items[0].quantity).toBe(2)

    act(() => result.current.decrease("item-1"))
    act(() => result.current.decrease("item-1"))
    expect(result.current.items).toHaveLength(0)

    act(() => result.current.add(toast, 1))
    act(() => result.current.remove("item-2"))
    expect(result.current.items).toEqual([])
  })

  it("persists per restaurant + table and survives a remount", () => {
    const first = renderHook(() => useCart(tableA))
    act(() => first.result.current.add(coffee, 2))

    const stored = window.sessionStorage.getItem(cartStorageKey(tableA))
    expect(parseCart(stored)).toEqual([
      { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 2 },
    ])

    first.unmount()
    const reloaded = renderHook(() => useCart(tableA))
    expect(reloaded.result.current.items).toEqual([
      { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 2 },
    ])
    expect(reloaded.result.current.total).toBe(9.4)
  })

  it("isolates carts between tables", () => {
    const { result, rerender } = renderHook(({ source }) => useCart(source), {
      initialProps: { source: tableA },
    })

    act(() => result.current.add(coffee, 1))
    rerender({ source: tableB })
    expect(result.current.items).toEqual([])

    act(() => result.current.add(toast, 1))
    rerender({ source: tableA })
    expect(result.current.items).toEqual([
      { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 1 },
    ])
  })

  it("drops unavailable lines and refreshes prices during reconciliation", () => {
    const { result } = renderHook(() => useCart(tableA))
    act(() => {
      result.current.add(coffee, 1)
      result.current.add(toast, 1)
    })

    act(() =>
      result.current.reconcile([
        { ...coffee, price: 5.0, name: "Flat White (new)" },
      ]),
    )

    expect(result.current.items).toEqual([
      {
        menuItemId: "item-1",
        name: "Flat White (new)",
        unitPrice: 5,
        quantity: 1,
      },
    ])
    expect(result.current.total).toBe(5)
  })

  it("clears the cart and removes its storage key", () => {
    const { result } = renderHook(() => useCart(tableA))
    act(() => result.current.add(coffee, 1))
    expect(window.sessionStorage.getItem(cartStorageKey(tableA))).not.toBeNull()

    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
    expect(window.sessionStorage.getItem(cartStorageKey(tableA))).toBeNull()
  })

  it("does not allow checkout without a QR context", () => {
    const { result } = renderHook(() => useCart(null))
    expect(result.current.canCheckout).toBe(false)
  })
})

describe("parseCart", () => {
  it("ignores malformed and legacy payloads", () => {
    expect(parseCart(null)).toEqual([])
    expect(parseCart("{bad json")).toEqual([])
    expect(parseCart(JSON.stringify({ version: 1, items: [{ nope: true }] }))).toEqual([])
  })

  it("deduplicates rows and rejects non-positive quantities", () => {
    expect(
      parseCart(
        JSON.stringify({
          version: 1,
          items: [
            { menuItemId: "a", name: "A", unitPrice: 1, quantity: 1 },
            { menuItemId: "a", name: "A", unitPrice: 1, quantity: 3 },
            { menuItemId: "b", name: "B", unitPrice: 2, quantity: 0 },
          ],
        }),
      ),
    ).toEqual([{ menuItemId: "a", name: "A", unitPrice: 1, quantity: 1 }])
  })
})
