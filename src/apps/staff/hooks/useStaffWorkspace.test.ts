import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useStaffWorkspace } from "./useStaffWorkspace"
import { fetchStaffOrders } from "../services/staffOrders"

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockResolvedValue({ data: [], error: null })

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)

  return {
    query,
    from: vi.fn(() => query),
    channel,
    channelFactory: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  }
})

vi.mock("@shared/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channelFactory,
    removeChannel: mocks.removeChannel,
  },
}))

vi.mock("../services/staffOrders", () => ({
  fetchStaffOrders: vi.fn().mockResolvedValue([]),
  mapStaffOrder: vi.fn(),
  updateStaffOrderStatus: vi.fn(),
  canKitchenTransition: vi.fn(() => true),
}))

vi.mock("../services/staffTables", () => ({
  fetchStaffTables: vi.fn().mockResolvedValue([]),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useStaffWorkspace realtime scoping", () => {
  it("subscribes to the orders table filtered by restaurant_id (C7)", async () => {
    renderHook(() => useStaffWorkspace("restaurant-1"))

    await waitFor(() => {
      expect(mocks.channelFactory).toHaveBeenCalledWith(
        "staff-order-history-restaurant-1",
      )
    })

    expect(mocks.channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "*",
        schema: "public",
        table: "orders",
        filter: "restaurant_id=eq.restaurant-1",
      }),
      expect.any(Function),
    )
  })

  it("does not open a realtime channel without a restaurant", () => {
    renderHook(() => useStaffWorkspace(null))

    expect(mocks.channelFactory).not.toHaveBeenCalled()
  })

  it("re-fetches the board when the channel reconnects (C6)", async () => {
    const fetchOrders = vi.mocked(fetchStaffOrders)

    renderHook(() => useStaffWorkspace("restaurant-1"))

    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(1))

    const onStatus = mocks.channel.subscribe.mock.calls[0][0] as (
      status: string,
    ) => void

    act(() => onStatus("SUBSCRIBED"))
    act(() => onStatus("CHANNEL_ERROR"))
    act(() => onStatus("SUBSCRIBED"))

    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
  })
})
