/**
 * Kitchen board service-level agreement (SLA) helpers.
 *
 * Elapsed time is measured from `orders.created_at`, not from when the order
 * entered `preparing` — the schema has no preparing timestamp yet, and
 * `created_at` is the wait the guest actually experiences. Thresholds are
 * intentionally editable constants; they are independent of a menu item's
 * `prep_time_minutes`/`pickup_time_estimate` so the board stays predictable
 * for the whole order rather than per line item.
 */

export const SLA_AMBER_MINUTES = 10
export const SLA_RED_MINUTES = 20

export type SlaLevel = "green" | "amber" | "red"

/**
 * Green below 10 minutes, amber from 10 through 20 minutes, red above 20.
 * Exactly 20 remains amber, matching the documented "red > 20" rule.
 */
export function getSlaLevel(elapsedMinutes: number): SlaLevel {
  if (elapsedMinutes > SLA_RED_MINUTES) return "red"
  if (elapsedMinutes >= SLA_AMBER_MINUTES) return "amber"
  return "green"
}

/** Whole minutes between an ISO `created_at` and `now`, clamped at zero. */
export function getElapsedMinutes(
  createdAt: string | undefined,
  now: number,
): number {
  if (!createdAt) return 0
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return 0
  return Math.max(0, Math.floor((now - created) / 60_000))
}

/** Compact elapsed-time label shown on every card, e.g. `12m`. */
export function formatElapsedMinutes(elapsedMinutes: number): string {
  return `${Math.max(0, Math.floor(elapsedMinutes))}m`
}

/** Order card tint/border — colour is always paired with the elapsed label. */
export const slaCardClasses: Record<SlaLevel, string> = {
  green: "border-l-4 border-l-sage",
  amber: "border-l-4 border-l-amber bg-amber-soft/30",
  red: "border-l-4 border-l-danger bg-danger-soft/40",
}

export const slaBadgeClasses: Record<SlaLevel, string> = {
  green: "bg-sage-soft text-sage-strong",
  amber: "bg-amber-soft text-amber",
  red: "bg-danger-soft text-danger",
}
