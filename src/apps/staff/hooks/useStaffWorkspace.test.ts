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

const tablesService = vi.hoisted(() => ({
  fetchStaffTables: vi.fn(),
  updateStaffTableStatus: vi.fn(),
}))

vi.mock("../services/staffTables", () => ({
  fetchStaffTables: tablesService.fetchStaffTables,
  updateStaffTableStatus: tablesService.updateStaffTableStatus,
}))

beforeEach(() => {
  vi.clearAllMocks()
  tablesService.fetchStaffTables.mockResolvedValue([])
  tablesService.updateStaffTableStatus.mockResolvedValue(undefined)
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

function staffTable(overrides: Record<string, unknown> = {}) {
  return {
    id: "table-1",
    restaurant_id: "restaurant-1",
    table_number: "1",
    location_label: null,
    is_active: true,
    seats: 4,
    status: "available",
    ...overrides,
  }
}

describe("useStaffWorkspace table status", () => {
  it("hydrates each table with its stored operational status", async () => {
    tablesService.fetchStaffTables.mockResolvedValue([
      staffTable({ id: "table-1", status: "needs_cleaning" }),
      staffTable({ id: "table-2", table_number: "2", status: "occupied" }),
    ])

    const { result } = renderHook(() => useStaffWorkspace("restaurant-1"))

    await waitFor(() => expect(result.current.tableList).toHaveLength(2))
    expect(result.current.tableList.map((table) => table.status)).toEqual([
      "needs_cleaning",
      "occupied",
    ])
  })

  it("updates optimistically and keeps the new status once the write succeeds", async () => {
    tablesService.fetchStaffTables.mockResolvedValue([staffTable()])
    let resolveUpdate: (() => void) | undefined
    tablesService.updateStaffTableStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve
        }),
    )

    const { result } = renderHook(() => useStaffWorkspace("restaurant-1"))
    await waitFor(() => expect(result.current.tableList).toHaveLength(1))

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.updateTableStatus("table-1", "occupied")
    })

    expect(result.current.tableList[0].status).toBe("occupied")
    expect(result.current.tableStatusUpdating.has("table-1")).toBe(true)
    expect(tablesService.updateStaffTableStatus).toHaveBeenCalledWith(
      "restaurant-1",
      "table-1",
      "occupied",
    )

    await act(async () => {
      resolveUpdate?.()
      await pending
    })

    expect(result.current.tableList[0].status).toBe("occupied")
    expect(result.current.tableStatusUpdating.has("table-1")).toBe(false)
    expect(result.current.tablesError).toBeNull()
  })

  it("rolls the status back and surfaces the error when the write fails", async () => {
    tablesService.fetchStaffTables.mockResolvedValue([staffTable()])
    tablesService.updateStaffTableStatus.mockRejectedValue(
      new Error("permission denied for table tables"),
    )

    const { result } = renderHook(() => useStaffWorkspace("restaurant-1"))
    await waitFor(() => expect(result.current.tableList).toHaveLength(1))

    await act(async () => {
      await result.current.updateTableStatus("table-1", "needs_cleaning")
    })

    expect(result.current.tableList[0].status).toBe("available")
    expect(result.current.tableStatusUpdating.has("table-1")).toBe(false)
    expect(result.current.tablesError).toBe(
      "permission denied for table tables",
    )
  })
})
