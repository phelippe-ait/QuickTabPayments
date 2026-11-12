import { describe, expect, it } from "vitest"
import {
  normaliseModifierGroup,
  parsePriceAdjustment,
} from "./modifierValidation"

describe("normaliseModifierGroup", () => {
  it("caps single-select groups at one maximum selection", () => {
    const result = normaliseModifierGroup({
      name: "  Size  ",
      selectionType: "single",
      isRequired: false,
      minSelections: "0",
      maxSelections: "5",
    })

    expect(result).toEqual({
      ok: true,
      group: {
        name: "Size",
        selectionType: "single",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
      },
    })
  })

  it("forces a required single group to ask for exactly one", () => {
    const result = normaliseModifierGroup({
      name: "Size",
      selectionType: "single",
      isRequired: true,
      minSelections: "0",
      maxSelections: "1",
    })

    expect(result.ok && result.group.minSelections).toBe(1)
  })

  it("rejects a required multiple group with min zero", () => {
    const result = normaliseModifierGroup({
      name: "Extras",
      selectionType: "multiple",
      isRequired: true,
      minSelections: "0",
      maxSelections: "",
    })

    expect(result).toEqual({
      ok: false,
      error: "Required groups need a minimum of at least one selection.",
    })
  })

  it("treats a blank maximum on a multiple group as unlimited", () => {
    const result = normaliseModifierGroup({
      name: "Extras",
      selectionType: "multiple",
      isRequired: false,
      minSelections: "0",
      maxSelections: "",
    })

    expect(result.ok && result.group.maxSelections).toBe(0)
  })

  it("requires a maximum when a multiple group has a minimum", () => {
    const result = normaliseModifierGroup({
      name: "Extras",
      selectionType: "multiple",
      isRequired: false,
      minSelections: "1",
      maxSelections: "",
    })

    expect(result.ok).toBe(false)
  })

  it("rejects a maximum below the minimum", () => {
    const result = normaliseModifierGroup({
      name: "Extras",
      selectionType: "multiple",
      isRequired: false,
      minSelections: "2",
      maxSelections: "1",
    })

    expect(result.ok).toBe(false)
  })

  it("requires a name", () => {
    const result = normaliseModifierGroup({
      name: "   ",
      selectionType: "single",
      isRequired: false,
      minSelections: "0",
      maxSelections: "1",
    })

    expect(result).toEqual({ ok: false, error: "Group name is required." })
  })
})

describe("parsePriceAdjustment", () => {
  it("treats a blank field as zero adjustment", () => {
    expect(parsePriceAdjustment("")).toBeNull()
  })

  it("accepts negative discounts and positive surcharges", () => {
    expect(parsePriceAdjustment("-0.50")).toBe(-0.5)
    expect(parsePriceAdjustment("1.25")).toBe(1.25)
  })

  it("returns null for text", () => {
    expect(parsePriceAdjustment("free")).toBeNull()
  })
})
