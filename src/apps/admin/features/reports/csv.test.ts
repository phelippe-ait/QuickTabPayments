import { describe, expect, it } from "vitest"
import type { SalesReport } from "@shared/data/reports"
import { buildReportCsv, reportCsvFilename } from "./csv"

const generatedAt = new Date("2026-11-12T10:35:00.000Z")

const baseReport: SalesReport = {
  currency: "AUD",
  from: "2026-10-14T00:00:00.000Z",
  to: "2026-11-12T10:30:00.000Z",
  order_count: 12,
  gross_revenue: 1234.5,
  paid_revenue: 1200,
  refunded_amount: 50,
  aov: 102.88,
  top_items: [{ name: "Flat White", quantity: 8, revenue: 40 }],
  popular_items: [],
  busy_hours: [{ hour: 13, orders: 5 }],
}

describe("buildReportCsv", () => {
  it("renders a deterministic header, summary, and both sections", () => {
    const csv = buildReportCsv(baseReport, {
      restaurantName: "Test Café",
      generatedAt,
    })

    expect(csv).toBe(
      [
        "QuickTab sales report",
        "Restaurant,Test Café",
        "Period from,2026-10-14T00:00:00.000Z",
        "Period to,2026-11-12T10:30:00.000Z",
        "Currency,AUD",
        "Generated at,2026-11-12T10:35:00.000Z",
        "",
        "Summary",
        "Metric,Value",
        "Orders,12",
        "Gross revenue,1234.50",
        "Paid revenue,1200.00",
        "Refunded,50.00",
        "Average order value,102.88",
        "",
        "Top items",
        "Rank,Name,Quantity,Revenue",
        "1,Flat White,8,40.00",
        "",
        "Busy hours",
        "Hour,Orders",
        "13,5",
      ].join("\n"),
    )
  })

  it("quotes fields containing commas, quotes, and newlines", () => {
    const csv = buildReportCsv(
      {
        ...baseReport,
        top_items: [
          { name: "Flat, White", quantity: 1, revenue: 5 },
          { name: "Line\nBreak", quantity: 1, revenue: 5 },
          { name: "Plain", quantity: 1, revenue: 5 },
          { name: 'The "Big" One', quantity: 1, revenue: 5 },
        ],
      },
      { restaurantName: "Test Café", generatedAt },
    )

    expect(csv).toContain('1,"Flat, White",1,5.00')
    expect(csv).toContain('2,"Line\nBreak",1,5.00')
    expect(csv).toContain("3,Plain,1,5.00")
    expect(csv).toContain('4,"The ""Big"" One",1,5.00')
  })

  it("sorts top items by revenue and busy hours by hour", () => {
    const csv = buildReportCsv(
      {
        ...baseReport,
        top_items: [
          { name: "Croissant", quantity: 3, revenue: 19.5 },
          { name: "Flat White", quantity: 8, revenue: 40 },
        ],
        busy_hours: [
          { hour: 18, orders: 2 },
          { hour: 9, orders: 4 },
        ],
      },
      { restaurantName: "Test Café", generatedAt },
    )

    expect(csv.indexOf("1,Flat White")).toBeLessThan(
      csv.indexOf("2,Croissant"),
    )
    expect(csv.indexOf("Hour,Orders\n9,4")).toBeGreaterThan(-1)
    expect(csv.indexOf("9,4")).toBeLessThan(csv.indexOf("18,2"))
  })

  it("renders section headers only for an empty report", () => {
    const csv = buildReportCsv(
      {
        ...baseReport,
        order_count: 0,
        gross_revenue: 0,
        paid_revenue: 0,
        refunded_amount: 0,
        aov: 0,
        top_items: [],
        busy_hours: [],
      },
      { restaurantName: "Test Café", generatedAt },
    )

    expect(csv).toContain("Top items\nRank,Name,Quantity,Revenue")
    expect(csv.endsWith("Busy hours\nHour,Orders")).toBe(true)
    expect(csv).toContain("Orders,0")
    expect(csv).toContain("Gross revenue,0.00")
  })

  it("never leaves a trailing comma on a row", () => {
    const csv = buildReportCsv(baseReport, {
      restaurantName: "Test Café",
      generatedAt,
    })

    for (const line of csv.split("\n")) {
      expect(line.endsWith(",")).toBe(false)
    }
  })
})

describe("reportCsvFilename", () => {
  it("uses the report period dates", () => {
    expect(reportCsvFilename(baseReport)).toBe(
      "quicktab-report-2026-10-14-2026-11-12.csv",
    )
  })
})
