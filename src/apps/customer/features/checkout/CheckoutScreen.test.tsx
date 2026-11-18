import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import {
  computeTipPreview,
  roundMoney,
  type TipSelection,
} from "@shared/lib/money"
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
  total: 4.7,
  tipAmount: 0,
  amountDue: 4.7,
  currency: "AUD",
  status: "pending" as const,
}

type CapturedStripeProps = {
  canPay: boolean;
  amountDue: number;
  tip: TipSelection | null;
  onPaid: (value: typeof intent) => Promise<void> | void;
};

const state = vi.hoisted(() => ({
  key: "" as string,
  props: null as null | CapturedStripeProps,
}))

vi.mock("./StripeCheckout", () => ({
  PaymentsNotConfigured: () => (
    <section>Payments are not configured</section>
  ),
  StripeCheckout: (props: {
    canPay: boolean;
    tip: TipSelection | null;
    onPaid: (value: typeof intent) => Promise<void> | void;
  }) => {
    const total = 4.7;
    const amountDue = roundMoney(total + computeTipPreview(total, props.tip));
    state.props = { ...props, amountDue };
    return (
      <button
        type="button"
        disabled={!props.canPay}
        onClick={() => void props.onPaid(intent)}
      >
        Pay {amountDue.toFixed(2)}
      </button>
    );
  },
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

function chooseCustomTip(value: string) {
  fireEvent.click(screen.getByRole("radio", { name: "Custom amount" }))
  fireEvent.change(screen.getByLabelText("Custom tip amount (AUD)"), {
    target: { value },
  })
}

describe("CheckoutScreen", () => {
  beforeEach(() => {
    state.key = "pk_test_123"
    state.props = null
  })

  it("shows GST-inclusive subtotal, tax and total to the cent", () => {
    setup()

    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText(/4\.27/)).toBeInTheDocument()
    expect(screen.getByText("GST (included, 10%)")).toBeInTheDocument()
    expect(screen.getByText(/0\.43/)).toBeInTheDocument()
    expect(screen.getByText("Items total")).toBeInTheDocument()
    expect(screen.getByText("Amount due")).toBeInTheDocument()
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

  it("defaults to no tip and shows the amount due equal to the items total", () => {
    setup()
    enterDetails()

    expect(state.props?.tip).toBeNull()
    expect(state.props?.amountDue).toBe(4.7)
    expect(
      screen.getByRole("radio", { name: "0%" }),
    ).toBeChecked()
  })

  it("sends a percentage tip and previews it in the summary", () => {
    setup()
    enterDetails()

    fireEvent.click(screen.getByRole("radio", { name: "10%" }))

    expect(state.props?.tip).toEqual({ type: "percent", value: 10 })
    expect(state.props?.amountDue).toBe(5.17)
    expect(screen.getAllByText("Tip (10%)").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0\.47/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/5\.17/).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Pay 5.17" })).toBeEnabled()
  })

  it("sends a fixed tip from the custom amount input", () => {
    setup()
    enterDetails()

    chooseCustomTip("5")

    expect(state.props?.tip).toEqual({ type: "fixed", value: 5 })
    expect(state.props?.amountDue).toBe(9.7)
    expect(screen.getAllByText("Tip").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/9\.70/).length).toBeGreaterThan(0)
  })

  it("returns to no tip when the 0% preset is selected", () => {
    setup()
    enterDetails()
    fireEvent.click(screen.getByRole("radio", { name: "10%" }))
    fireEvent.click(screen.getByRole("radio", { name: "0%" }))

    expect(state.props?.tip).toBeNull()
    expect(state.props?.amountDue).toBe(4.7)
  })

  it.each([
    ["-5", /can't be negative/i],
    ["600", /more than \$500/i],
    ["abc", /valid amount/i],
  ])("blocks payment for an invalid custom tip (%s)", (input, message) => {
    setup()
    enterDetails()

    chooseCustomTip(input)

    expect(state.props?.tip).toBeNull()
    expect(screen.getByRole("button", { name: /Pay 4\.70/ })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(message)
  })
})
