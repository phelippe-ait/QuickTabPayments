import { beforeEach, describe, expect, it, vi } from "vitest"
import { removeStaffMembership, updateStaffMembership } from "./restaurants"

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

describe("staff membership zero-row writes", () => {
  beforeEach(() => mocks.reset())

  it("rejects updateStaffMembership when the row is not returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(
      updateStaffMembership("staff-1", { role: "manager" }),
    ).rejects.toThrow(/was not updated/i)
    expect(mocks.calls).toContainEqual({
      table: "restaurant_staff",
      method: "update",
      args: [{ role: "manager" }],
    })
    expect(mocks.calls).toContainEqual({
      table: "restaurant_staff",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves updateStaffMembership when the row is returned", async () => {
    mocks.enqueue({ data: [{ id: "staff-1" }], error: null })

    await expect(
      updateStaffMembership("staff-1", { role: "manager" }),
    ).resolves.toBeUndefined()
  })

  it("rejects removeStaffMembership when the row is not returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(removeStaffMembership("staff-1")).rejects.toThrow(
      /was not removed/i,
    )
    expect(mocks.calls).toContainEqual({
      table: "restaurant_staff",
      method: "delete",
      args: [],
    })
    expect(mocks.calls).toContainEqual({
      table: "restaurant_staff",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves removeStaffMembership when the row is returned", async () => {
    mocks.enqueue({ data: [{ id: "staff-1" }], error: null })

    await expect(removeStaffMembership("staff-1")).resolves.toBeUndefined()
  })
})
