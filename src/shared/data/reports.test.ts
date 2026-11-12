import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("./client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}))

import { fetchSalesReport, parseSalesReport } from "./reports"

const payload = {
  currency: "AUD",
  from: "2026-10-14T00:00:00+00:00",
  to: "2026-11-12T10:30:00+00:00",
  order_count: 12,
  gross_revenue: "1234.50",
  paid_revenue: "1200.00",
  refunded_amount: "50.00",
  aov: "102.88",
  top_items: [
    { name: "Flat White", quantity: 8, revenue: "40.00" },
    { name: "Croissant", quantity: 3, revenue: "19.50" },
  ],
  busy_hours: [
    { hour: 8, orders: 2 },
    { hour: 9, orders: 5 },
  ],
}

describe("fetchSalesReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls the RPC and parses the full payload", async () => {
    mocks.rpc.mockResolvedValue({ data: payload, error: null })

    const report = await fetchSalesReport(
      "2026-10-14T00:00:00.000Z",
      "2026-11-12T10:30:00.000Z",
    )

    expect(mocks.rpc).toHaveBeenCalledWith("get_sales_report", {
      p_from: "2026-10-14T00:00:00.000Z",
      p_to: "2026-11-12T10:30:00.000Z",
    })
    expect(report).toEqual({
      currency: "AUD",
      from: "2026-10-14T00:00:00+00:00",
      to: "2026-11-12T10:30:00+00:00",
      order_count: 12,
      gross_revenue: 1234.5,
      paid_revenue: 1200,
      refunded_amount: 50,
      aov: 102.88,
      top_items: [
        { name: "Flat White", quantity: 8, revenue: 40 },
        { name: "Croissant", quantity: 3, revenue: 19.5 },
      ],
      busy_hours: [
        { hour: 8, orders: 2 },
        { hour: 9, orders: 5 },
      ],
    })
  })

  it("passes null bounds through to the RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: payload, error: null })

    await fetchSalesReport(null, null)

    expect(mocks.rpc).toHaveBeenCalledWith("get_sales_report", {
      p_from: null,
      p_to: null,
    })
  })

  it("maps the not_authorised error to a friendly message", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "not_authorised" },
    })

    await expect(fetchSalesReport(null, null)).rejects.toThrow(
      "You do not have permission to view sales reports.",
    )
  })

  it("maps invalid date ranges to a friendly message", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "invalid_date_range" },
    })

    await expect(
      fetchSalesReport("2026-11-12", "2026-11-01"),
    ).rejects.toThrow("Choose a valid date range and try again.")
  })
})

describe("parseSalesReport", () => {
  it("turns null and missing money fields into zeroes", () => {
    const report = parseSalesReport({
      currency: "AUD",
      order_count: "0",
      gross_revenue: null,
      paid_revenue: undefined,
      refunded_amount: "",
      aov: null,
    })

    expect(report.order_count).toBe(0)
    expect(report.gross_revenue).toBe(0)
    expect(report.paid_revenue).toBe(0)
    expect(report.refunded_amount).toBe(0)
    expect(report.aov).toBe(0)
    expect(report.top_items).toEqual([])
    expect(report.busy_hours).toEqual([])
  })

  it("tolerates a null payload", () => {
    expect(parseSalesReport(null)).toMatchObject({
      currency: "AUD",
      order_count: 0,
      gross_revenue: 0,
      top_items: [],
      busy_hours: [],
    })
  })
})
