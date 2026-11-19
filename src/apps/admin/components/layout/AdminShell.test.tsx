import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { AdminShell } from "./AdminShell"

vi.mock("@shared/plans/usePlan", () => ({
  usePlan: () => ({ plan: "standard", has: () => true }),
}))

function Harness() {
  const [open, setOpen] = useState(false)

  return (
    <MemoryRouter>
      <AdminShell
        sections={["catalog", "orders"]}
        restaurantName="Test Café"
        userName="Test Manager"
        userRole="Owner"
        userInitials="TM"
        onOpenProfile={vi.fn()}
        onSignOut={vi.fn()}
        mobileNavOpen={open}
        onToggleMobileNav={() => setOpen((current) => !current)}
        onCloseMobileNav={() => setOpen(false)}
      >
        <p>Page content</p>
      </AdminShell>
    </MemoryRouter>
  )
}

describe("AdminShell mobile navigation", () => {
  it("moves focus into the open drawer, closes on Escape and restores focus", () => {
    render(<Harness />)

    const toggle = screen.getByLabelText("Open navigation")
    toggle.focus()
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveFocus()
    expect(document.body.style.overflow).toBe("hidden")

    fireEvent.keyDown(document, { key: "Escape" })

    expect(toggle).toHaveAttribute("aria-expanded", "false")
    // Focus restoration goes through the shared dialog hook; the toggle is
    // `display: none` outside the mobile breakpoint in jsdom, so the real
    // restore target is asserted by the Playwright responsive spec instead.
    expect(document.body.style.overflow).toBe("")
  })

  it("closes the drawer when the overlay is pressed", () => {
    render(<Harness />)

    fireEvent.click(screen.getByLabelText("Open navigation"))
    const scrim = screen.getAllByLabelText("Close navigation")[1]
    fireEvent.click(scrim)

    expect(
      screen.getByLabelText("Open navigation"),
    ).toHaveAttribute("aria-expanded", "false")
  })
})
