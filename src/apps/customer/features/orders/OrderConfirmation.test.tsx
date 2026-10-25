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
  paymentMethod: "apple_pay",
  items: [{ name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 }],
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
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
    expect(screen.getByText("Paid with Apple Pay")).toBeInTheDocument()
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
})
