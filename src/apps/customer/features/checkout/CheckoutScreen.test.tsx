import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CheckoutScreen } from "./CheckoutScreen"

const mocks = vi.hoisted(() => ({
  simulatePayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../data/simulatedPayment", () => ({
  simulatePayment: mocks.simulatePayment,
}))

const items = [
  {
    menuItemId: "item-1",
    name: "Flat White",
    unitPrice: 4.7,
    quantity: 1,
  },
]

function setup(overrides: Partial<Parameters<typeof CheckoutScreen>[0]> = {}) {
  const onPlaceOrder =
    overrides.onPlaceOrder ?? vi.fn().mockResolvedValue(undefined)
  render(
    <CheckoutScreen
      items={items}
      currency="AUD"
      taxRate={0.1}
      tableNumber="T05"
      canCheckout
      onClose={() => {}}
      {...overrides}
      onPlaceOrder={onPlaceOrder}
    />,
  )
  return { onPlaceOrder }
}

function enterDetails() {
  fireEvent.change(screen.getByLabelText("Name for the order"), {
    target: { value: "  Olivia  " },
  })
  fireEvent.change(screen.getByLabelText("Notes for the kitchen (optional)"), {
    target: { value: "  extra hot  " },
  })
}

describe("CheckoutScreen", () => {
  beforeEach(() => {
    mocks.simulatePayment.mockClear()
  })

  it("shows GST-inclusive subtotal, tax and total to the cent", () => {
    setup()

    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText(/4\.27/)).toBeInTheDocument()
    expect(screen.getByText(/GST \(included/)).toBeInTheDocument()
    expect(screen.getByText(/0\.43/)).toBeInTheDocument()
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
  })

  it("offers the four simulated payment methods", () => {
    setup()

    expect(
      screen.getByRole("button", { name: "Credit / Debit Card" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apple Pay" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Google Pay" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument()
    expect(screen.getByText(/Test mode — payment is simulated/i)).toBeInTheDocument()
  })

  it("does not require card number fields in the simulation", () => {
    setup()
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument()
  })

  it("disables payment methods until a name is entered", () => {
    setup()
    expect(
      screen.getByRole("button", { name: "Credit / Debit Card" }),
    ).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Name for the order"), {
      target: { value: "Olivia" },
    })
    expect(
      screen.getByRole("button", { name: "Credit / Debit Card" }),
    ).toBeEnabled()
  })

  it("disables payment methods without a QR context", () => {
    setup({ canCheckout: false })
    fireEvent.change(screen.getByLabelText("Name for the order"), {
      target: { value: "Olivia" },
    })
    expect(
      screen.getByRole("button", { name: "Credit / Debit Card" }),
    ).toBeDisabled()
  })

  it.each([
    ["Credit / Debit Card", "card"],
    ["Apple Pay", "apple_pay"],
    ["Google Pay", "google_pay"],
    ["Link", "link"],
  ] as const)(
    "simulates %s and places the order",
    async (label, method) => {
      const { onPlaceOrder } = setup()
      enterDetails()

      fireEvent.click(screen.getByRole("button", { name: label }))

      expect(mocks.simulatePayment).toHaveBeenCalledWith(method)
      await waitFor(() =>
        expect(onPlaceOrder).toHaveBeenCalledWith({
          customerName: "Olivia",
          notes: "extra hot",
          paymentMethod: method,
        }),
      )
    },
  )

  it("shows progress and disables every method while processing", async () => {
    const { onPlaceOrder } = setup({
      onPlaceOrder: vi.fn().mockReturnValue(new Promise(() => {})),
    })
    enterDetails()

    fireEvent.click(screen.getByRole("button", { name: "Apple Pay" }))

    expect(
      await screen.findByText("Processing Apple Pay…"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Credit / Debit Card" }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled()
    await waitFor(() => expect(onPlaceOrder).toHaveBeenCalledTimes(1))
  })

  it("renders a checkout error", () => {
    setup({ error: "One of your items just sold out." })
    expect(
      screen.getByText("One of your items just sold out."),
    ).toBeInTheDocument()
  })
})
