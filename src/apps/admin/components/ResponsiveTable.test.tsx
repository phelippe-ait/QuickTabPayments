import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResponsiveTable } from "./ResponsiveTable"

describe("ResponsiveTable", () => {
  it("renders its children inside a labelled, focusable scroll region", () => {
    render(
      <ResponsiveTable label="Order history table">
        <div role="table" aria-label="Orders">
          <div role="row">#1048</div>
        </div>
      </ResponsiveTable>,
    )

    const region = screen.getByRole("region", { name: "Order history table" })

    expect(region).toHaveAttribute("tabindex", "0")
    expect(region).toContainElement(
      screen.getByRole("table", { name: "Orders" }),
    )
    expect(region).toHaveTextContent("#1048")
  })

  it("keeps caller classes alongside the scroll container", () => {
    render(
      <ResponsiveTable label="Users table" className="custom-table-class">
        <span>Row</span>
      </ResponsiveTable>,
    )

    const region = screen.getByRole("region", { name: "Users table" })

    expect(region).toHaveClass("custom-table-class")
    expect(region.className).not.toBe("custom-table-class")
  })
})
