import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { SalesReport } from "@shared/data/reports"
import { ExportCsvButton } from "./ExportCsvButton"

type TestPlan = "basic" | "standard" | "premium"

const mocks = vi.hoisted(() => ({
  plan: "standard" as TestPlan,
}))

vi.mock("@shared/plans/usePlan", () => ({
  usePlan: () => ({
    plan: mocks.plan,
    has: () => mocks.plan !== "basic",
  }),
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
  popular_items: [],
  busy_hours: [],
}

const createObjectURL = vi.fn(() => "blob:report")
const revokeObjectURL = vi.fn()

describe("ExportCsvButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.plan = "standard"
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  })

  it("enables export for standard plans and announces the download", () => {
    render(
      <ExportCsvButton report={report} restaurantName="Test Café" />,
    )

    const button = screen.getByRole("button", {
      name: /export report as csv/i,
    })

    expect(button).toBeEnabled()
    expect(
      screen.queryByText(/standard plan or higher/i),
    ).not.toBeInTheDocument()

    fireEvent.click(button)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status")).toHaveTextContent(
      /CSV downloaded: quicktab-report-2026-10-14-2026-11-12\.csv/i,
    )
  })

  it("disables export for basic plans with an upgrade hint", () => {
    mocks.plan = "basic"

    render(
      <ExportCsvButton report={report} restaurantName="Test Café" />,
    )

    const button = screen.getByRole("button", {
      name: /export report as csv/i,
    })

    expect(button).toBeDisabled()
    expect(screen.getByText(/standard plan or higher/i)).toBeInTheDocument()

    fireEvent.click(button)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("stays disabled while the report is loading or missing", () => {
    const { rerender } = render(
      <ExportCsvButton
        report={report}
        restaurantName="Test Café"
        loading
      />,
    )

    expect(
      screen.getByRole("button", { name: /export report as csv/i }),
    ).toBeDisabled()

    rerender(<ExportCsvButton report={null} restaurantName="Test Café" />)
    expect(
      screen.getByRole("button", { name: /export report as csv/i }),
    ).toBeDisabled()
  })
})
