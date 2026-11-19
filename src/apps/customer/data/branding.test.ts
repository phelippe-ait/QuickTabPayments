import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchRestaurantBranding } from "./branding"

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  from: vi.fn(),
}))

vi.mock("@shared/data/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => mocks.maybeSingle(),
  }
  return {
    requireSupabase: () => ({
      from: (table: string) => {
        mocks.from(table)
        return chain
      },
    }),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("fetchRestaurantBranding", () => {
  it("maps the stored logo and cover URLs", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        logo_url: "https://cdn.test/logo.webp",
        cover_image_url: "https://cdn.test/cover.webp",
      },
      error: null,
    })

    await expect(fetchRestaurantBranding("restaurant-1")).resolves.toEqual({
      logoUrl: "https://cdn.test/logo.webp",
      coverUrl: "https://cdn.test/cover.webp",
    })
    expect(mocks.from).toHaveBeenCalledWith("restaurants")
  })

  it("returns nulls when the restaurant has no branding", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { logo_url: null, cover_image_url: null },
      error: null,
    })

    await expect(fetchRestaurantBranding("restaurant-1")).resolves.toEqual({
      logoUrl: null,
      coverUrl: null,
    })
  })

  it("returns nulls when the row is missing", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(fetchRestaurantBranding("restaurant-1")).resolves.toEqual({
      logoUrl: null,
      coverUrl: null,
    })
  })

  it("surfaces a read error", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    })

    await expect(fetchRestaurantBranding("restaurant-1")).rejects.toThrow(
      "permission denied",
    )
  })
})
