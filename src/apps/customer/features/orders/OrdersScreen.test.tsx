import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { OrdersScreen } from "./OrdersScreen"
import type { CustomerOrder } from "../../data/orders"
import type { CartItem, MenuItem } from "../../types"

const mocks = vi.hoisted(() => ({
  getCustomerOrderHistory: vi.fn(),
  fetchMenu: vi.fn(),
}))

vi.mock("../../data/orders", () => ({
  getCustomerOrderHistory: mocks.getCustomerOrderHistory,
}))

vi.mock("../../data/menuApi", () => ({
  fetchMenu: mocks.fetchMenu,
}))

const flatWhite: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "",
  price: 5,
  imageUrl: null,
  allergens: [],
  dietaryTags: [],
  categoryId: "category-1",
  displayOrder: 0,
  modifierGroups: [
    {
      id: "group-size",
      name: "Cup size",
      selectionType: "single",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        { id: "size-regular", name: "Regular", priceAdjustment: 0 },
        { id: "size-large", name: "Large", priceAdjustment: 1.5 },
      ],
    },
  ],
}

const order: CustomerOrder = {
  id: "order-1",
  orderNumber: "QT-261117-0001",
  status: "completed",
  subtotal: 9.4,
  tax: 0.85,
  total: 10.25,
  tipAmount: 0,
  amountDue: 10.25,
  amountPaid: 10.25,
  currency: "AUD",
  restaurantName: "QuickTab Demo Cafe",
  tableNumber: "T05",
  trackingToken: "token-1",
  createdAt: "2026-11-17T02:00:00Z",
  paymentStatus: "succeeded",
  receiptUrl: null,
  refundedTotal: 0,
  items: [
    {
      menuItemId: "item-1",
      name: "Flat White",
      quantity: 1,
      unitPrice: 5,
      subtotal: 5,
      modifiers: [
        { id: "size-large", name: "Large", priceAdjustment: 1.5 },
      ],
    },
    {
      menuItemId: "item-gone",
      name: "Old Muffin",
      quantity: 2,
      unitPrice: 3,
      subtotal: 6,
    },
  ],
}

function menuWith(items: MenuItem[]) {
  return [
    {
      id: "category-1",
      name: "Hot Beverages",
      description: "",
      displayOrder: 0,
      items,
    },
  ]
}

function renderScreen({
  onAddToCart = vi.fn(),
  onOpenCart = vi.fn(),
  onClose = vi.fn(),
}: {
  onAddToCart?: (items: CartItem[]) => void
  onOpenCart?: () => void
  onClose?: () => void
} = {}) {
  return render(
    <MemoryRouter>
      <OrdersScreen
        customerId="customer-1"
        restaurantId="restaurant-1"
        onAddToCart={onAddToCart}
        onOpenCart={onOpenCart}
        onClose={onClose}
      />
    </MemoryRouter>,
  )
}

describe("OrdersScreen reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCustomerOrderHistory.mockResolvedValue([order])
  })

  it("adds the available items to the cart and explains skipped ones", async () => {
    mocks.fetchMenu.mockResolvedValue(menuWith([flatWhite]))
    const onAddToCart = vi.fn()
    const onOpenCart = vi.fn()

    renderScreen({ onAddToCart, onOpenCart })
    await screen.findByText(/Order QT-261117-0001/)

    fireEvent.click(screen.getByRole("button", { name: "Order again" }))

    await waitFor(() =>
      expect(mocks.fetchMenu).toHaveBeenCalledWith("restaurant-1"),
    )
    await waitFor(() => expect(onAddToCart).toHaveBeenCalledTimes(1))

    expect(onAddToCart.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        menuItemId: "item-1",
        quantity: 1,
        unitPrice: 6.5,
      }),
    ])

    const dialog = await screen.findByRole("dialog", {
      name: /Items skipped when reordering/i,
    })
    expect(dialog).toHaveTextContent("Old Muffin")
    expect(dialog).toHaveTextContent("No longer available")
    expect(onOpenCart).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Review cart" }))
    expect(onOpenCart).toHaveBeenCalledTimes(1)
  })

  it("goes straight to the cart when every item can be reordered", async () => {
    mocks.getCustomerOrderHistory.mockResolvedValue([
      { ...order, items: [order.items[0]] },
    ])
    mocks.fetchMenu.mockResolvedValue(menuWith([flatWhite]))
    const onOpenCart = vi.fn()

    renderScreen({ onOpenCart })
    await screen.findByText(/Order QT-261117-0001/)

    fireEvent.click(screen.getByRole("button", { name: "Order again" }))

    await waitFor(() => expect(onOpenCart).toHaveBeenCalledTimes(1))
    expect(
      screen.queryByRole("dialog", { name: /Items skipped when reordering/i }),
    ).not.toBeInTheDocument()
  })

  it("leaves the cart untouched and explains when nothing is available", async () => {
    mocks.fetchMenu.mockResolvedValue(menuWith([]))
    const onAddToCart = vi.fn()
    const onOpenCart = vi.fn()

    renderScreen({ onAddToCart, onOpenCart })
    await screen.findByText(/Order QT-261117-0001/)

    fireEvent.click(screen.getByRole("button", { name: "Order again" }))

    expect(
      await screen.findByText(/None of the items from this order are available/i),
    ).toBeInTheDocument()
    expect(onAddToCart).not.toHaveBeenCalled()
    expect(onOpenCart).not.toHaveBeenCalled()
  })

  it("shows a loading label and an error when the menu cannot be fetched", async () => {
    let rejectFetch: (error: Error) => void = () => {}
    mocks.fetchMenu.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectFetch = reject
      }),
    )

    renderScreen()
    await screen.findByText(/Order QT-261117-0001/)

    fireEvent.click(screen.getByRole("button", { name: "Order again" }))
    expect(
      await screen.findByRole("button", { name: "Loading menu…" }),
    ).toBeDisabled()

    rejectFetch(new Error("Could not load the menu. Please try again."))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the menu. Please try again.",
    )
    expect(screen.getByRole("button", { name: "Order again" })).toBeEnabled()
  })
})
