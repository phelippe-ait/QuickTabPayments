import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { OrderConfirmation } from "./OrderConfirmation"
import type { PlacedOrder } from "../../data/placeOrder"

const order: PlacedOrder = {
  orderId: "order-1",
  orderNumber: "QT-261025-0001",
  trackingToken: "token-1",
  status: "confirmed",
  subtotal: 4.27,
  tax: 0.43,
  total: 4.7,
  currency: "AUD",
  restaurantName: "QuickTab Demo Cafe",
  tableNumber: "T05",
  customerName: "Olivia",
  createdAt: "2026-10-25T02:00:00Z",
  taxRate: 0.1,
  paymentStatus: "succeeded" as const,
  receiptUrl: "https://receipt.example",
  items: [
    {
      name: "Flat White",
      quantity: 1,
      unitPrice: 4.7,
      subtotal: 4.7,
      modifiers: [{ name: "Oat milk", priceAdjustment: 0.5 }],
    },
  ],
}

function renderConfirmation() {
  render(
    <MemoryRouter>
      <OrderConfirmation
        order={order}
        isLoggedIn={false}
        onClose={() => {}}
        onLogin={() => {}}
        onSignup={() => {}}
      />
    </MemoryRouter>,
  )
}

describe("OrderConfirmation", () => {
  it("shows the order, table, items, totals and a tracking link", () => {
    renderConfirmation()

    expect(screen.getByText("QT-261025-0001")).toBeInTheDocument()
    expect(screen.getByText("Table T05")).toBeInTheDocument()
    expect(screen.getByText(/Flat White/)).toBeInTheDocument()
    expect(screen.getByText("Oat milk")).toBeInTheDocument()
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
    expect(screen.getByText("Payment received")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
      "href",
      "https://receipt.example",
    )
    expect(screen.getByText("GST (included, 10%)")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Track order" })).toHaveAttribute(
      "href",
      "/order/QT-261025-0001?token=token-1",
    )
  })

  it("renders a safe empty state when there is no order", () => {
    render(
      <MemoryRouter>
        <OrderConfirmation
          order={null}
          isLoggedIn
          onClose={() => {}}
          onLogin={() => {}}
          onSignup={() => {}}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText("We couldn't find that order")).toBeInTheDocument()
  })

  it("shows the tip and the amount due from the payment response", () => {
    render(
      <MemoryRouter>
        <OrderConfirmation
          order={{ ...order, tipAmount: 0.47, amountDue: 5.17 }}
          isLoggedIn={false}
          onClose={() => {}}
          onLogin={() => {}}
          onSignup={() => {}}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText("Tip")).toBeInTheDocument()
    expect(screen.getByText(/0\.47/)).toBeInTheDocument()
    expect(screen.getByText("Amount due")).toBeInTheDocument()
    expect(screen.getByText(/5\.17/)).toBeInTheDocument()
    expect(
      screen.getByText(/GST is included in the items total/i),
    ).toBeInTheDocument()
  })
})
