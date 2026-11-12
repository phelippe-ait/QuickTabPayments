import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { BusyHoursCard } from "./BusyHoursCard"
import type { SalesReportBusyHour } from "@shared/data/reports"

function hoursWithPeak(peakHour = 13, peakOrders = 5): SalesReportBusyHour[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: hour === peakHour ? peakOrders : hour % 4,
  }))
}

function zeroHours(): SalesReportBusyHour[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }))
}

describe("BusyHoursCard", () => {
  it("renders 24 bars with labelled order counts", () => {
    render(
      <BusyHoursCard hours={hoursWithPeak()} timezone="Australia/Sydney" />,
    )

    expect(screen.getAllByRole("img")).toHaveLength(24)
    expect(screen.getByLabelText("13:00 – 5 orders")).toBeInTheDocument()
    expect(screen.getByLabelText("00:00 – 0 orders")).toBeInTheDocument()
    expect(screen.getByLabelText("01:00 – 1 order")).toBeInTheDocument()
  })

  it("captions the busiest hour", () => {
    render(
      <BusyHoursCard hours={hoursWithPeak()} timezone="Australia/Sydney" />,
    )

    expect(screen.getByText("Busiest: 1pm")).toBeInTheDocument()
  })

  it("labels only every third hour on the axis", () => {
    render(
      <BusyHoursCard hours={hoursWithPeak()} timezone="Australia/Sydney" />,
    )

    expect(screen.getByText("6a")).toBeInTheDocument()
    expect(screen.getByText("12p")).toBeInTheDocument()
    expect(screen.getByText("9p")).toBeInTheDocument()
    expect(screen.queryByText("1a")).not.toBeInTheDocument()
  })

  it("renders a flat chart and empty note when there are no orders", () => {
    render(<BusyHoursCard hours={zeroHours()} timezone="UTC" />)

    const bars = screen.getAllByRole("img")
    expect(bars).toHaveLength(24)
    expect(bars.every((bar) => bar.style.height === "2%")).toBe(true)
    expect(screen.getByText(/no orders in this period/i)).toBeInTheDocument()
    expect(screen.queryByText(/busiest:/i)).not.toBeInTheDocument()
  })

  it("keeps missing hours zero-filled and stable", () => {
    render(
      <BusyHoursCard hours={[{ hour: 8, orders: 2 }]} timezone="UTC" />,
    )

    expect(screen.getAllByRole("img")).toHaveLength(24)
    expect(screen.getByLabelText("08:00 – 2 orders")).toBeInTheDocument()
    expect(screen.getByText("Busiest: 8am")).toBeInTheDocument()
  })
})
