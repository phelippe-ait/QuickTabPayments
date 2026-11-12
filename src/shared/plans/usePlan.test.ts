import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { usePlan } from "./usePlan"

const mocks = vi.hoisted(() => ({
  useRestaurant: vi.fn(),
}))

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: mocks.useRestaurant,
}))

describe("usePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reads the restaurant's plan through", () => {
    mocks.useRestaurant.mockReturnValue({
      restaurant: { plan: "premium" },
    })

    const { result } = renderHook(() => usePlan())

    expect(result.current.plan).toBe("premium")
    expect(result.current.has("reports")).toBe(true)
    expect(result.current.has("multi_location")).toBe(true)
    expect(result.current.has("staff_performance")).toBe(true)
  })

  it("uses the matrix for the current plan", () => {
    mocks.useRestaurant.mockReturnValue({
      restaurant: { plan: "standard" },
    })

    const { result } = renderHook(() => usePlan())

    expect(result.current.has("reports")).toBe(true)
    expect(result.current.has("csv_export")).toBe(true)
    expect(result.current.has("promo_codes")).toBe(true)
    expect(result.current.has("multi_location")).toBe(false)
    expect(result.current.has("staff_performance")).toBe(false)
  })

  it("defaults to basic while the restaurant is loading", () => {
    mocks.useRestaurant.mockReturnValue({ restaurant: null })

    const { result } = renderHook(() => usePlan())

    expect(result.current.plan).toBe("basic")
    expect(result.current.has("reports")).toBe(false)
    expect(result.current.has("csv_export")).toBe(false)
    expect(result.current.has("multi_location")).toBe(false)
  })
})
