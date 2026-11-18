import { describe, expect, it } from "vitest"
import {
  FEATURE_MIN_PLAN,
  PLANS,
  PLAN_LABELS,
  PLAN_PRICES_AUD,
  featuresForPlan,
  hasFeature,
  missingFeatures,
  planRank,
  type Plan,
  type PlanFeature,
} from "./features"

const FEATURES: PlanFeature[] = [
  "reports",
  "csv_export",
  "promo_codes",
  "multi_location",
  "staff_performance",
]

/** Explicit 5 × 3 matrix, independent of the implementation. */
const EXPECTED: Record<PlanFeature, Record<Plan, boolean>> = {
  reports: { basic: false, standard: true, premium: true },
  csv_export: { basic: false, standard: true, premium: true },
  promo_codes: { basic: false, standard: true, premium: true },
  multi_location: { basic: false, standard: false, premium: true },
  staff_performance: { basic: false, standard: false, premium: true },
}

const CASES = FEATURES.flatMap((feature) =>
  PLANS.map((plan) => [feature, plan] as const),
)

describe("plan feature matrix", () => {
  it.each(CASES)("hasFeature(%s, %s) matches the matrix", (feature, plan) => {
    expect(hasFeature(plan, feature)).toBe(EXPECTED[feature][plan])
  })

  it("declares the lowest unlocking plan for every feature", () => {
    for (const feature of FEATURES) {
      const minPlan = FEATURE_MIN_PLAN[feature]
      expect(hasFeature(minPlan, feature)).toBe(true)

      const below = PLANS.filter((plan) => planRank(plan) < planRank(minPlan))
      for (const plan of below) {
        expect(hasFeature(plan, feature)).toBe(false)
      }
    }
  })

  it("ranks plans from basic to premium", () => {
    expect(PLANS.map(planRank)).toEqual([0, 1, 2])
    expect(planRank("basic")).toBeLessThan(planRank("standard"))
    expect(planRank("standard")).toBeLessThan(planRank("premium"))
  })

  it("exposes the plan labels and display prices", () => {
    expect(PLAN_LABELS).toEqual({
      basic: "Basic",
      standard: "Standard",
      premium: "Premium",
    })
    expect(PLAN_PRICES_AUD).toEqual({ basic: 29, standard: 59, premium: 99 })
  })
})

describe("featuresForPlan", () => {
  it("returns each tier's features in matrix order", () => {
    expect(featuresForPlan("basic")).toEqual([])
    expect(featuresForPlan("standard")).toEqual([
      "reports",
      "csv_export",
      "promo_codes",
    ])
    expect(featuresForPlan("premium")).toEqual(FEATURES)
  })

  it("only grows as the tier grows", () => {
    expect(featuresForPlan("premium")).toEqual(
      expect.arrayContaining(featuresForPlan("standard")),
    )
    expect(featuresForPlan("standard")).toEqual(
      expect.arrayContaining(featuresForPlan("basic")),
    )
  })

  it("does not repeat features", () => {
    for (const plan of PLANS) {
      const features = featuresForPlan(plan)
      expect(new Set(features).size).toBe(features.length)
    }
  })
})

describe("missingFeatures", () => {
  it("lists everything for basic", () => {
    expect(missingFeatures("basic")).toEqual(FEATURES)
  })

  it("lists only premium features for standard", () => {
    expect(new Set(missingFeatures("standard"))).toEqual(
      new Set(["multi_location", "staff_performance"]),
    )
  })

  it("is empty for premium", () => {
    expect(missingFeatures("premium")).toEqual([])
  })

  it("partitions the matrix with featuresForPlan", () => {
    for (const plan of PLANS) {
      expect([...featuresForPlan(plan), ...missingFeatures(plan)]).toHaveLength(
        FEATURES.length,
      )
      expect(
        new Set([...featuresForPlan(plan), ...missingFeatures(plan)]),
      ).toEqual(new Set(FEATURES))
    }
  })
})
