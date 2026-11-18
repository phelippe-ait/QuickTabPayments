import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useSalesReport } from "./useSalesReport"
import type { SalesReport } from "@shared/data/reports"

const mocks = vi.hoisted(() => ({
  fetchSalesReport: vi.fn(),
}))

vi.mock("@shared/data/reports", () => ({
  reportKeys: {
    range: (restaurantId: string, from: string | null, to: string | null) =>
      ["sales-report", restaurantId, from, to],
  },
  fetchSalesReport: mocks.fetchSalesReport,
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const report: SalesReport = {
  currency: "AUD",
  from: "2026-10-14T00:00:00.000Z",
  to: "2026-11-12T10:30:00.000Z",
  order_count: 3,
  gross_revenue: 120,
  paid_revenue: 100,
  refunded_amount: 0,
  aov: 40,
  top_items: [],
  popular_items: [],
  busy_hours: [],
}

describe("useSalesReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchSalesReport.mockResolvedValue(report)
  })

  it("loads the report for the selected range", async () => {
    const { result } = renderHook(
      () =>
        useSalesReport(
          "restaurant-1",
          "2026-10-14T00:00:00.000Z",
          "2026-11-12T10:30:00.000Z",
        ),
      { wrapper },
    )

    await waitFor(() => expect(result.current.report).not.toBeNull())

    expect(result.current.report?.order_count).toBe(3)
    expect(mocks.fetchSalesReport).toHaveBeenCalledWith(
      "2026-10-14T00:00:00.000Z",
      "2026-11-12T10:30:00.000Z",
    )
  })

  it("exposes loading and error states", async () => {
    mocks.fetchSalesReport.mockRejectedValueOnce(
      new Error("You do not have permission to view sales reports."),
    )

    const { result } = renderHook(
      () => useSalesReport("restaurant-1", null, null),
      { wrapper },
    )

    expect(result.current.isLoading).toBe(true)
    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        "You do not have permission to view sales reports.",
      ),
    )
    expect(result.current.report).toBeNull()
  })

  it("stays disabled until the restaurant is loaded", async () => {
    const { result } = renderHook(() => useSalesReport("", null, null), {
      wrapper,
    })

    await Promise.resolve()

    expect(result.current.isLoading).toBe(true)
    expect(mocks.fetchSalesReport).not.toHaveBeenCalled()
  })
})
