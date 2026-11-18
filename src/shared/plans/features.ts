/**
 * Tier feature matrix — the single source of truth for what each plan unlocks.
 *
 * Keep this module free of React so it can be imported anywhere (including
 * server-side code and tests) without side effects. Only `reports` and
 * `csv_export` are wired to real screens today; the remaining entries reserve
 * the contract for future work.
 */

export const PLANS = ["basic", "standard", "premium"] as const
export type Plan = (typeof PLANS)[number]

export const PLAN_LABELS: Record<Plan, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
}

/** Display-only monthly price in AUD. Billing happens off-platform. */
export const PLAN_PRICES_AUD: Record<Plan, number> = {
  basic: 29,
  standard: 59,
  premium: 99,
}

export type PlanFeature =
  | "reports"
  | "csv_export"
  | "promo_codes" // Standard+
  | "multi_location" // Premium
  | "staff_performance" // Premium

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  reports: "Reports",
  csv_export: "CSV export",
  promo_codes: "Promo codes",
  multi_location: "Multi-location",
  staff_performance: "Staff performance",
}

/** The lowest plan that unlocks each feature. */
export const FEATURE_MIN_PLAN: Record<PlanFeature, Plan> = {
  reports: "standard",
  csv_export: "standard",
  promo_codes: "standard",
  multi_location: "premium",
  staff_performance: "premium",
}

/** Matrix order used by `featuresForPlan` / `missingFeatures`. */
const ALL_FEATURES: PlanFeature[] = [
  "reports",
  "csv_export",
  "promo_codes",
  "multi_location",
  "staff_performance",
]

export function planRank(plan: Plan): number {
  return PLANS.indexOf(plan)
}

export function hasFeature(plan: Plan, feature: PlanFeature): boolean {
  return planRank(plan) >= planRank(FEATURE_MIN_PLAN[feature])
}

export function featuresForPlan(plan: Plan): PlanFeature[] {
  return ALL_FEATURES.filter((feature) => hasFeature(plan, feature))
}

/** Features the plan does not include — used for upgrade nudges. */
export function missingFeatures(plan: Plan): PlanFeature[] {
  return ALL_FEATURES.filter((feature) => !hasFeature(plan, feature))
}
