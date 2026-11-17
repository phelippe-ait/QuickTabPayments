import { describe, expect, it } from "vitest"
import { findNewOrderIds } from "./findNewOrderIds"

describe("findNewOrderIds", () => {
  it("returns nothing for the initial hydration set", () => {
    expect(findNewOrderIds(null, [{ id: "A" }, { id: "B" }])).toEqual([])
  })

  it("returns only the additions, in incoming order", () => {
    const previous = new Set(["A", "B"])

    expect(
      findNewOrderIds(previous, [
        { id: "A" },
        { id: "C" },
        { id: "B" },
        { id: "D" },
      ]),
    ).toEqual(["C", "D"])
  })

  it("returns nothing when existing orders are merely updated", () => {
    expect(findNewOrderIds(new Set(["A", "B"]), [{ id: "B" }, { id: "A" }])).toEqual(
      [],
    )
  })

  it("does not report the same incoming id twice", () => {
    expect(findNewOrderIds(new Set(["A"]), [{ id: "B" }, { id: "B" }])).toEqual([
      "B",
    ])
  })
})
