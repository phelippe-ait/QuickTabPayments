import { startOfDayInZone } from "@shared/lib/time"

/**
 * Report periods are calendar-day windows in the restaurant's timezone.
 *
 * Simplification: presets start at local midnight and end "now", so a report
 * opened mid-day includes today's orders so far. Custom ranges are half-open
 * at local midnight (`from` inclusive, `to` exclusive) to match the RPC's
 * `[p_from, p_to)` contract.
 */
export type PeriodPreset = "today" | "7d" | "30d" | "custom"

export type FixedPeriodPreset = Exclude<PeriodPreset, "custom">

export type ReportPeriod = {
  preset: PeriodPreset
  /** ISO timestamptz passed to the RPC. */
  from: string
  /** ISO timestamptz passed to the RPC. */
  to: string
  /** Calendar date (`YYYY-MM-DD`) in the restaurant timezone. */
  fromDate: string
  /** Calendar date (`YYYY-MM-DD`) in the restaurant timezone. */
  toDate: string
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom",
}

/** Mirrors the RPC's 366-day cap. */
export const MAX_PERIOD_DAYS = 366

const dayMs = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** Calendar date for an instant in an IANA timezone. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "01"

  return `${value("year")}-${value("month")}-${value("day")}`
}

/** Add (or subtract) calendar days to a `YYYY-MM-DD` key. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

function daysBetween(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number)
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number)
  return (
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
    dayMs
  )
}

/**
 * Range for a preset. "Last 7 days" includes today plus the six days before
 * it; "Last 30 days" includes today plus the twenty-nine before it.
 */
export function getPeriodRange(
  preset: FixedPeriodPreset,
  now: Date,
  timeZone: string,
): ReportPeriod {
  const toDate = dateKeyInZone(now, timeZone)
  const daysBack = preset === "today" ? 0 : preset === "7d" ? 6 : 29
  const fromDate = addDaysToDateKey(toDate, -daysBack)

  return {
    preset,
    from: startOfDayInZone(fromDate, timeZone),
    to: now.toISOString(),
    fromDate,
    toDate,
  }
}

/** Inline validation message for the custom date inputs, or null when valid. */
export function validateCustomRange(
  fromDate: string,
  toDate: string,
): string | null {
  if (!fromDate || !toDate) return "Choose both a start and an end date."
  if (fromDate >= toDate) return "The start date must be before the end date."

  const inclusiveDays = daysBetween(fromDate, toDate) + 1
  if (inclusiveDays > MAX_PERIOD_DAYS) {
    return `The range cannot be longer than ${MAX_PERIOD_DAYS} days.`
  }

  return null
}

/** Build a half-open custom range. Callers must validate first. */
export function getCustomPeriod(
  fromDate: string,
  toDate: string,
  timeZone: string,
): ReportPeriod {
  const error = validateCustomRange(fromDate, toDate)
  if (error) throw new RangeError(error)

  return {
    preset: "custom",
    from: startOfDayInZone(fromDate, timeZone),
    to: startOfDayInZone(addDaysToDateKey(toDate, 1), timeZone),
    fromDate,
    toDate,
  }
}

/** Human caption such as "1 Oct 2026 – 12 Nov 2026". */
export function formatPeriodLabel(
  period: Pick<ReportPeriod, "fromDate" | "toDate">,
): string {
  const format = (dateKey: string) =>
    new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${dateKey}T00:00:00Z`))

  if (period.fromDate === period.toDate) return format(period.fromDate)
  return `${format(period.fromDate)} – ${format(period.toDate)}`
}
