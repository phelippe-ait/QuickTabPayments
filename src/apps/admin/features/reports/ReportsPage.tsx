import { useState } from "react"
import { formatMoney } from "@shared/lib/money"
import { RequireFeature } from "@shared/plans/requireFeature"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { Button } from "@shared/ui/shadcn/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"
import { Skeleton } from "@shared/ui/shadcn/skeleton"
import { PageHeader } from "../../components/AdminUi"
import { useSalesReport } from "../../hooks/useSalesReport"
import { BusyHoursCard } from "./BusyHoursCard"
import { PopularItemsCard } from "./PopularItemsCard"
import { ReportPeriodSelector } from "./ReportPeriodSelector"
import { TopItemsCard } from "./TopItemsCard"
import {
  formatPeriodLabel,
  getPeriodRange,
  type ReportPeriod,
} from "./period"

type ReportRestaurant = {
  id: string
  currency: string
  timezone: string
}

const kpiGridClassName = "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"

/**
 * Reports shell. Plan gating stays in `RequireFeature`, so a basic-plan
 * restaurant never mounts the sales-report query.
 */
export function ReportsPage() {
  const { restaurant } = useRestaurant()

  if (!restaurant) {
    return (
      <>
        <PageHeader
          eyebrow="Business insights"
          title="Reports"
          description="Track sales, top items, and busy hours for your restaurant."
        />
        <div
          className="grid gap-4 py-8"
          role="status"
          aria-label="Loading reports"
        >
          <div className="h-10 w-56 animate-pulse rounded-lg bg-line-soft" />
          <div className="h-48 w-full animate-pulse rounded-card bg-line-soft" />
          <div className="h-48 w-full animate-pulse rounded-card bg-line-soft" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Business insights"
        title="Reports"
        description="Track sales, top items, and busy hours for your restaurant."
      />
      <RequireFeature feature="reports">
        <ReportsOverview
          restaurant={{
            id: restaurant.id,
            currency: restaurant.currency,
            timezone: restaurant.timezone,
          }}
        />
      </RequireFeature>
    </>
  )
}

function ReportsOverview({ restaurant }: { restaurant: ReportRestaurant }) {
  const [period, setPeriod] = useState<ReportPeriod>(() =>
    getPeriodRange("30d", new Date(), restaurant.timezone),
  )
  const { report, isLoading, isFetching, error, refetch } = useSalesReport(
    restaurant.id,
    period.from,
    period.to,
  )
  const periodLabel = formatPeriodLabel(period)

  return (
    <>
      <ReportPeriodSelector timezone={restaurant.timezone} onChange={setPeriod} />

      {error ? (
        <Card role="alert" className="mt-6 border-danger/40">
          <CardHeader>
            <CardTitle>Sales report unavailable</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Button variant="secondary" onClick={refetch}>
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading || !report ? (
        <LoadingCards />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {`Sales report for ${periodLabel}: ${report.order_count} orders.`}
          </p>
          <section aria-label="Sales KPIs" className={kpiGridClassName}>
            <KpiCard
              label="Gross revenue"
              value={formatMoney(report.gross_revenue, report.currency)}
              caption={periodLabel}
            />
            <KpiCard
              label="Paid revenue"
              value={formatMoney(report.paid_revenue, report.currency)}
              caption={periodLabel}
            />
            <KpiCard
              label="Orders"
              value={report.order_count.toLocaleString("en-AU")}
              caption={periodLabel}
            />
            <KpiCard
              label="Average order value"
              value={formatMoney(report.aov, report.currency)}
              caption={periodLabel}
            />
            <KpiCard
              label="Refunded"
              value={formatMoney(report.refunded_amount, report.currency)}
              caption={periodLabel}
            />
          </section>

          {report.order_count === 0 && (
            <p
              role="status"
              className="mt-4 rounded-card border border-dashed border-line bg-white/40 px-5 py-4 text-sm text-muted"
            >
              No orders in this period.
            </p>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <BusyHoursCard
                hours={report.busy_hours}
                timezone={restaurant.timezone}
              />
            </div>
            <TopItemsCard
              items={report.top_items}
              currency={report.currency}
            />
            <PopularItemsCard
              items={report.popular_items}
              currency={report.currency}
            />
          </div>

          {isFetching && (
            <p className="mt-4 text-xs text-muted" aria-live="polite">
              Updating report…
            </p>
          )}
        </>
      )}
    </>
  )
}

function KpiCard({
  label,
  value,
  caption,
}: {
  label: string
  value: string
  caption: string
}) {
  return (
    <Card>
      <div className="flex h-full flex-col gap-1 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="font-serif text-3xl leading-tight text-ink">{value}</p>
        <p className="text-[11px] text-muted">{caption}</p>
      </div>
    </Card>
  )
}

function LoadingCards() {
  return (
    <div role="status" aria-label="Loading sales report">
      <div className={kpiGridClassName}>
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index}>
            <div className="flex h-full flex-col gap-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-2 w-28" />
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-40 w-full" />
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-48 w-full" />
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-48 w-full" />
          </div>
        </Card>
      </div>
    </div>
  )
}
