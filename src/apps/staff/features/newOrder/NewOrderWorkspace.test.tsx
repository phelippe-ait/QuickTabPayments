import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { OrderingMenuCategory } from "@shared/orders/orderingTypes"
import { NewOrderWorkspace } from "./NewOrderWorkspace"

const mocks = vi.hoisted(() => ({
  fetchOrderingMenu: vi.fn(),
  createStaffOrder: vi.fn(),
}))

vi.mock("@shared/data/orderingMenu", () => ({
  fetchOrderingMenu: mocks.fetchOrderingMenu,
}))

vi.mock("../../services/staffOrderCreation", () => ({
  createStaffOrder: mocks.createStaffOrder,
  StaffOrderError: class StaffOrderError extends Error {},
}))

const menu: OrderingMenuCategory[] = [
  {
    id: "drinks",
    name: "Drinks",
    description: "",
    displayOrder: 0,
    items: [
      {
        id: "latte",
        name: "Latte",
        description: "Espresso and milk",
        price: 4.5,
        imageUrl: null,
        allergens: ["milk"],
        dietaryTags: [],
        categoryId: "drinks",
        displayOrder: 0,
      },
    ],
  },
]

const tables = [
  {
    id: "table-1",
    tableNumber: "1",
    status: "available" as const,
    occupants: 0,
  },
  {
    id: "table-2",
    tableNumber: "2",
    locationLabel: "Patio",
    status: "occupied" as const,
    occupants: 2,
  },
]

function renderWorkspace() {
  const onOrderCreated = vi.fn()
  const onViewKitchen = vi.fn()
  render(
    <NewOrderWorkspace
      currency="AUD"
      onOrderCreated={onOrderCreated}
      onViewKitchen={onViewKitchen}
      restaurantId="restaurant-1"
      tables={tables}
      taxRate={0.1}
    />,
  )
  return { onOrderCreated, onViewKitchen }
}

async function addLatte() {
  fireEvent.click(await screen.findByRole("button", { name: /add latte/i }))
  const dialog = screen.getByRole("dialog", { name: /latte/i })
  fireEvent.click(within(dialog).getByRole("button", { name: /add to order/i }))
}

async function fillGuestName(name: string) {
  fireEvent.change(screen.getByLabelText("Guest name"), {
    target: { value: name },
  })
}

describe("NewOrderWorkspace", () => {
  beforeEach(() => {
    mocks.fetchOrderingMenu.mockReset()
    mocks.createStaffOrder.mockReset()
    mocks.fetchOrderingMenu.mockResolvedValue(menu)
  })

  it("builds a counter order and sends it to the kitchen", async () => {
    mocks.createStaffOrder.mockResolvedValue({
      orderId: "order-1",
      orderNumber: "QT-261119-0001",
      status: "confirmed",
      subtotal: 4.09,
      tax: 0.41,
      total: 4.5,
      currency: "AUD",
      restaurantName: "Demo Cafe",
      tableNumber: null,
      customerName: "Ada",
      createdAt: "2026-11-19T08:00:00Z",
      paid: false,
    })
    const { onOrderCreated } = renderWorkspace()

    await addLatte()
    await fillGuestName("Ada")
    fireEvent.change(screen.getByLabelText("Order notes"), {
      target: { value: "Soy milk allergy" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send to kitchen/i }))

    await waitFor(() =>
      expect(mocks.createStaffOrder).toHaveBeenCalledWith({
        tableId: null,
        customerName: "Ada",
        notes: "Soy milk allergy",
        items: [{ menu_item_id: "latte", quantity: 1 }],
        paid: false,
      }),
    )
    expect(onOrderCreated).toHaveBeenCalled()
    expect(
      await screen.findByRole("heading", { name: "QT-261119-0001" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/counter order/i)).toBeInTheDocument()
  })

  it("sends the selected table and marks collected payment", async () => {
    mocks.createStaffOrder.mockResolvedValue({
      orderId: "order-1",
      orderNumber: "QT-261119-0002",
      status: "confirmed",
      subtotal: 4.09,
      tax: 0.41,
      total: 4.5,
      currency: "AUD",
      restaurantName: "Demo Cafe",
      tableNumber: "2",
      customerName: "Ada",
      createdAt: "2026-11-19T08:00:00Z",
      paid: true,
    })
    renderWorkspace()

    await addLatte()
    await fillGuestName("Ada")
    fireEvent.change(screen.getByLabelText("Table"), {
      target: { value: "table-2" },
    })
    fireEvent.click(screen.getByLabelText(/payment collected/i))
    fireEvent.click(screen.getByRole("button", { name: /send to kitchen/i }))

    await waitFor(() =>
      expect(mocks.createStaffOrder).toHaveBeenCalledWith({
        tableId: "table-2",
        customerName: "Ada",
        notes: "",
        items: [{ menu_item_id: "latte", quantity: 1 }],
        paid: true,
      }),
    )
  })

  it("requires a guest name and at least one item", async () => {
    renderWorkspace()

    await screen.findByRole("button", { name: /add latte/i })
    fireEvent.click(screen.getByRole("button", { name: /send to kitchen/i }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      /enter a name for the order/i,
    )

    await fillGuestName("Ada")
    fireEvent.click(screen.getByRole("button", { name: /send to kitchen/i }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      /add at least one item/i,
    )
    expect(mocks.createStaffOrder).not.toHaveBeenCalled()
  })
})
