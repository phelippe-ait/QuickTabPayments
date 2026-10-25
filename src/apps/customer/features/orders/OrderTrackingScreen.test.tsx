import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { OrderTrackingScreen } from "./OrderTrackingScreen"

const mocks = vi.hoisted(() => ({ fetchOrderTracking: vi.fn() }))

vi.mock("../../data/tracking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/tracking")>()
  return { ...actual, fetchOrderTracking: mocks.fetchOrderTracking }
})

const trackedOrder = {
  orderId: "order-1",
  orderNumber: "QT-261025-0001",
  status: "preparing" as const,
  subtotal: 4.27,
  tax: 0.43,
  total: 4.7,
  currency: "AUD",
  createdAt: "2026-10-25T02:00:00Z",
  tableNumber: "T05",
  restaurantName: "QuickTab Demo Cafe",
  items: [{ name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 }],
}

function renderTracking(url = "/order/QT-261025-0001?token=token-1") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/order/:orderNumber" element={<OrderTrackingScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("OrderTrackingScreen", () => {
  beforeEach(() => {
    mocks.fetchOrderTracking.mockReset()
  })

  it("renders the status timeline and item summary for a valid token", async () => {
    mocks.fetchOrderTracking.mockResolvedValue(trackedOrder)
    renderTracking()

    expect(await screen.findByText("QT-261025-0001")).toBeInTheDocument()
    expect(screen.getAllByText("Preparing").length).toBeGreaterThan(0)
    expect(screen.getByText("Table T05")).toBeInTheDocument()
    expect(screen.getByText(/Flat White/)).toBeInTheDocument()
    expect(mocks.fetchOrderTracking).toHaveBeenCalledWith("token-1")
  })

  it("shows a safe not-found screen for a bad token", async () => {
    mocks.fetchOrderTracking.mockResolvedValue(null)
    renderTracking("/order/QT-1?token=wrong")

    expect(await screen.findByText("Order not found")).toBeInTheDocument()
    expect(screen.queryByText("Flat White")).not.toBeInTheDocument()
  })

  it("shows an error state and allows a retry", async () => {
    mocks.fetchOrderTracking.mockRejectedValue(new Error("Network down"))
    renderTracking()

    expect(
      await screen.findByText("We couldn't load this order"),
    ).toBeInTheDocument()
    expect(screen.getByText("Network down")).toBeInTheDocument()
  })

  it("polls while the order is in progress", async () => {
    vi.useFakeTimers()
    try {
      mocks.fetchOrderTracking.mockResolvedValue(trackedOrder)
      renderTracking()
      await act(async () => {})

      expect(mocks.fetchOrderTracking).toHaveBeenCalledTimes(1)
      await act(async () => {
        vi.advanceTimersByTime(7_000)
      })
      expect(mocks.fetchOrderTracking).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("stops polling once the order is terminal", async () => {
    vi.useFakeTimers()
    try {
      mocks.fetchOrderTracking.mockResolvedValue({
        ...trackedOrder,
        status: "completed" as const,
      })
      renderTracking()
      await act(async () => {})

      expect(mocks.fetchOrderTracking).toHaveBeenCalledTimes(1)
      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })
      expect(mocks.fetchOrderTracking).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
