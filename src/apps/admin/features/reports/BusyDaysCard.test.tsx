import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { BusyDaysCard } from "./BusyDaysCard"
import type { SalesReportBusyDay } from "@shared/data/reports"

function daysWithPeak(peakDay = 5, peakOrders = 5): SalesReportBusyDay[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    orders: day === peakDay ? peakOrders : day % 3,
  }))
}

function zeroDays(): SalesReportBusyDay[] {
  return Array.from({ length: 7 }, (_, day) => ({ day, orders: 0 }))
}

describe("BusyDaysCard", () => {
  it("renders seven bars with labelled order counts", () => {
    render(<BusyDaysCard days={daysWithPeak()} timezone="Australia/Sydney" />)

    expect(screen.getAllByRole("img")).toHaveLength(7)
    expect(screen.getByLabelText("Friday – 5 orders")).toBeInTheDocument()
    expect(screen.getByLabelText("Sunday – 0 orders")).toBeInTheDocument()
    expect(screen.getByLabelText("Monday – 1 order")).toBeInTheDocument()
  })

  it("captions the busiest day", () => {
    render(<BusyDaysCard days={daysWithPeak()} timezone="Australia/Sydney" />)

    expect(screen.getByText("Busiest: Friday")).toBeInTheDocument()
  })

  it("labels every day on the axis", () => {
    render(<BusyDaysCard days={daysWithPeak()} timezone="Australia/Sydney" />)

    for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("renders a flat chart and empty note when there are no orders", () => {
    render(<BusyDaysCard days={zeroDays()} timezone="UTC" />)

    const bars = screen.getAllByRole("img")
    expect(bars).toHaveLength(7)
    expect(bars.every((bar) => bar.style.height === "2%")).toBe(true)
    expect(screen.getByText(/no orders in this period/i)).toBeInTheDocument()
    expect(screen.queryByText(/busiest:/i)).not.toBeInTheDocument()
  })

  it("keeps missing days zero-filled and stable", () => {
    render(<BusyDaysCard days={[{ day: 3, orders: 2 }]} timezone="UTC" />)

    expect(screen.getAllByRole("img")).toHaveLength(7)
    expect(screen.getByLabelText("Wednesday – 2 orders")).toBeInTheDocument()
    expect(screen.getByText("Busiest: Wednesday")).toBeInTheDocument()
  })
})
