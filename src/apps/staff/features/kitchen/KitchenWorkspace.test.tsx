import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { KitchenWorkspace } from "./KitchenWorkspace"
import type { OrderSoundControls } from "../../hooks/useOrderSound"
import type { Order } from "../../types"

const sound: OrderSoundControls = {
  enabled: false,
  unlocked: false,
  toggle: vi.fn(),
  prime: vi.fn(),
  play: vi.fn(),
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "QT-1042",
    table: "Table 4",
    guest: "Guest",
    time: "12:30",
    total: 24,
    status: "In progress",
    kitchenStatus: "New",
    server: "—",
    guests: 1,
    payment: "Paid",
    items: [{ name: "Flat white", qty: 1, price: 4.5 }],
    ...overrides,
  }
}

function renderKitchen(overrides: {
  orders?: Order[]
  unseenOrderIds?: ReadonlySet<string>
  onOrderSeen?: (orderId: string) => void
} = {}) {
  return render(
    <KitchenWorkspace
      orders={overrides.orders ?? [order()]}
      previousOrders={[]}
      onStatusChange={vi.fn()}
      ordersLoading={false}
      ordersError={null}
      sound={sound}
      unseenOrderIds={overrides.unseenOrderIds ?? new Set<string>()}
      onOrderSeen={overrides.onOrderSeen ?? vi.fn()}
    />,
  )
}

describe("KitchenWorkspace new-order indicator", () => {
  it("pulses a New badge and highlights a card for an unseen order", () => {
    const { container } = renderKitchen({
      unseenOrderIds: new Set(["QT-1042"]),
    })

    const badge = screen.getByLabelText("New order")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("animate-pulse")
    expect(badge).toHaveClass("motion-reduce:animate-none")

    const card = container.querySelector("article")
    expect(card?.className).toContain("ring-2")
    expect(card?.className).toContain("border-amber/60")
  })

  it("omits the badge and highlight once the order is seen", () => {
    const { container } = renderKitchen()

    expect(screen.queryByLabelText("New order")).not.toBeInTheDocument()
    const card = container.querySelector("article")
    expect(card?.className).not.toContain("ring-2")
    expect(card?.className).toContain("border-line")
  })

  it("shows the unseen count in the header and hides it at zero", () => {
    const { unmount } = renderKitchen({
      orders: [order(), order({ id: "QT-1043" })],
      unseenOrderIds: new Set(["QT-1042", "QT-1043"]),
    })

    expect(screen.getByLabelText("2 new orders")).toHaveTextContent("2 new")
    unmount()

    renderKitchen()
    expect(screen.queryByLabelText("1 new order")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("2 new orders")).not.toBeInTheDocument()
  })

  it("acknowledges an order when staff open its action confirmation", () => {
    const onOrderSeen = vi.fn()
    renderKitchen({
      unseenOrderIds: new Set(["QT-1042"]),
      onOrderSeen,
    })

    fireEvent.click(screen.getByRole("button", { name: "Prepare" }))

    expect(onOrderSeen).toHaveBeenCalledWith("QT-1042")
    expect(
      screen.getByRole("heading", { name: /set order to preparing/i }),
    ).toBeInTheDocument()
  })
})
