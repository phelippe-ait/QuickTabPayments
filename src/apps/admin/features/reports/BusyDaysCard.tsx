import type { SalesReportBusyDay } from "@shared/data/reports"
import { cn } from "@shared/lib/cn"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"

type BusyDaysCardProps = {
  days: SalesReportBusyDay[]
  /** IANA zone the RPC already bucketed the days in. */
  timezone: string
}

const DAYS_IN_WEEK = 7
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function dayName(day: number): string {
  return DAY_NAMES[day] ?? "Unknown day"
}

function dayShort(day: number): string {
  return DAY_SHORT[day] ?? "—"
}

function ordersLabel(orders: number): string {
  return `${orders} ${orders === 1 ? "order" : "orders"}`
}

/** Normalise the RPC payload to Sunday..Saturday (0..6). */
function normaliseDays(days: SalesReportBusyDay[]): SalesReportBusyDay[] {
  const byDay = new Map(days.map((entry) => [entry.day, entry.orders]))

  return Array.from({ length: DAYS_IN_WEEK }, (_, day) => ({
    day,
    orders: byDay.get(day) ?? 0,
  }))
}

/** Earliest day with the highest non-zero order count, or null. */
function findPeakDay(days: SalesReportBusyDay[]): SalesReportBusyDay | null {
  let peak: SalesReportBusyDay | null = null

  for (const entry of normaliseDays(days)) {
    if (entry.orders > 0 && (!peak || entry.orders > peak.orders)) {
      peak = entry
    }
  }

  return peak
}

/**
 * Seven-bar histogram built with plain CSS — no chart dependency. Days are
 * already localised by `get_sales_report`, so the labels need no conversion.
 */
export function BusyDaysCard({ days, timezone }: BusyDaysCardProps) {
  const bars = normaliseDays(days)
  const maxOrders = Math.max(...bars.map((entry) => entry.orders))
  const totalOrders = bars.reduce((total, entry) => total + entry.orders, 0)
  const peak = findPeakDay(bars)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Busy days</CardTitle>
        <CardDescription>
          Orders per day of week ({timezone}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalOrders === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
            No orders in this period.
          </p>
        ) : null}

        <div
          className="mt-4 flex h-40 items-end gap-2"
          role="group"
          aria-label="Orders by day of week"
        >
          {bars.map((entry) => {
            const isPeak = peak?.day === entry.day
            const height =
              maxOrders === 0
                ? "2%"
                : entry.orders === 0
                  ? "2%"
                  : `${Math.max(8, (entry.orders / maxOrders) * 100)}%`

            return (
              <div
                key={entry.day}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <div
                  role="img"
                  aria-label={`${dayName(entry.day)} – ${ordersLabel(entry.orders)}`}
                  title={`${dayName(entry.day)} – ${ordersLabel(entry.orders)}`}
                  style={{ height }}
                  className={cn(
                    "w-full rounded-t-[4px]",
                    entry.orders === 0
                      ? "bg-line-soft"
                      : isPeak
                        ? "bg-berry"
                        : "bg-berry/40",
                  )}
                />
              </div>
            )
          })}
        </div>

        <div
          className="mt-2 grid grid-cols-7 gap-2"
          aria-hidden="true"
        >
          {bars.map((entry) => (
            <span
              key={entry.day}
              className="text-center text-[10px] text-muted"
            >
              {dayShort(entry.day)}
            </span>
          ))}
        </div>

        {peak ? (
          <p className="mt-4 text-sm font-bold text-ink">
            Busiest: {dayName(peak.day)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
