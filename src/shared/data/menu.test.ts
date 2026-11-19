import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  deleteMenuItem,
  deleteMenuItems,
  reorderMenuItems,
  setMenuItemsAvailability,
  updateCategories,
  updateMenuItems,
} from "./menu"

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

describe("menu zero-row writes", () => {
  beforeEach(() => mocks.reset())

  it("rejects deleteMenuItem when the row is not returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(deleteMenuItem("item-1")).rejects.toThrow(/was not deleted/i)
    expect(mocks.calls).toContainEqual({
      table: "menu_items",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves deleteMenuItem when the row is returned", async () => {
    mocks.enqueue({ data: [{ id: "item-1" }], error: null })

    await expect(deleteMenuItem("item-1")).resolves.toBeUndefined()
  })

  it("rejects deleteMenuItems when fewer rows than ids are returned", async () => {
    mocks.enqueue({ data: [{ id: "item-1" }], error: null })

    await expect(
      deleteMenuItems(["item-1", "item-2"]),
    ).rejects.toThrow(/Some menu items were not deleted/i)
  })

  it("resolves deleteMenuItems when every row is returned", async () => {
    mocks.enqueue({
      data: [{ id: "item-1" }, { id: "item-2" }],
      error: null,
    })

    await expect(
      deleteMenuItems(["item-1", "item-2"]),
    ).resolves.toBeUndefined()
  })

  it("rejects setMenuItemsAvailability when fewer rows than ids are returned", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(
      setMenuItemsAvailability(["item-1"], false),
    ).rejects.toThrow(/availability was not updated/i)
    expect(mocks.calls).toContainEqual({
      table: "menu_items",
      method: "update",
      args: [{ is_available: false }],
    })
    expect(mocks.calls).toContainEqual({
      table: "menu_items",
      method: "select",
      args: ["id"],
    })
  })

  it("resolves setMenuItemsAvailability when every row is returned", async () => {
    mocks.enqueue({ data: [{ id: "item-1" }], error: null })

    await expect(
      setMenuItemsAvailability(["item-1"], false),
    ).resolves.toBeUndefined()
  })

  it("rejects updateMenuItems when fewer rows than ids are returned", async () => {
    mocks.enqueue({ data: [{ id: "item-1" }], error: null })

    await expect(
      updateMenuItems(["item-1", "item-2"], { is_available: true }),
    ).rejects.toThrow(/Some menu items were not updated/i)
  })

  it("resolves updateMenuItems when every row is returned", async () => {
    mocks.enqueue({
      data: [{ id: "item-1" }, { id: "item-2" }],
      error: null,
    })

    await expect(
      updateMenuItems(["item-1", "item-2"], { category_id: "category-2" }),
    ).resolves.toBeUndefined()
  })

  it("rejects reorderMenuItems when a row is filtered out", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(
      reorderMenuItems([{ id: "item-1", display_order: 0 }]),
    ).rejects.toThrow(/order was not saved/i)
  })

  it("resolves reorderMenuItems when every row is returned", async () => {
    mocks.enqueue({ data: [{ id: "item-1" }], error: null })
    mocks.enqueue({ data: [{ id: "item-2" }], error: null })

    await expect(
      reorderMenuItems([
        { id: "item-1", display_order: 0 },
        { id: "item-2", display_order: 1 },
      ]),
    ).resolves.toBeUndefined()
  })

  it("rejects updateCategories when a row is filtered out", async () => {
    mocks.enqueue({ data: [], error: null })

    await expect(
      updateCategories([{ id: "category-1", display_order: 0 }]),
    ).rejects.toThrow(/Category order was not saved/i)
  })

  it("resolves updateCategories when every row is returned", async () => {
    mocks.enqueue({ data: [{ id: "category-1" }], error: null })

    await expect(
      updateCategories([{ id: "category-1", display_order: 0 }]),
    ).resolves.toBeUndefined()
  })
})
