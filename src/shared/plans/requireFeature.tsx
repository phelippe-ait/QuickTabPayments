/* eslint-disable react-refresh/only-export-components -- guard component + its plain-function helper intentionally share one file */
import type { ReactNode } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"
import {
  FEATURE_LABELS,
  FEATURE_MIN_PLAN,
  PLAN_LABELS,
  PLAN_PRICES_AUD,
  hasFeature,
  type Plan,
  type PlanFeature,
} from "./features"
import { usePlan } from "./usePlan"

/**
 * Plain matrix check for non-React call sites. This is the same function as
 * `hasFeature`, re-exported under a name that reads like a guard.
 */
export { hasFeature as requireFeature }

/**
 * Renders `children` only when the restaurant's plan includes `feature`.
 * Otherwise shows an upgrade panel. Upgrades are handled off-platform for now;
 * there is intentionally no checkout or billing flow here.
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: PlanFeature
  children: ReactNode
}) {
  const { plan } = usePlan()

  if (hasFeature(plan, feature)) {
    return <>{children}</>
  }

  return <UpgradePanel feature={feature} plan={plan} />
}

function UpgradePanel({
  feature,
  plan,
}: {
  feature: PlanFeature
  plan: Plan
}) {
  const featureLabel = FEATURE_LABELS[feature]
  const requiredPlan = FEATURE_MIN_PLAN[feature]

  return (
    <Card role="region" aria-label={`${featureLabel} upgrade`}>
      <CardHeader>
        <CardTitle>Upgrade to {PLAN_LABELS[requiredPlan]}</CardTitle>
        <CardDescription>
          {featureLabel} is included in the {PLAN_LABELS[requiredPlan]} plan.
          You're currently on {PLAN_LABELS[plan]}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-ink-mid">
        <p className="font-bold text-ink">
          A${PLAN_PRICES_AUD[requiredPlan]} / month
        </p>
        <p>
          Upgrades are handled off-platform for now. Contact us to change your
          plan.
        </p>
      </CardContent>
    </Card>
  )
}
