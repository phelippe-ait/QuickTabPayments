import type { ModifierSelection } from "@shared/lib/database.types"

/**
 * Group-form rules mirroring the database constraints and the P05 pricing RPC:
 *
 * - a single-select group can never allow more than one choice;
 * - a required group must ask for at least one choice;
 * - `max_selections = 0` on a multiple group means "no limit" (the RPC skips
 *   the upper bound when the value is 0).
 */
export type ModifierGroupFormValues = {
  name: string
  selectionType: ModifierSelection
  isRequired: boolean
  minSelections: number | string
  maxSelections: number | string | null
}

export type NormalisedModifierGroup = {
  name: string
  selectionType: ModifierSelection
  isRequired: boolean
  minSelections: number
  maxSelections: number
}

export type ModifierGroupValidation =
  | { ok: true; group: NormalisedModifierGroup }
  | { ok: false; error: string }

export function normaliseModifierGroup(
  values: ModifierGroupFormValues,
): ModifierGroupValidation {
  const name = values.name.trim()
  if (!name) return { ok: false, error: "Group name is required." }

  const min = Number(values.minSelections)
  if (!Number.isInteger(min) || min < 0) {
    return {
      ok: false,
      error: "Minimum selections must be a whole number of zero or more.",
    }
  }

  const hasMax =
    values.maxSelections !== null &&
    String(values.maxSelections).trim() !== ""
  const max = hasMax ? Number(values.maxSelections) : 0
  if (hasMax && (!Number.isInteger(max) || max < 0)) {
    return {
      ok: false,
      error: "Maximum selections must be a whole number of zero or more.",
    }
  }

  if (values.selectionType === "single") {
    if (min > 1) {
      return {
        ok: false,
        error: "Single-select groups allow at most one selection.",
      }
    }

    return {
      ok: true,
      group: {
        name,
        selectionType: "single",
        isRequired: values.isRequired,
        // A required single group always asks for exactly one choice.
        minSelections: values.isRequired ? 1 : min,
        maxSelections: 1,
      },
    }
  }

  if (values.isRequired && min < 1) {
    return {
      ok: false,
      error: "Required groups need a minimum of at least one selection.",
    }
  }

  if (!hasMax && min > 0) {
    return {
      ok: false,
      error: "Maximum selections is required when a minimum is set.",
    }
  }

  if (max > 0 && max < min) {
    return {
      ok: false,
      error: "Maximum selections cannot be lower than the minimum.",
    }
  }

  return {
    ok: true,
    group: {
      name,
      selectionType: "multiple",
      isRequired: values.isRequired,
      minSelections: min,
      // 0 means unlimited for multiple-select groups.
      maxSelections: max,
    },
  }
}

/** Parse an optional money field; blank becomes `null`, otherwise must be finite. */
export function parsePriceAdjustment(value: string | number): number | null {
  const raw = String(value).trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
