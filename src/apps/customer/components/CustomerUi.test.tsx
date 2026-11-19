import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { HeaderButton } from "./CustomerUi"

describe("HeaderButton", () => {
  it("gives an icon-only control an accessible name", () => {
    render(<HeaderButton icon="close" label="Close cart" onClick={vi.fn()} />)

    expect(screen.getByRole("button", { name: "Close cart" })).toHaveAttribute(
      "aria-label",
      "Close cart",
    )
  })

  it("exposes disclosure state for menu toggles", () => {
    render(
      <HeaderButton
        icon="menu"
        label="Open menu"
        expanded={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  it("hides the decorative icon from assistive technology", () => {
    const { container } = render(
      <HeaderButton icon="back" label="Back" onClick={vi.fn()} />,
    )

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })
})
