import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PopularItemsCard } from "./PopularItemsCard"
import type { SalesReportTopItem } from "@shared/data/reports"

const items: SalesReportTopItem[] = [
  { name: "Flat White", quantity: 8, revenue: 44 },
  { name: "Croissant", quantity: 14, revenue: 91 },
  { name: "Banana Bread", quantity: 14, revenue: 70 },
]

describe("PopularItemsCard", () => {
  it("orders items by quantity, then revenue", () => {
    render(<PopularItemsCard items={items} currency="AUD" />)

    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Croissant"),
      expect.stringContaining("Banana Bread"),
      expect.stringContaining("Flat White"),
    ])
  })

  it("shows an empty state when no items were sold", () => {
    render(<PopularItemsCard items={[]} currency="AUD" />)

    expect(
      screen.getByText(/no items sold in this period/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
