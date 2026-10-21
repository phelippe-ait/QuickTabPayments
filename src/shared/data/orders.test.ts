import { describe, expect, it } from "vitest"
import { reduceOpenOrdersByTable, sanitiseOrderSearch } from "./orders"

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
    })
    expect(byTable["table-2"]?.orderNumber).toBe("1003")
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
