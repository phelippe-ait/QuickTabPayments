import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { TopItemsCard } from "./TopItemsCard"
import type { SalesReportTopItem } from "@shared/data/reports"

const items: SalesReportTopItem[] = [
  { name: "Croissant", quantity: 9, revenue: 58.5 },
  { name: "Flat White", quantity: 4, revenue: 22 },
  { name: "Banana Bread", quantity: 6, revenue: 30 },
  { name: "Cold Brew", quantity: 2, revenue: 16 },
]

describe("TopItemsCard", () => {
  it("orders items by revenue, highest first", () => {
    render(<TopItemsCard items={items} currency="AUD" />)

    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Croissant"),
      expect.stringContaining("Banana Bread"),
      expect.stringContaining("Flat White"),
      expect.stringContaining("Cold Brew"),
    ])
  })

  it("shows badges for the top three ranks only", () => {
    render(<TopItemsCard items={items} currency="AUD" />)

    expect(screen.getByLabelText("Rank 1")).toHaveClass("bg-berry-soft")
    expect(screen.getByLabelText("Rank 2")).toHaveClass("bg-berry-soft")
    expect(screen.getByLabelText("Rank 3")).toHaveClass("bg-berry-soft")
    expect(screen.getByLabelText("Rank 4")).not.toHaveClass("bg-berry-soft")
  })

  it("renders quantity and formatted revenue", () => {
    render(<TopItemsCard items={items} currency="AUD" />)

    expect(screen.getByText("9")).toBeInTheDocument()
    expect(screen.getByText(/58\.50/)).toBeInTheDocument()
  })

  it("shows an empty state when no items were sold", () => {
    render(<TopItemsCard items={[]} currency="AUD" />)

    expect(
      screen.getByText(/no items sold in this period/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
