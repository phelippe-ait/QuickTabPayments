import { roundMoney } from "@shared/lib/money"
import type {
  OrderingModifierChoice,
  OrderingModifierGroup,
} from "./orderingTypes"

/** Selected option ids keyed by modifier group id. */
export type ModifierSelection = Record<string, string[]>

export type ModifierSelectionError = {
  groupId: string
  /**
   * Mirrors the `place_order` validation codes so the caller sees the same
   * message before the request round-trip.
   */
  code: "modifier_required" | "modifier_selection_invalid"
  message: string
}

export type ModifierSelectionValidation =
  | { ok: true }
  | ({ ok: false } & ModifierSelectionError)

/**
 * Effective bounds for a group, mirroring the rules enforced by
 * `place_order` in migration `0024`:
 * - a required group always needs at least one selection;
 * - a single-select group can only ever hold one option;
 * - `max_selections = 0` means "no limit" for multiple-select groups.
 */
export function selectionBounds(group: OrderingModifierGroup): {
  minimum: number
  maximum: number
} {
  const minimum = group.isRequired
    ? Math.max(1, group.minSelections)
    : Math.max(0, group.minSelections)
  const maximum =
    group.selectionType === "single"
      ? 1
      : group.maxSelections > 0
        ? group.maxSelections
        : Number.POSITIVE_INFINITY

  return { minimum, maximum }
}

function invalid(
  group: OrderingModifierGroup,
  code: ModifierSelectionError["code"],
  message: string,
): ModifierSelectionValidation {
  return { ok: false, groupId: group.id, code, message }
}

/**
 * Client-side mirror of the server's required/min/max validation. The server
 * remains the source of truth; this only keeps the Add button honest.
 */
export function validateModifierSelection(
  groups: OrderingModifierGroup[],
  selected: ModifierSelection,
): ModifierSelectionValidation {
  for (const group of groups) {
    const chosen = selected[group.id] ?? []
    const { minimum, maximum } = selectionBounds(group)

    if (group.isRequired && chosen.length === 0) {
      return invalid(
        group,
        "modifier_required",
        `Please choose ${group.name}.`,
      )
    }

    if (chosen.length < minimum) {
      return invalid(
        group,
        "modifier_selection_invalid",
        `Choose at least ${minimum} option${minimum === 1 ? "" : "s"} for ${group.name}.`,
      )
    }

    if (chosen.length > maximum) {
      return invalid(
        group,
        "modifier_selection_invalid",
        group.selectionType === "single"
          ? `Choose only one option for ${group.name}.`
          : `Choose at most ${maximum} option${maximum === 1 ? "" : "s"} for ${group.name}.`,
      )
    }
  }

  return { ok: true }
}

/** Sum of the selected price adjustments for the given item options. */
export function modifierAdjustment(
  groups: OrderingModifierGroup[],
  selected: ModifierSelection,
): number {
  const adjustment = groups.reduce((total, group) => {
    const chosen = selected[group.id] ?? []
    return (
      total +
      group.options.reduce(
        (sum, option) =>
          chosen.includes(option.id) ? sum + option.priceAdjustment : sum,
        0,
      )
    )
  }, 0)

  return roundMoney(adjustment)
}

/** Display-only preview of the unit price after modifier adjustments. */
export function previewUnitPrice(
  basePrice: number,
  groups: OrderingModifierGroup[],
  selected: ModifierSelection,
): number {
  return Math.max(0, roundMoney(basePrice + modifierAdjustment(groups, selected)))
}

/** Display-only preview of the line total for the selected quantity. */
export function previewLineTotal(
  basePrice: number,
  groups: OrderingModifierGroup[],
  selected: ModifierSelection,
  quantity: number,
): number {
  const safeQuantity = Number.isFinite(quantity)
    ? Math.max(0, Math.trunc(quantity))
    : 0

  return roundMoney(previewUnitPrice(basePrice, groups, selected) * safeQuantity)
}

/** Flatten the selection into the shape stored on a cart line. */
export function selectedModifierChoices(
  groups: OrderingModifierGroup[],
  selected: ModifierSelection,
): OrderingModifierChoice[] {
  return groups.flatMap((group) => {
    const chosen = selected[group.id] ?? []
    return group.options
      .filter((option) => chosen.includes(option.id))
      .map((option) => ({
        id: option.id,
        name: option.name,
        priceAdjustment: option.priceAdjustment,
        groupName: group.name,
      }))
  })
}

/**
 * Demo-menu defaults (regular size/milk/strength) so the common case needs no
 * extra taps. Groups without a known default start untouched.
 */
const DEFAULT_OPTION_NAMES: Record<string, string> = {
  size: "regular",
  milk: "regular milk",
  strength: "regular",
  sweetness: "no sugar",
  temperature: "standard",
}

export function defaultModifierSelection(
  groups: OrderingModifierGroup[],
): ModifierSelection {
  return Object.fromEntries(
    groups.flatMap((group) => {
      const defaultName = DEFAULT_OPTION_NAMES[group.name.toLowerCase()]
      if (!defaultName) return []
      const option = group.options.find(
        (candidate) => candidate.name.toLowerCase() === defaultName,
      )
      return option ? [[group.id, [option.id]]] : []
    }),
  )
}
