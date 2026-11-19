import { beforeEach, describe, expect, it, vi } from "vitest"
import { naturalSortTableNumber, updateStaffTableStatus } from "./staffTables"

const mocks = vi.hoisted(() => {
  const builder = {
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  }
  builder.update.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.select.mockResolvedValue({ data: [{ id: "table-1" }], error: null })

  return {
    builder,
    from: vi.fn(() => builder),
  }
})

vi.mock("../../../shared/lib/supabase", () => ({
  supabase: { from: mocks.from },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.builder.select.mockResolvedValue({
    data: [{ id: "table-1" }],
    error: null,
  })
})

describe("naturalSortTableNumber", () => {
  it("sorts numeric table labels naturally", () => {
    const sorted = ["10", "2", "1", "11"].sort(naturalSortTableNumber);
    expect(sorted).toEqual(["1", "2", "10", "11"]);
  });

  it("handles letter suffixes", () => {
    const sorted = ["A2", "A10", "A1"].sort(naturalSortTableNumber);
    expect(sorted).toEqual(["A1", "A2", "A10"]);
  });
});

describe("updateStaffTableStatus", () => {
  it("updates the table status scoped by restaurant_id", async () => {
    await updateStaffTableStatus("restaurant-1", "table-1", "needs_cleaning")

    expect(mocks.from).toHaveBeenCalledWith("tables")
    expect(mocks.builder.update).toHaveBeenCalledWith({
      status: "needs_cleaning",
    })
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(
      1,
      "restaurant_id",
      "restaurant-1",
    )
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(2, "id", "table-1")
  })

  it("throws the database error when the write is rejected", async () => {
    mocks.builder.select.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table tables" },
    })

    await expect(
      updateStaffTableStatus("restaurant-1", "table-1", "occupied"),
    ).rejects.toThrow("permission denied for table tables")
  })

  it("throws when RLS updates no row", async () => {
    mocks.builder.select.mockResolvedValueOnce({ data: [], error: null })

    await expect(
      updateStaffTableStatus("restaurant-1", "table-1", "available"),
    ).rejects.toThrow("Table status was not updated")
  })
})
