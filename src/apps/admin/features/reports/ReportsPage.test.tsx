import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ReportsPage } from "./ReportsPage"
import type { SalesReport } from "@shared/data/reports"

type TestPlan = "basic" | "standard" | "premium"

type SalesState = {
  report: SalesReport | null
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  restaurant: null as null | {
    id: string
    name: string
    plan: TestPlan
    currency: string
    timezone: string
  },
  sales: {
    report: null as SalesReport | null,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
  } as SalesState,
}))

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: () => ({ restaurant: mocks.restaurant, role: "owner" }),
}))

vi.mock("../../hooks/useSalesReport", () => ({
  useSalesReport: () => mocks.sales,
}))

const report: SalesReport = {
  currency: "AUD",
  from: "2026-10-14T00:00:00.000Z",
  to: "2026-11-12T10:30:00.000Z",
  order_count: 12,
  gross_revenue: 1234.5,
  paid_revenue: 1200,
  refunded_amount: 50,
  aov: 102.88,
  top_items: [],
  busy_hours: [],
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.restaurant = {
      id: "restaurant-1",
      name: "Test Café",
      plan: "standard",
      currency: "AUD",
      timezone: "UTC",
    }
    mocks.sales = {
      report,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }
  })

  it("renders the KPI cards for standard restaurants", () => {
    render(<ReportsPage />)

    expect(
      screen.getByRole("heading", { name: /^reports$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Gross revenue")).toBeInTheDocument()
    expect(screen.getByText("Paid revenue")).toBeInTheDocument()
    expect(screen.getByText("Orders")).toBeInTheDocument()
    expect(screen.getByText("Average order value")).toBeInTheDocument()
    expect(screen.getByText("Refunded")).toBeInTheDocument()

    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument()
    expect(screen.getByText(/1,200\.00/)).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText(/102\.88/)).toBeInTheDocument()
    expect(screen.getByText(/50\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/upgrade to/i)).not.toBeInTheDocument()
  })

  it("renders the KPI cards for premium restaurants", () => {
    mocks.restaurant = {
      id: "restaurant-1",
      name: "Test Café",
      plan: "premium",
      currency: "AUD",
      timezone: "UTC",
    }

    render(<ReportsPage />)

    expect(screen.getByText("Gross revenue")).toBeInTheDocument()
  })

  it("shows the period selector", () => {
    render(<ReportsPage />)

    expect(
      screen.getByRole("group", { name: /period presets/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Last 30 days" }),
    ).toBeInTheDocument()
  })

  it("shows skeleton cards while the report loads", () => {
    mocks.sales = {
      ...mocks.sales,
      report: null,
      isLoading: true,
    }

    render(<ReportsPage />)

    expect(
      screen.getByRole("status", { name: /loading sales report/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Gross revenue")).not.toBeInTheDocument()
  })

  it("shows the error panel and retries", () => {
    mocks.sales = {
      ...mocks.sales,
      report: null,
      error: new Error("You do not have permission to view sales reports."),
    }

    render(<ReportsPage />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      /do not have permission to view sales reports/i,
    )
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(mocks.sales.refetch).toHaveBeenCalledTimes(1)
  })

  it("renders zeroed cards and an empty note when there are no orders", () => {
    mocks.sales = {
      ...mocks.sales,
      report: {
        ...report,
        order_count: 0,
        gross_revenue: 0,
        paid_revenue: 0,
        refunded_amount: 0,
        aov: 0,
      },
    }

    render(<ReportsPage />)

    expect(screen.getByText(/no orders in this period/i)).toBeInTheDocument()
    expect(screen.getAllByText(/A?\$0\.00/)).toHaveLength(4)
    expect(screen.getByText("0")).toBeInTheDocument()
  })

  it("shows the upgrade panel for basic restaurants", () => {
    mocks.restaurant = {
      id: "restaurant-1",
      name: "Test Café",
      plan: "basic",
      currency: "AUD",
      timezone: "UTC",
    }

    render(<ReportsPage />)

    expect(screen.queryByText("Gross revenue")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /upgrade to standard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/currently on basic/i)).toBeInTheDocument()
  })

  it("shows a loading state until the restaurant record arrives", () => {
    mocks.restaurant = null

    render(<ReportsPage />)

    expect(
      screen.getByRole("status", { name: /loading reports/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Gross revenue")).not.toBeInTheDocument()
  })
})
