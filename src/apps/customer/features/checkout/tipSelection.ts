import {
  computeTipPreview,
  roundMoney,
  TIP_FIXED_MAX,
  type TipSelection,
} from "@shared/lib/money";

/** Preset percentages offered at checkout. 0 means "No tip". */
export const TIP_PRESETS = [0, 5, 10, 15] as const;

export type TipPreset = (typeof TIP_PRESETS)[number];

export type TipFormState = {
  mode: "preset" | "custom";
  /** Selected preset percentage; only meaningful while mode is "preset". */
  percent: number;
  /** Raw custom input kept as text so partial/invalid values stay visible. */
  custom: string;
};

/** Optional by default: no tip until the customer chooses one. */
export const initialTipState: TipFormState = {
  mode: "preset",
  percent: 0,
  custom: "",
};

export type CustomTipResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Validate the custom (fixed) tip input. It stays text until it is a complete
 * AUD amount with at most two decimals, matching the server's fixed cap.
 */
export function parseCustomTip(input: string): CustomTipResult {
  const trimmed = input.trim();

  if (trimmed === "") {
    return { ok: false, error: "Enter a tip amount." };
  }
  if (trimmed.startsWith("-")) {
    return { ok: false, error: "Tip can't be negative." };
  }
  if (!/^\d*(\.\d{0,2})?$/.test(trimmed) || !/\d/.test(trimmed)) {
    return {
      ok: false,
      error: "Enter a valid amount with up to 2 decimal places.",
    };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Enter a valid amount." };
  }
  if (value > TIP_FIXED_MAX) {
    return {
      ok: false,
      error: `Tip can't be more than $${TIP_FIXED_MAX}.`,
    };
  }

  return { ok: true, value: roundMoney(value) };
}

/** Choose a preset percentage (0 = no tip). Keeps any typed custom amount. */
export function selectPreset(
  state: TipFormState,
  percent: number,
): TipFormState {
  return { ...state, mode: "preset", percent };
}

/** Switch to the custom fixed-amount input. */
export function selectCustom(state: TipFormState): TipFormState {
  return { ...state, mode: "custom" };
}

/** Custom-input error, or "" when the current selection is valid. */
export function customTipError(state: TipFormState): string {
  if (state.mode !== "custom") return "";
  const parsed = parseCustomTip(state.custom);
  return parsed.ok ? "" : parsed.error;
}

/**
 * Payload sent to `place_order` / `/api/create-payment-intent`.
 *
 * `null` means "no tip": 0%, an empty/zero custom amount, or an invalid custom
 * input (the checkout blocks payment separately while the input is invalid).
 */
export function tipSelectionPayload(
  state: TipFormState,
): TipSelection | null {
  if (state.mode === "preset") {
    return state.percent > 0
      ? { type: "percent", value: state.percent }
      : null;
  }

  const parsed = parseCustomTip(state.custom);
  if (!parsed.ok || parsed.value <= 0) return null;
  return { type: "fixed", value: parsed.value };
}

/** Label for the live preview and order summary, e.g. "Tip (10%)". */
export function tipLabel(state: TipFormState): string {
  return state.mode === "preset" && state.percent > 0
    ? `Tip (${state.percent}%)`
    : "Tip";
}

/** Preview line value. Always uses `computeTipPreview`, never a second formula. */
export function tipPreviewAmount(state: TipFormState, total: number): number {
  return computeTipPreview(total, tipSelectionPayload(state));
}
