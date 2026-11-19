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
  onStatusChange?: (id: string, status: Order["kitchenStatus"]) => void
} = {}) {
  return render(
    <KitchenWorkspace
      orders={overrides.orders ?? [order()]}
      previousOrders={[]}
      onStatusChange={overrides.onStatusChange ?? vi.fn()}
      ordersLoading={false}
      ordersError={null}
      sound={sound}
      unseenOrderIds={overrides.unseenOrderIds ?? new Set<string>()}
      onOrderSeen={overrides.onOrderSeen ?? vi.fn()}
    />,
  )
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
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

    fireEvent.click(screen.getByRole("button", { name: /prepare order qt-1042/i }))

    expect(onOrderSeen).toHaveBeenCalledWith("QT-1042")
    expect(
      screen.getByRole("heading", { name: /set order to preparing/i }),
    ).toBeInTheDocument()
  })

  it("clears the unseen state from the explicit acknowledge button", () => {
    const onOrderSeen = vi.fn()
    const onStatusChange = vi.fn()
    renderKitchen({
      unseenOrderIds: new Set(["QT-1042"]),
      onOrderSeen,
      onStatusChange,
    })

    fireEvent.click(screen.getByRole("button", { name: /acknowledge order qt-1042/i }))

    expect(onOrderSeen).toHaveBeenCalledWith("QT-1042")
    expect(onStatusChange).not.toHaveBeenCalled()
  })
})

describe("KitchenWorkspace board ordering, SLA and actions", () => {
  it("renders active orders oldest-first", () => {
    renderKitchen({
      orders: [
        order({ id: "QT-2000", createdAt: minutesAgo(3) }),
        order({ id: "QT-1000", createdAt: minutesAgo(25) }),
        order({ id: "QT-1500", createdAt: minutesAgo(12) }),
      ],
    })

    const ids = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(ids).toEqual(["QT-1000", "QT-1500", "QT-2000"])
  })

  it("shows elapsed minutes and red SLA styling for a long wait", () => {
    const { container } = renderKitchen({
      orders: [order({ createdAt: minutesAgo(21) })],
    })

    expect(screen.getByText("21m")).toBeInTheDocument()
    const card = container.querySelector("article")
    expect(card?.className).toContain("border-l-danger")
  })

  it("shows green SLA styling inside the first ten minutes", () => {
    const { container } = renderKitchen({
      orders: [order({ createdAt: minutesAgo(4) })],
    })

    expect(screen.getByText("4m")).toBeInTheDocument()
    const card = container.querySelector("article")
    expect(card?.className).toContain("border-l-sage")
  })

  it("bumps to the next legal status after confirmation", () => {
    const onStatusChange = vi.fn()
    renderKitchen({
      orders: [order({ id: "QT-1042", kitchenStatus: "Preparing" })],
      onStatusChange,
    })

    fireEvent.click(screen.getByRole("button", { name: /ready order qt-1042/i }))
    fireEvent.click(screen.getByRole("button", { name: /yes, mark as ready/i }))

    expect(onStatusChange).toHaveBeenCalledWith("QT-1042", "Ready")
  })

  it("does not offer illegal transitions", () => {
    renderKitchen({ orders: [order({ kitchenStatus: "New" })] })

    expect(screen.getByRole("button", { name: /prepare order qt-1042/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /complete order qt-1042/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ready order qt-1042/i })).not.toBeInTheDocument()
  })

  it("renders an allergen warning for menu items that contain allergens", () => {
    renderKitchen({
      orders: [
        order({
          items: [
            {
              name: "Pad thai",
              qty: 1,
              price: 18,
              allergens: ["Peanuts", "Eggs"],
            },
          ],
        }),
      ],
    })

    expect(screen.getByText("Contains Peanuts, Eggs")).toBeInTheDocument()
  })

  it("omits the allergen warning when a menu item has no allergens", () => {
    renderKitchen()

    expect(screen.queryByText(/contains /i)).not.toBeInTheDocument()
  })
})

describe("KitchenWorkspace accessibility", () => {
  it("labels the icon-only sound toggle and exposes its pressed state", () => {
    renderKitchen()

    const toggle = screen.getByRole("button", {
      name: /unmute new order sound/i,
    })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
  })

  it("conveys kitchen status with a text label, not colour alone", () => {
    renderKitchen({ orders: [order({ kitchenStatus: "Preparing" })] })

    expect(screen.getAllByText("Preparing").length).toBeGreaterThan(0)
  })

  it("names each order action so repeated buttons stay distinguishable", () => {
    renderKitchen({
      orders: [
        order({ id: "QT-1042", kitchenStatus: "New" }),
        order({ id: "QT-1043", kitchenStatus: "New" }),
      ],
      unseenOrderIds: new Set(["QT-1042", "QT-1043"]),
    })

    expect(
      screen.getByRole("button", { name: /acknowledge order qt-1042/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /acknowledge order qt-1043/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /prepare order qt-1043/i }),
    ).toBeInTheDocument()
  })
})
