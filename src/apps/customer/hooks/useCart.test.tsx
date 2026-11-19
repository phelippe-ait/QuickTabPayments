import { beforeEach, describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { CartItem, MenuItem, ModifierChoice } from "../types"
import { persistQrSource } from "../data/qrContext"
import {
  cartLineId,
  cartStorageKey,
  parseCart,
  pendingOrderStorageKey,
  readPendingOrderToken,
  readStoredCart,
  reconcilePaidOrderCart,
  rememberPendingOrder,
  useCart,
  writeStoredCart,
} from "./useCart"

const coffee: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "",
  price: 4.7,
  imageUrl: null,
  allergens: [],
  dietaryTags: [],
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
  dietaryTags: [],
  categoryId: "category-1",
  displayOrder: 1,
}

const tableA = { slug: "quicktab-demo-cafe", tableToken: "table-a" }
const tableB = { slug: "quicktab-demo-cafe", tableToken: "table-b" }

const oatMilk: ModifierChoice = {
  id: "mod-oat-milk",
  name: "Oat milk",
  priceAdjustment: 0.5,
  groupName: "Milk",
}

const syrup: ModifierChoice = {
  id: "mod-syrup",
  name: "Vanilla syrup",
  priceAdjustment: 0.5,
  groupName: "Extras",
}

describe("useCart", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("adds, increases, decreases and removes lines by menu item id", () => {
    const { result } = renderHook(() => useCart(tableA))

    act(() => result.current.add(coffee, 2))
    expect(result.current.count).toBe(2)
    expect(result.current.total).toBe(9.4)

    act(() => result.current.increase(cartLineId("item-1")))
    expect(result.current.items[0].quantity).toBe(3)

    act(() => result.current.decrease(cartLineId("item-1")))
    expect(result.current.items[0].quantity).toBe(2)

    act(() => result.current.decrease(cartLineId("item-1")))
    act(() => result.current.decrease(cartLineId("item-1")))
    expect(result.current.items).toHaveLength(0)

    act(() => result.current.add(toast, 1))
    act(() => result.current.remove(cartLineId("item-2")))
    expect(result.current.items).toEqual([])
  })

  it("keeps different modifier sets separate and merges identical ones", () => {
    const { result } = renderHook(() => useCart(tableA))

    act(() => result.current.add(coffee, 1, [oatMilk]))
    act(() => result.current.add(coffee, 1, [oatMilk]))
    act(() => result.current.add(coffee, 1, [oatMilk, syrup]))

    expect(result.current.items).toHaveLength(2)

    const plain = result.current.items.find(
      (line) => line.lineId === cartLineId("item-1", [oatMilk]),
    )
    const loaded = result.current.items.find(
      (line) => line.lineId === cartLineId("item-1", [oatMilk, syrup]),
    )

    expect(plain).toMatchObject({ quantity: 2, unitPrice: 5.2 })
    expect(loaded).toMatchObject({ quantity: 1, unitPrice: 5.7 })
    expect(result.current.total).toBe(16.1)
  })

  it("ignores modifier id ordering when merging the same combination", () => {
    const { result } = renderHook(() => useCart(tableA))

    act(() => result.current.add(coffee, 1, [oatMilk, syrup]))
    act(() => result.current.add(coffee, 1, [syrup, oatMilk]))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({ quantity: 2, unitPrice: 5.7 })
  })

  it("merges reordered lines into the existing cart", () => {
    const { result } = renderHook(() => useCart(tableA))
    act(() => result.current.add(coffee, 1, [oatMilk]))

    act(() =>
      result.current.addLines([
        {
          menuItemId: "item-1",
          name: "Flat White",
          baseUnitPrice: 4.7,
          unitPrice: 5.2,
          quantity: 2,
          lineId: cartLineId("item-1", [oatMilk]),
          modifiers: [oatMilk],
        },
        {
          menuItemId: "item-2",
          name: "Toast",
          unitPrice: 11.5,
          quantity: 1,
        },
      ]),
    )

    expect(result.current.items).toHaveLength(2)
    expect(
      result.current.items.find((line) => line.menuItemId === "item-1"),
    ).toMatchObject({ quantity: 3, unitPrice: 5.2 })
    expect(result.current.total).toBe(27.1)
  })

  it("persists the selected modifiers with the line", () => {
    const { result } = renderHook(() => useCart(tableA))
    act(() => result.current.add(coffee, 2, [oatMilk]))

    const stored = parseCart(window.sessionStorage.getItem(cartStorageKey(tableA)))
    expect(stored[0]).toMatchObject({
      lineId: cartLineId("item-1", [oatMilk]),
      baseUnitPrice: 4.7,
      unitPrice: 5.2,
      quantity: 2,
      modifiers: [oatMilk],
    })
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

describe("reconcilePaidOrderCart", () => {
  const line: CartItem = {
    menuItemId: "item-1",
    name: "Flat White",
    unitPrice: 4.7,
    quantity: 1,
  }

  beforeEach(() => {
    window.sessionStorage.clear()
    persistQrSource(tableA)
    writeStoredCart(cartStorageKey(tableA), [line])
    rememberPendingOrder(tableA, "tracking-1")
  })

  it("clears the cart for the matching paid order and forgets the token", () => {
    expect(reconcilePaidOrderCart("tracking-1", "succeeded")).toBe(true)
    expect(readStoredCart(cartStorageKey(tableA))).toEqual([])
    expect(readPendingOrderToken(tableA)).toBeNull()
    expect(
      window.sessionStorage.getItem(pendingOrderStorageKey(tableA)),
    ).toBeNull()
  })

  it("leaves the cart untouched while the order is not paid", () => {
    expect(reconcilePaidOrderCart("tracking-1", "pending")).toBe(false)
    expect(readStoredCart(cartStorageKey(tableA))).toEqual([line])
    expect(readPendingOrderToken(tableA)).toBe("tracking-1")
  })

  it("leaves the cart untouched for a different tracking token", () => {
    expect(reconcilePaidOrderCart("tracking-2", "succeeded")).toBe(false)
    expect(readStoredCart(cartStorageKey(tableA))).toEqual([line])
    expect(readPendingOrderToken(tableA)).toBe("tracking-1")
  })

  it("is a no-op when there is no stored QR context", () => {
    window.sessionStorage.clear()
    expect(reconcilePaidOrderCart("tracking-1", "succeeded")).toBe(false)
  })
})
