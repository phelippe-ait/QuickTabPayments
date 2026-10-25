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
