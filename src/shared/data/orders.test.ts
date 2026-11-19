import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  countOrdersForTables,
  fetchOpenOrdersByTable,
  reduceOpenOrdersByTable,
  sanitiseOrderSearch,
} from "./orders"

type Response = {
  data: unknown
  error: { message: string } | null
}

const mocks = vi.hoisted(() => {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  let queue: Response[] = []

  function builder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {}
    for (const method of ["select", "in", "eq", "order"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.then = (resolve: (value: Response) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(resolve)
    return chain
  }

  return {
    calls,
    reset: () => {
      calls.length = 0
      queue = []
    },
    enqueue: (...responses: Response[]) => {
      queue.push(...responses)
    },
    client: { from: (table: string) => builder(table) },
  }
})

vi.mock("./client", () => ({
  requireSupabase: () => mocks.client,
}))

describe("reduceOpenOrdersByTable", () => {
  it("keeps the latest open order per table regardless of row order", () => {
    const byTable = reduceOpenOrdersByTable([
      {
        id: "order-old",
        table_id: "table-1",
        order_number: "1001",
        status: "pending",
        created_at: "2026-10-21T08:00:00Z",
      },
      {
        id: "order-new",
        table_id: "table-1",
        order_number: "1002",
        status: "preparing",
        created_at: "2026-10-21T09:00:00Z",
      },
      {
        id: "order-2",
        table_id: "table-2",
        order_number: "1003",
        status: "ready",
        created_at: "2026-10-21T08:30:00Z",
      },
    ])

    expect(byTable["table-1"]).toEqual({
      orderId: "order-new",
      orderNumber: "1002",
      status: "preparing",
      createdAt: "2026-10-21T09:00:00Z",
      customerName: null,
      total: 0,
      items: 0,
    })
    expect(byTable["table-2"]?.orderNumber).toBe("1003")
  })

  it("carries guest name, total and item quantity for occupancy", () => {
    const byTable = reduceOpenOrdersByTable([
      {
        id: "order-1",
        table_id: "table-1",
        order_number: "1001",
        status: "preparing",
        created_at: "2026-10-21T08:00:00Z",
        customer_name_snapshot: "Olivia",
        total: 24.5,
        order_items: [{ quantity: 2 }, { quantity: 1 }],
      },
      {
        id: "order-2",
        table_id: "table-2",
        order_number: "1002",
        status: "ready",
        created_at: "2026-10-21T08:30:00Z",
        customer_name_snapshot: null,
        total: null,
        order_items: null,
      },
    ])

    expect(byTable["table-1"]).toMatchObject({
      customerName: "Olivia",
      total: 24.5,
      items: 3,
    })
    expect(byTable["table-2"]).toMatchObject({
      customerName: null,
      total: 0,
      items: 0,
    })
  })

  it("strips PostgREST syntax characters from search terms", () => {
    expect(sanitiseOrderSearch("1048, Olivia ()")).toBe("1048  Olivia")
  })

  it("ignores orders without a table", () => {
    const byTable = reduceOpenOrdersByTable([
      {
        id: "order-1",
        table_id: null,
        order_number: "1001",
        status: "pending",
        created_at: "2026-10-21T08:00:00Z",
      },
    ])

    expect(byTable).toEqual({})
  })
})

describe("fetchOpenOrdersByTable", () => {
  beforeEach(() => mocks.reset())

  it("only counts paid/confirmed orders, never pending checkouts", async () => {
    mocks.enqueue({ data: [], error: null })

    await fetchOpenOrdersByTable("restaurant-1")

    expect(mocks.calls).toContainEqual({
      table: "orders",
      method: "in",
      args: ["status", ["confirmed", "preparing", "ready"]],
    })
  })
})

describe("countOrdersForTables", () => {
  beforeEach(() => mocks.reset())

  it("counts orders per table and ignores rows without a table", async () => {
    mocks.enqueue({
      data: [
        { table_id: "table-1" },
        { table_id: "table-1" },
        { table_id: "table-2" },
        { table_id: null },
      ],
      error: null,
    })

    await expect(countOrdersForTables(["table-1", "table-2"])).resolves.toEqual({
      "table-1": 2,
      "table-2": 1,
    })
    expect(mocks.calls).toEqual([
      { table: "orders", method: "select", args: ["table_id"] },
      { table: "orders", method: "in", args: ["table_id", ["table-1", "table-2"]] },
    ])
  })

  it("skips the query when no tables are supplied", async () => {
    await expect(countOrdersForTables([])).resolves.toEqual({})
    expect(mocks.calls).toEqual([])
  })

  it("rejects when the query fails", async () => {
    mocks.enqueue({ data: null, error: { message: "orders unavailable" } })

    await expect(countOrdersForTables(["table-1"])).rejects.toThrow("orders unavailable")
  })
})
