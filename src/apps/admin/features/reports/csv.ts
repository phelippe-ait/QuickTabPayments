import type { SalesReport } from "@shared/data/reports"

/** Optional, injectable values that keep the CSV deterministic in tests. */
export type ReportCsvOptions = {
  /** Display name for the header block. Defaults to "Restaurant". */
  restaurantName?: string
  /** Clock for the generated-at row. Defaults to the current time. */
  generatedAt?: Date
}

/** Fields containing a comma, quote, or newline are wrapped and quotes doubled. */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function cell(value: string | number): string {
  return escapeCell(String(value))
}

function row(cells: (string | number)[]): string {
  return cells.map(cell).join(",")
}

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2)
}

function byName(a: { name: string }, b: { name: string }): number {
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}

/** Revenue-led ordering, matching the on-screen Top items card. */
function rankedTopItems(report: SalesReport) {
  return [...report.top_items].sort(
    (a, b) => b.revenue - a.revenue || byName(a, b),
  )
}

function sortedBusyHours(report: SalesReport) {
  return [...report.busy_hours].sort((a, b) => a.hour - b.hour)
}

/**
 * Renders the aggregated sales report as CSV: a small header block followed by
 * Summary, Top items, and Busy hours sections. Column order is fixed and money
 * is always two decimal places.
 */
export function buildReportCsv(
  report: SalesReport,
  options: ReportCsvOptions = {},
): string {
  const restaurantName = options.restaurantName?.trim() || "Restaurant"
  const generatedAt = (options.generatedAt ?? new Date()).toISOString()

  const lines: string[] = [
    "QuickTab sales report",
    row(["Restaurant", restaurantName]),
    row(["Period from", report.from]),
    row(["Period to", report.to]),
    row(["Currency", report.currency]),
    row(["Generated at", generatedAt]),
    "",
    "Summary",
    row(["Metric", "Value"]),
    row(["Orders", report.order_count]),
    row(["Gross revenue", money(report.gross_revenue)]),
    row(["Paid revenue", money(report.paid_revenue)]),
    row(["Refunded", money(report.refunded_amount)]),
    row(["Average order value", money(report.aov)]),
    "",
    "Top items",
    row(["Rank", "Name", "Quantity", "Revenue"]),
    ...rankedTopItems(report).map((item, index) =>
      row([index + 1, item.name, item.quantity, money(item.revenue)]),
    ),
    "",
    "Busy hours",
    row(["Hour", "Orders"]),
    ...sortedBusyHours(report).map((entry) =>
      row([entry.hour, entry.orders]),
    ),
  ]

  return lines.join("\n")
}

/** Download name derived from the report's start and end dates. */
export function reportCsvFilename(report: SalesReport): string {
  const day = (value: string) => value.slice(0, 10)
  return `quicktab-report-${day(report.from)}-${day(report.to)}.csv`
}

/** Trigger a client-side download without adding a dependency. */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
