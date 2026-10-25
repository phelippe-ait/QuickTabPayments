import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CheckoutScreen } from "./CheckoutScreen"

const items = [
  {
    menuItemId: "item-1",
    name: "Flat White",
    unitPrice: 4.7,
    quantity: 1,
  },
]

function setup(overrides: Partial<Parameters<typeof CheckoutScreen>[0]> = {}) {
  const onPlaceOrder = vi.fn().mockResolvedValue(undefined)
  render(
    <CheckoutScreen
      items={items}
      currency="AUD"
      taxRate={0.1}
      tableNumber="T05"
      canCheckout
      onClose={() => {}}
      onPlaceOrder={onPlaceOrder}
      {...overrides}
    />,
  )
  return { onPlaceOrder }
}

describe("CheckoutScreen", () => {
  it("shows GST-inclusive subtotal, tax and total to the cent", () => {
    setup()

    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText(/4\.27/)).toBeInTheDocument()
    expect(screen.getByText(/GST \(included/)).toBeInTheDocument()
    expect(screen.getByText(/0\.43/)).toBeInTheDocument()
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
  })

  it("does not render the old fake card or express checkout UI", () => {
    setup()

    expect(screen.queryByText(/Apple Pay/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Card Number/i)).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue("1234 5678 9012 3456"),
    ).not.toBeInTheDocument()
  })

  it("disables order placement until a name is entered", () => {
    setup()
    const button = screen.getByRole("button", { name: "Place order" })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Name for the order"), {
      target: { value: "  Olivia  " },
    })
    expect(button).toBeEnabled()
  })

  it("disables order placement without a QR context", () => {
    setup({ canCheckout: false })
    fireEvent.change(screen.getByLabelText("Name for the order"), {
      target: { value: "Olivia" },
    })
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled()
  })

  it("submits the trimmed name and notes", async () => {
    const { onPlaceOrder } = setup()
    fireEvent.change(screen.getByLabelText("Name for the order"), {
      target: { value: "  Olivia  " },
    })
    fireEvent.change(screen.getByLabelText("Notes for the kitchen (optional)"), {
      target: { value: "  extra hot  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Place order" }))

    expect(onPlaceOrder).toHaveBeenCalledWith({
      customerName: "Olivia",
      notes: "extra hot",
    })
  })

  it("renders a checkout error", () => {
    setup({ error: "One of your items just sold out." })
    expect(
      screen.getByText("One of your items just sold out."),
    ).toBeInTheDocument()
  })
})
