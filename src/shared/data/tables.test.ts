import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteTable, deleteTables, setTablesActive } from "./tables"

type QueryCall = { table: string; method: string; args: unknown[] }
type Response = {
  data: unknown
  error: { message: string; code?: string } | null
}

const mocks = vi.hoisted(() => {
  const calls: QueryCall[] = []
  let queue: Response[] = []

  function builder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {}
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "in",
      "order",
      "single",
    ]) {
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

describe("tables zero-row writes", () => {
  beforeEach(() => mocks.reset())

  it("rejects deleteTable when the row is not returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(deleteTable("table-1")).rejects.toThrow(/was not deleted/i)
    expect(mocks.calls).toContainEqual({
      table: "tables",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves deleteTable when the row is returned", async () => {
    mocks.enqueue({ data: [{ id: "table-1" }], error: null })

    await expect(deleteTable("table-1")).resolves.toBeUndefined()
  })

  it("rejects deleteTables when fewer rows than ids are returned", async () => {
    mocks.enqueue({ data: [{ id: "table-1" }], error: null })

    await expect(
      deleteTables(["table-1", "table-2"]),
    ).rejects.toThrow(/Some tables were not deleted/i)
    expect(mocks.calls).toContainEqual({
      table: "tables",
      method: "in",
      args: ["id", ["table-1", "table-2"]],
    })
    expect(mocks.calls).toContainEqual({
      table: "tables",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves deleteTables when every row is returned", async () => {
    mocks.enqueue({
      data: [{ id: "table-1" }, { id: "table-2" }],
      error: null,
    })

    await expect(
      deleteTables(["table-1", "table-2"]),
    ).resolves.toBeUndefined()
  })

  it("rejects setTablesActive when fewer rows than ids are returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(
      setTablesActive(["table-1", "table-2"], false),
    ).rejects.toThrow(/was not updated/i)
    expect(mocks.calls).toContainEqual({
      table: "tables",
      method: "update",
      args: [{ is_active: false }],
    })
    expect(mocks.calls).toContainEqual({
      table: "tables",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves setTablesActive when every row is returned", async () => {
    mocks.enqueue({
      data: [{ id: "table-1" }, { id: "table-2" }],
      error: null,
    })

    await expect(
      setTablesActive(["table-1", "table-2"], true),
    ).resolves.toBeUndefined()
  })
})
