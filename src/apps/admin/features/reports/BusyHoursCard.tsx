import type { SalesReportBusyHour } from "@shared/data/reports"
import { cn } from "@shared/lib/cn"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"

type BusyHoursCardProps = {
  hours: SalesReportBusyHour[]
  /** IANA zone the RPC already bucketed the hours in. */
  timezone: string
}

const HOURS_IN_DAY = 24
const LABEL_EVERY = 3

/** "1p" / "12a" — compact axis label. */
function formatHourShort(hour: number): string {
  const suffix = hour < 12 ? "a" : "p"
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}${suffix}`
}

/** "1pm" / "12am" — used in the peak caption. */
function formatHourLong(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm"
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}${suffix}`
}

/** "13:00" — 24-hour bar label. */
function formatHourRange(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

function ordersLabel(orders: number): string {
  return `${orders} ${orders === 1 ? "order" : "orders"}`
}

/**
 * Normalise the RPC payload to exactly 24 hour buckets. The RPC already
 * returns all 24, but this keeps the chart stable if a bucket is missing.
 */
function normaliseHours(
  hours: SalesReportBusyHour[],
): SalesReportBusyHour[] {
  const byHour = new Map(hours.map((entry) => [entry.hour, entry.orders]))

  return Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({
    hour,
    orders: byHour.get(hour) ?? 0,
  }))
}

/** Earliest hour with the highest non-zero order count, or null. */
function findPeakHour(
  hours: SalesReportBusyHour[],
): SalesReportBusyHour | null {
  let peak: SalesReportBusyHour | null = null

  for (const entry of normaliseHours(hours)) {
    if (entry.orders > 0 && (!peak || entry.orders > peak.orders)) {
      peak = entry
    }
  }

  return peak
}

/**
 * 24-bar histogram built with plain CSS — no chart dependency. Hours are
 * already localised by `get_sales_report`, so the labels need no conversion.
 */
export function BusyHoursCard({ hours, timezone }: BusyHoursCardProps) {
  const bars = normaliseHours(hours)
  const maxOrders = Math.max(...bars.map((entry) => entry.orders))
  const totalOrders = bars.reduce((total, entry) => total + entry.orders, 0)
  const peak = findPeakHour(bars)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Busy hours</CardTitle>
        <CardDescription>
          Orders per hour of day ({timezone}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalOrders === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
            No orders in this period.
          </p>
        ) : null}

        <div
          className="mt-4 flex h-40 items-end gap-1"
          role="group"
          aria-label="Orders by hour of day"
        >
          {bars.map((entry) => {
            const isPeak = peak?.hour === entry.hour
            const height =
              maxOrders === 0
                ? "2%"
                : entry.orders === 0
                  ? "2%"
                  : `${Math.max(8, (entry.orders / maxOrders) * 100)}%`

            return (
              <div
                key={entry.hour}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <div
                  role="img"
                  aria-label={`${formatHourRange(entry.hour)} – ${ordersLabel(entry.orders)}`}
                  title={`${formatHourRange(entry.hour)} – ${ordersLabel(entry.orders)}`}
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
          className="mt-2 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1"
          aria-hidden="true"
        >
          {bars.map((entry) => (
            <span
              key={entry.hour}
              className="text-center text-[10px] text-muted"
            >
              {entry.hour % LABEL_EVERY === 0
                ? formatHourShort(entry.hour)
                : ""}
            </span>
          ))}
        </div>

        {peak ? (
          <p className="mt-4 text-sm font-bold text-ink">
            Busiest: {formatHourLong(peak.hour)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
