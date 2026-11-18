import { describe, expect, it } from "vitest"
import { buildOrderItemKey } from "./orderItemKey"

describe("buildOrderItemKey", () => {
  it("sorts modifier ids so selection order does not matter", () => {
    const a = buildOrderItemKey("item-1", ["mod-b", "mod-a"])
    const b = buildOrderItemKey("item-1", ["mod-a", "mod-b"])

    expect(a).toBe(b)
    expect(a).toBe("item-1::mod-a,mod-b")
  })

  it("keeps different items and different modifier sets separate", () => {
    const plain = buildOrderItemKey("item-1", [])
    const milky = buildOrderItemKey("item-1", ["mod-milk"])
    const other = buildOrderItemKey("item-2", [])

    expect(new Set([plain, milky, other]).size).toBe(3)
  })

  it("does not mutate the input array", () => {
    const modifiers = ["mod-b", "mod-a"]
    buildOrderItemKey("item-1", modifiers)

    expect(modifiers).toEqual(["mod-b", "mod-a"])
  })
})
