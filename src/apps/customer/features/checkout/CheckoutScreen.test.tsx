import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CheckoutScreen } from "./CheckoutScreen"

const items = [
  {
    menuItemId: "item-1",
    name: "Flat White",
    unitPrice: 4.7,
    quantity: 1,
  },
]

const intent = {
  clientSecret: "pi_1_secret",
  orderId: "order-1",
  orderNumber: "QT-1",
  trackingToken: "tok",
  amount: 4.7,
  currency: "AUD",
  status: "pending" as const,
}

const state = vi.hoisted(() => ({ key: "" as string }))

vi.mock("./StripeCheckout", () => ({
  PaymentsNotConfigured: () => (
    <section>Payments are not configured</section>
  ),
  StripeCheckout: ({
    onPaid,
  }: {
    onPaid: (value: typeof intent) => Promise<void> | void;
  }) => (
    <button type="button" onClick={() => void onPaid(intent)}>
      Pay 4.70
    </button>
  ),
}))

vi.mock("../../data/payments", () => ({
  PaymentSetupError: class PaymentSetupError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message)
      this.code = code
    }
  },
  get stripePublishableKey() {
    return state.key
  },
}))

function setup(overrides: Partial<Parameters<typeof CheckoutScreen>[0]> = {}) {
  const onPlaceOrder =
    overrides.onPlaceOrder ?? vi.fn().mockResolvedValue(undefined)
  render(
    <CheckoutScreen
      items={items}
      currency="AUD"
      taxRate={0.1}
      restaurantName="QuickTab Demo Cafe"
      restaurantSlug="cafe"
      tableToken="table-token"
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
    state.key = "pk_test_123"
  })

  it("shows GST-inclusive subtotal, tax and total to the cent", () => {
    setup()

    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText(/4\.27/)).toBeInTheDocument()
    expect(screen.getByText("GST (included, 10%)")).toBeInTheDocument()
    expect(screen.getByText(/0\.43/)).toBeInTheDocument()
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
  })

  it("renders the Stripe payment form when a publishable key exists", () => {
    setup()
    expect(
      screen.getByRole("button", { name: "Pay 4.70" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Payments are not configured")).not.toBeInTheDocument()
  })

  it("shows an honest notice when payments are not configured", () => {
    state.key = ""
    setup()
    expect(screen.getByText("Payments are not configured")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pay 4.70" })).not.toBeInTheDocument()
  })

  it("places the order with the customer name and payment intent", async () => {
    const { onPlaceOrder } = setup()
    enterDetails()

    fireEvent.click(screen.getByRole("button", { name: "Pay 4.70" }))

    await waitFor(() =>
      expect(onPlaceOrder).toHaveBeenCalledWith({
        customerName: "Olivia",
        notes: "extra hot",
        intent,
      }),
    )
  })

  it("does not require card number fields on the checkout screen", () => {
    setup()
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument()
  })

  it("renders a checkout error", () => {
    setup({ error: "One of your items just sold out." })
    expect(
      screen.getByText("One of your items just sold out."),
    ).toBeInTheDocument()
  })
})
