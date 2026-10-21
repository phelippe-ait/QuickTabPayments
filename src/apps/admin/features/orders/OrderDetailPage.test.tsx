import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { OrderDetailPage } from "./OrderDetailPage"
import type { Refund } from "@shared/lib/database.types"
import type { OrderVM } from "../../types"

const order: OrderVM = {
  id: "order-1",
  orderNumber: "1048",
  status: "pending",
  createdAt: "2026-10-21T08:30:00Z",
  createdAtLabel: "21 Oct 2026, 7:30 pm",
  total: 13.64,
  subtotal: 12.4,
  tax: 1.24,
  currency: "AUD",
  tableNumber: "T02",
  customerName: "Olivia Moore",
  lineItems: [
    {
      id: "line-1",
      name: "Flat White",
      quantity: 2,
      unitPrice: 4.7,
      subtotal: 9.4,
      imageUrl: null,
      notes: "Oat milk",
    },
  ],
  payments: [
    {
      id: "payment-1",
      status: "succeeded",
      amount: 13.64,
      currency: "AUD",
      method: "Card",
      paidAt: "2026-10-21T08:30:05Z",
      receiptUrl: null,
      failureReason: null,
    },
  ],
  refundedTotal: 0,
}

const mocks = vi.hoisted(() => ({
  role: "owner" as "owner" | "manager" | "kitchen",
  order: null as OrderVM | null,
  isLoading: false,
  error: null as Error | null,
  setStatus: vi.fn(async () => true),
  cancel: vi.fn(async () => true),
  confirm: vi.fn(),
  notify: vi.fn(),
  refunds: [] as Refund[],
  createRefund: vi.fn(async () => true),
}))

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  useRestaurant: () => ({
    restaurant: {
      id: "restaurant-1",
      name: "Test Café",
      currency: "AUD",
      timezone: "Australia/Sydney",
    },
    role: mocks.role,
  }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: mocks.confirm }),
}))

vi.mock("../../hooks/useOrders", () => ({
  useOrder: () => ({
    order: mocks.order,
    isLoading: mocks.isLoading,
    error: mocks.error,
    refetch: vi.fn(),
  }),
  useOrderMutations: () => ({
    isMutating: false,
    setStatus: mocks.setStatus,
    cancel: mocks.cancel,
  }),
}))

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}))

vi.mock("../../hooks/useRefunds", () => ({
  useRefunds: () => ({
    refunds: mocks.refunds,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateRefund: () => ({
    isMutating: false,
    createRefund: mocks.createRefund,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/orders/order-1"]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("OrderDetailPage", () => {
  beforeEach(() => {
    mocks.role = "owner"
    mocks.order = order
    mocks.isLoading = false
    mocks.error = null
    mocks.setStatus.mockClear()
    mocks.cancel.mockClear()
    mocks.confirm.mockClear()
    mocks.refunds = []
    mocks.createRefund.mockClear()
  })

  it("renders line items, payment rows, and legal transition buttons", () => {
    renderPage()

    expect(screen.getByRole("heading", { name: "#1048" })).toBeInTheDocument()
    expect(screen.getByText("Flat White")).toBeInTheDocument()
    expect(screen.getByText(/oat milk/i)).toBeInTheDocument()
    expect(screen.getByText("Card")).toBeInTheDocument()
    expect(screen.getByText("succeeded")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /mark confirmed/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /mark completed/i })).toBeNull()
  })

  it("advances status through the shared matrix", () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /mark confirmed/i }))

    expect(mocks.setStatus).toHaveBeenCalledWith("order-1", "pending", "confirmed")
  })

  it("is read-only for kitchen staff", () => {
    mocks.role = "kitchen"
    renderPage()

    expect(screen.queryByRole("button", { name: /mark confirmed/i })).toBeNull()
    expect(screen.getByText(/kitchen accounts can view/i)).toBeInTheDocument()
  })

  it("asks for confirmation before cancelling", () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /^cancel order$/i }))

    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.confirm.mock.calls[0][0]).toEqual(
      expect.objectContaining({ actionLabel: "Cancel order" }),
    )
  })

  it("records a partial refund keyed by order-item id", async () => {
    mocks.order = { ...order, status: "completed" }
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: /partial refund/i }))
    fireEvent.click(screen.getByRole("button", { name: /add one flat white to refund/i }))
    fireEvent.click(screen.getByRole("button", { name: /confirm refund/i }))

    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    const confirmation = mocks.confirm.mock.calls[0][0] as {
      onConfirm: () => void
    }
    confirmation.onConfirm()

    await waitFor(() =>
      expect(mocks.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: "order-1",
          payment_id: "payment-1",
          order_item_id: "line-1",
          quantity: 1,
          amount: 4.7,
        }),
      ),
    )
  })

  it("shows existing refund history", () => {
    mocks.order = { ...order, status: "completed", refundedTotal: 4.7 }
    mocks.refunds = [
      {
        id: "refund-1",
        order_id: "order-1",
        payment_id: "payment-1",
        order_item_id: "line-1",
        quantity: 1,
        amount: 4.7,
        reason: "One coffee remade",
        status: "succeeded",
        stripe_refund_id: null,
        created_by: "user-1",
        created_at: "2026-10-21T09:00:00Z",
      },
    ]
    renderPage()

    expect(screen.getByText(/one coffee remade/i)).toBeInTheDocument()
    expect(screen.getAllByText(/4\.70/).length).toBeGreaterThan(0)
  })
})
