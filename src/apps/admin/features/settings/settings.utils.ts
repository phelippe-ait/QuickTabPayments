/**
 * Tax rate storage is a fraction (0–1); the admin form edits a percent (0–100).
 */
export function taxRateToPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0"
  return String(Math.round(rate * 1000) / 10)
}

export function percentToTaxRate(percent: string): number {
  if (percent.trim() === "") return Number.NaN
  const value = Number(percent)
  if (!Number.isFinite(value)) return Number.NaN
  return Math.round(value * 10) / 1000
}
