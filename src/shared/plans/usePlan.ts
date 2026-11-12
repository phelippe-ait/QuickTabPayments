import { useRestaurant } from "@shared/restaurant/useRestaurant"
import {
  hasFeature,
  type Plan,
  type PlanFeature,
} from "./features"

export type UsePlanResult = {
  plan: Plan
  has: (feature: PlanFeature) => boolean
}

/**
 * Reads the signed-in restaurant's plan.
 *
 * Defaults to `basic` while the restaurant record is loading or missing, so
 * gated UI fails closed until the real plan is known.
 */
export function usePlan(): UsePlanResult {
  const { restaurant } = useRestaurant()
  const plan = restaurant?.plan ?? "basic"

  return {
    plan,
    has: (feature) => hasFeature(plan, feature),
  }
}
