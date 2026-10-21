import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { OrdersPage } from "./OrdersPage"
import type { OrderVM } from "../../types"

const order: OrderVM = {
  id: "order-1",
  orderNumber: "1048",
  status: "preparing",
  createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  createdAtLabel: "21 Oct 2026, 9:42 am",
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
      notes: null,
    },
  ],
  payments: [],
  refundedTotal: 0,
}

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  orders: [] as OrderVM[],
  count: 0,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
  stats: {
    today: { orders: 0, revenue: 0, average: 0 },
    yesterday: { orders: 0, revenue: 0, average: 0 },
  },
}))

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  useRestaurant: () => ({
    restaurant: {
      id: "restaurant-1",
      name: "Test Café",
      slug: "test-cafe",
      currency: "AUD",
      timezone: "Australia/Sydney",
    },
    role: "owner",
  }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: vi.fn() }),
}))

vi.mock("../../hooks/useOrders", () => ({
  useOrders: () => ({
    orders: mocks.orders,
    count: mocks.count,
    isLoading: mocks.isLoading,
    isFetching: mocks.isFetching,
    error: mocks.error,
    refetch: mocks.refetch,
  }),
  useOrderStats: () => ({
    stats: mocks.stats,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  )
}

describe("OrdersPage", () => {
  beforeEach(() => {
    mocks.orders = []
    mocks.count = 0
    mocks.isLoading = false
    mocks.isFetching = false
    mocks.error = null
    mocks.stats = {
      today: { orders: 0, revenue: 0, average: 0 },
      yesterday: { orders: 0, revenue: 0, average: 0 },
    }
  })

  it("renders database stats", () => {
    mocks.stats = {
      today: { orders: 4, revenue: 50, average: 12.5 },
      yesterday: { orders: 2, revenue: 25, average: 12.5 },
    }
    renderPage()

    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument()
    expect(screen.getAllByText(/\+100% from yesterday/).length).toBeGreaterThan(0)
  })

  it("links each order number to its deep link", () => {
    mocks.orders = [order]
    mocks.count = 1
    renderPage()

    const link = screen.getByRole("link", { name: "#1048" })
    expect(link).toHaveAttribute("href", "/admin/orders/order-1")
    expect(screen.getByText("Olivia Moore")).toBeInTheDocument()
    expect(screen.getAllByText("Preparing").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /order history/i })).toBeNull()
  })

  it("shows a retryable error", () => {
    mocks.error = new Error("orders unavailable")
    renderPage()

    expect(screen.getByText(/couldn't load orders/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("shows the empty state", () => {
    renderPage()
    expect(screen.getByText(/no orders found/i)).toBeInTheDocument()
  })
})
