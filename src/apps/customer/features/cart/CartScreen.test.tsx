import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CartScreen } from "./CartScreen"
import type { CartItem } from "../../types"

const items: CartItem[] = [
  {
    menuItemId: "item-1",
    name: "Flat White",
    unitPrice: 4.7,
    quantity: 2,
  },
]

function Harness({ cartItems = items }: { cartItems?: CartItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open cart
      </button>
      {open && (
        <CartScreen
          items={cartItems}
          total={cartItems.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
          )}
          currency="AUD"
          onClose={() => setOpen(false)}
          onRemove={vi.fn()}
          onDecrease={vi.fn()}
          onIncrease={vi.fn()}
          onCheckout={vi.fn()}
        />
      )}
    </>
  )
}

describe("CartScreen", () => {
  it("exposes modal dialog semantics and moves focus inside", () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: /open cart/i }))

    const dialog = screen.getByRole("dialog", { name: /review your order/i })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-labelledby", "cart-title")
    expect(screen.getByRole("button", { name: /close cart/i })).toHaveFocus()
  })

  it("cycles Tab focus inside the cart", () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: /open cart/i }))

    const close = screen.getByRole("button", { name: /close cart/i })
    const checkout = screen.getByRole("button", { name: /^checkout$/i })

    checkout.focus()
    fireEvent.keyDown(checkout, { key: "Tab" })
    expect(close).toHaveFocus()

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true })
    expect(checkout).toHaveFocus()
  })

  it("closes on Escape and restores focus to the opener", () => {
    render(<Harness />)

    const opener = screen.getByRole("button", { name: /open cart/i })
    opener.focus()
    fireEvent.click(opener)

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it("keeps the trap inside the empty cart's controls", () => {
    render(<Harness cartItems={[]} />)

    fireEvent.click(screen.getByRole("button", { name: /open cart/i }))

    const browse = screen.getByRole("button", { name: /browse menu/i })
    const close = screen.getByRole("button", { name: /close cart/i })

    browse.focus()
    fireEvent.keyDown(browse, { key: "Tab" })
    expect(close).toHaveFocus()
  })

  it("announces quantity changes with the item name", () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: /open cart/i }))

    expect(
      screen.getByRole("button", { name: "Decrease Flat White quantity" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Increase Flat White quantity" }),
    ).toBeInTheDocument()

    const live = screen.getByText("Flat White quantity").parentElement
    expect(live).toHaveAttribute("aria-live", "polite")
    expect(live).toHaveTextContent("Flat White quantity 2")
  })
})
