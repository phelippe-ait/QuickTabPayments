/**
 * Money contract: the database stores numbers, the UI formats them.
 * Never parse a formatted currency string back into a number.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount)
}

/** Round half-up to `decimals` places, avoiding binary-float surprises. */
export function roundMoney(amount: number, decimals = 2): number {
  if (!Number.isFinite(amount)) return 0
  const factor = 10 ** decimals
  return Math.round((amount + Number.EPSILON) * factor) / factor
}

/**
 * GST-inclusive split, mirroring `place_order` in Postgres.
 *
 * Menu prices are what the customer pays, so `total` is authoritative:
 *   tax      = round(total × rate / (1 + rate), 2)
 *   subtotal = total − tax
 *
 * Keep this the only client-side implementation; the server value still wins.
 */
export function splitInclusiveTax(
  total: number,
  taxRate: number,
): { subtotal: number; tax: number } {
  const safeTotal = roundMoney(total)
  const safeRate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0
  const tax = roundMoney((safeTotal * safeRate) / (1 + safeRate))
  return { subtotal: roundMoney(safeTotal - tax), tax }
}

/**
 * Consistent label for the GST line: include the percentage when we know it,
 * and never print a confusing "GST (included, 0%)".
 */
export function inclusiveTaxLabel(taxRate: number): string {
  const percent = Math.round(taxRate * 100)
  return percent > 0 ? `GST (included, ${percent}%)` : "GST (included)"
}

/** Checkout tip selection. Values are validated against the same caps as SQL. */
export type TipSelection =
  | { type: "percent"; value: number }
  | { type: "fixed"; value: number }
  | { type: "none" }

export const TIP_PERCENT_MAX = 25
export const TIP_FIXED_MAX = 500

function validatedTipValue(value: unknown, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  ) {
    throw new RangeError("invalid_tip")
  }
  return value
}

/**
 * Preview only: mirrors the server's tip rules exactly so the checkout can
 * show the amount before `place_order` recomputes it.
 *
 * - percent: round(post-tax total × value / 100, 2), cap 25
 * - fixed:   round(value, 2), cap 500
 * - null / `{ type: "none" }`: no tip
 *
 * Invalid selections throw `RangeError("invalid_tip")`; the server is still
 * the source of truth for the amount charged.
 */
export function computeTipPreview(
  total: number,
  tip: TipSelection | null | undefined,
): number {
  if (!tip || tip.type === "none") return 0

  const base = roundMoney(total)

  if (tip.type === "percent") {
    return roundMoney((base * validatedTipValue(tip.value, TIP_PERCENT_MAX)) / 100)
  }
  if (tip.type === "fixed") {
    return roundMoney(validatedTipValue(tip.value, TIP_FIXED_MAX))
  }

  throw new RangeError("invalid_tip")
}
