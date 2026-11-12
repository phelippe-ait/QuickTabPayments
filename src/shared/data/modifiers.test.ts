import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createModifier,
  createModifierGroup,
  deleteModifierGroup,
  fetchModifierCatalog,
  linkModifierGroup,
  reorderModifiers,
  unlinkModifierGroup,
} from "./modifiers"

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

const groupRow = {
  id: "group-1",
  restaurant_id: "restaurant-1",
  name: "Size",
  selection_type: "single",
  min_selections: 0,
  max_selections: 1,
  is_required: false,
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
}

const modifierRow = {
  id: "modifier-1",
  modifier_group_id: "group-1",
  name: "Large",
  price_adjustment: 1.5,
  is_available: true,
  display_order: 1,
}

describe("modifiers data layer", () => {
  beforeEach(() => {
    mocks.reset()
  })

  it("loads groups, options and links scoped to the restaurant", async () => {
    mocks.enqueue(
      { data: [groupRow], error: null },
      { data: [modifierRow], error: null },
      {
        data: [
          {
            menu_item_id: "item-1",
            modifier_group_id: "group-1",
            display_order: 0,
          },
        ],
        error: null,
      },
    )

    const catalog = await fetchModifierCatalog("restaurant-1")

    expect(catalog.groups).toHaveLength(1)
    expect(catalog.groups[0].modifiers).toEqual([modifierRow])
    expect(catalog.links[0].modifier_group_id).toBe("group-1")
    expect(mocks.calls).toContainEqual({
      table: "modifier_groups",
      method: "eq",
      args: ["restaurant_id", "restaurant-1"],
    })
    expect(mocks.calls).toContainEqual({
      table: "modifiers",
      method: "in",
      args: ["modifier_group_id", ["group-1"]],
    })
    expect(mocks.calls).toContainEqual({
      table: "menu_item_modifier_groups",
      method: "in",
      args: ["modifier_group_id", ["group-1"]],
    })
  })

  it("skips option and link queries when the restaurant has no groups", async () => {
    mocks.enqueue({ data: [], error: null })

    const catalog = await fetchModifierCatalog("restaurant-1")

    expect(catalog).toEqual({ groups: [], links: [] })
    expect(
      mocks.calls.some((call) => call.table === "modifiers"),
    ).toBe(false)
  })

  it("creates a group with the restaurant scope", async () => {
    mocks.enqueue({ data: groupRow, error: null })

    await createModifierGroup({
      restaurant_id: "restaurant-1",
      name: "Size",
      selection_type: "single",
      min_selections: 0,
      max_selections: 1,
      is_required: false,
      display_order: 0,
    })

    expect(mocks.calls).toContainEqual({
      table: "modifier_groups",
      method: "insert",
      args: [
        {
          restaurant_id: "restaurant-1",
          name: "Size",
          selection_type: "single",
          min_selections: 0,
          max_selections: 1,
          is_required: false,
          display_order: 0,
        },
      ],
    })
  })

  it("adds an option to a group", async () => {
    mocks.enqueue({ data: modifierRow, error: null })

    await createModifier({
      modifier_group_id: "group-1",
      name: "Large",
      price_adjustment: 1.5,
      is_available: true,
      display_order: 1,
    })

    expect(mocks.calls).toContainEqual({
      table: "modifiers",
      method: "insert",
      args: [
        {
          modifier_group_id: "group-1",
          name: "Large",
          price_adjustment: 1.5,
          is_available: true,
          display_order: 1,
        },
      ],
    })
  })

  it("links and unlinks a group on a menu item", async () => {
    mocks.enqueue({ data: null, error: null })

    await linkModifierGroup("item-1", "group-1", 2)

    expect(mocks.calls).toContainEqual({
      table: "menu_item_modifier_groups",
      method: "insert",
      args: [
        {
          menu_item_id: "item-1",
          modifier_group_id: "group-1",
          display_order: 2,
        },
      ],
    })

    mocks.reset()
    mocks.enqueue({ data: null, error: null })

    await unlinkModifierGroup("item-1", "group-1")

    expect(mocks.calls).toContainEqual({
      table: "menu_item_modifier_groups",
      method: "eq",
      args: ["menu_item_id", "item-1"],
    })
    expect(mocks.calls).toContainEqual({
      table: "menu_item_modifier_groups",
      method: "eq",
      args: ["modifier_group_id", "group-1"],
    })
  })

  it("deletes a group by id", async () => {
    mocks.enqueue({ data: null, error: null })

    await deleteModifierGroup("group-1")

    expect(mocks.calls).toContainEqual({
      table: "modifier_groups",
      method: "delete",
      args: [],
    })
    expect(mocks.calls).toContainEqual({
      table: "modifier_groups",
      method: "eq",
      args: ["id", "group-1"],
    })
  })

  it("persists an explicit option order", async () => {
    mocks.enqueue({ data: null, error: null })
    mocks.enqueue({ data: null, error: null })

    await reorderModifiers([
      { id: "modifier-1", display_order: 0 },
      { id: "modifier-2", display_order: 1 },
    ])

    expect(mocks.calls).toContainEqual({
      table: "modifiers",
      method: "update",
      args: [{ display_order: 0 }],
    })
    expect(mocks.calls).toContainEqual({
      table: "modifiers",
      method: "update",
      args: [{ display_order: 1 }],
    })
  })

  it("surfaces supabase errors", async () => {
    mocks.enqueue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    })

    await expect(deleteModifierGroup("group-1")).rejects.toThrow(
      "permission denied",
    )
  })
})
