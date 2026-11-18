import { describe, expect, it } from "vitest"
import type { ModifierGroup, ModifierOption } from "../../types"
import {
  defaultModifierSelection,
  modifierAdjustment,
  previewLineTotal,
  previewUnitPrice,
  selectedModifierChoices,
  selectionBounds,
  validateModifierSelection,
} from "./modifierSelection"

const option = (
  id: string,
  name: string,
  priceAdjustment = 0,
): ModifierOption => ({ id, name, priceAdjustment })

const group = (
  overrides: Partial<ModifierGroup> & Pick<ModifierGroup, "id" | "name">,
): ModifierGroup => ({
  selectionType: "single",
  minSelections: 1,
  maxSelections: 1,
  isRequired: true,
  options: [],
  ...overrides,
})

const size = group({
  id: "group-size",
  name: "Size",
  options: [option("size-regular", "Regular"), option("size-large", "Large", 1)],
})

const extras = group({
  id: "group-extras",
  name: "Extras",
  selectionType: "multiple",
  minSelections: 0,
  maxSelections: 2,
  isRequired: false,
  options: [
    option("extra-shot", "Extra shot", 0.5),
    option("extra-syrup", "Syrup", 0.5),
    option("extra-cream", "Cream", 1),
  ],
})

describe("selectionBounds", () => {
  it("treats a required group as needing at least one choice", () => {
    expect(selectionBounds({ ...size, minSelections: 0 })).toEqual({
      minimum: 1,
      maximum: 1,
    })
  })

  it("treats max_selections = 0 as unlimited for multiple groups", () => {
    expect(
      selectionBounds({ ...extras, maxSelections: 0 }).maximum,
    ).toBe(Number.POSITIVE_INFINITY)
  })
})

describe("validateModifierSelection", () => {
  it("accepts a valid selection, including an untouched optional group", () => {
    expect(
      validateModifierSelection([size, extras], {
        "group-size": ["size-large"],
        "group-extras": ["extra-shot", "extra-syrup"],
      }),
    ).toEqual({ ok: true })
  })

  it("reports a required group that has not been touched", () => {
    expect(validateModifierSelection([size, extras], {})).toEqual({
      ok: false,
      groupId: "group-size",
      code: "modifier_required",
      message: "Please choose Size.",
    })
  })

  it("reports a multiple group over its maximum", () => {
    const result = validateModifierSelection([size, extras], {
      "group-size": ["size-regular"],
      "group-extras": ["extra-shot", "extra-syrup", "extra-cream"],
    })

    expect(result).toMatchObject({
      ok: false,
      groupId: "group-extras",
      code: "modifier_selection_invalid",
    })
    expect(result.ok === false && result.message).toMatch(/at most 2/i)
  })

  it("reports a single-select group with more than one pick", () => {
    expect(
      validateModifierSelection([size], {
        "group-size": ["size-regular", "size-large"],
      }),
    ).toMatchObject({
      ok: false,
      groupId: "group-size",
      code: "modifier_selection_invalid",
      message: "Choose only one option for Size.",
    })
  })

  it("reports a multiple group below its minimum", () => {
    const twoMinimum = { ...extras, minSelections: 2, isRequired: true }
    expect(
      validateModifierSelection([size, twoMinimum], {
        "group-size": ["size-regular"],
        "group-extras": ["extra-shot"],
      }),
    ).toMatchObject({
      ok: false,
      code: "modifier_selection_invalid",
      message: /at least 2/i,
    })
  })

  it("allows any number of picks when the maximum is unlimited", () => {
    const unlimited = { ...extras, maxSelections: 0 }
    expect(
      validateModifierSelection([size, unlimited], {
        "group-size": ["size-regular"],
        "group-extras": ["extra-shot", "extra-syrup", "extra-cream"],
      }),
    ).toEqual({ ok: true })
  })
})

describe("price preview", () => {
  it("adds the selected adjustments and rounds to cents", () => {
    const selected = {
      "group-size": ["size-large"],
      "group-extras": ["extra-shot", "extra-syrup"],
    }

    expect(modifierAdjustment([size, extras], selected)).toBe(2)
    expect(previewUnitPrice(4.7, [size, extras], selected)).toBe(6.7)
  })

  it("multiplies the adjusted unit price by the quantity", () => {
    const selected = { "group-size": ["size-large"], "group-extras": [] }

    expect(previewLineTotal(4.7, [size, extras], selected, 1)).toBe(5.7)
    expect(previewLineTotal(4.7, [size, extras], selected, 3)).toBe(17.1)
  })

  it("never shows a negative price when discounts exceed the base", () => {
    const discount = group({
      id: "group-discount",
      name: "Discount",
      isRequired: false,
      options: [option("promo", "Promo", -10)],
    })

    expect(previewUnitPrice(4.7, [discount], { "group-discount": ["promo"] })).toBe(0)
  })
})

describe("selectedModifierChoices", () => {
  it("flattens selections in group + option order", () => {
    expect(
      selectedModifierChoices([size, extras], {
        "group-size": ["size-large"],
        "group-extras": ["extra-syrup", "extra-shot"],
      }),
    ).toEqual([
      {
        id: "size-large",
        name: "Large",
        priceAdjustment: 1,
        groupName: "Size",
      },
      {
        id: "extra-shot",
        name: "Extra shot",
        priceAdjustment: 0.5,
        groupName: "Extras",
      },
      {
        id: "extra-syrup",
        name: "Syrup",
        priceAdjustment: 0.5,
        groupName: "Extras",
      },
    ])
  })
})

describe("defaultModifierSelection", () => {
  it("pre-selects the demo 'regular' option when present", () => {
    const milk = group({
      id: "group-milk",
      name: "Milk",
      options: [option("milk-regular", "Regular milk"), option("milk-oat", "Oat", 0.5)],
    })

    expect(defaultModifierSelection([size, milk])).toEqual({
      "group-size": ["size-regular"],
      "group-milk": ["milk-regular"],
    })
  })

  it("leaves unknown groups untouched", () => {
    expect(defaultModifierSelection([extras])).toEqual({})
  })
})
