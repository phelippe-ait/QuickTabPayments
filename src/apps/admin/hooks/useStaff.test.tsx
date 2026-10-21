import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useStaff } from "./useStaff"

const mocks = vi.hoisted(() => ({
  fetchStaffDirectory: vi.fn(),
  updateStaffMembership: vi.fn(),
  removeStaffMembership: vi.fn(),
  addStaffByEmail: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
}))

vi.mock("@shared/data/restaurants", () => ({
  restaurantKeys: {
    staff: (restaurantId: string) => ["restaurants", restaurantId, "staff"],
  },
  fetchStaffDirectory: mocks.fetchStaffDirectory,
  updateStaffMembership: mocks.updateStaffMembership,
  removeStaffMembership: mocks.removeStaffMembership,
  addStaffByEmail: mocks.addStaffByEmail,
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchStaffDirectory.mockResolvedValue([
      {
        staff_id: "staff-1",
        user_id: "user-1",
        email: "maya@example.com",
        first_name: "Maya",
        last_name: "Johnson",
        role: "manager",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ])
    mocks.updateStaffMembership.mockResolvedValue(undefined)
    mocks.removeStaffMembership.mockResolvedValue(undefined)
    mocks.addStaffByEmail.mockResolvedValue("staff-2")
  })

  it("maps the directory and updates a role", async () => {
    const { result } = renderHook(
      () =>
        useStaff("restaurant-1", {
          onSuccess: mocks.onSuccess,
          onError: mocks.onError,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.staff).toHaveLength(1))
    expect(result.current.staff[0].name).toBe("Maya Johnson")

    let ok = false
    await act(async () => {
      ok = await result.current.setRole("staff-1", "kitchen")
    })

    expect(ok).toBe(true)
    expect(mocks.updateStaffMembership).toHaveBeenCalledWith("staff-1", {
      role: "kitchen",
    })
    expect(mocks.onSuccess).toHaveBeenCalledWith("Role updated")
  })

  it("adds an existing account by email", async () => {
    const { result } = renderHook(() => useStaff("restaurant-1"), { wrapper })
    await waitFor(() => expect(result.current.staff).toHaveLength(1))

    await act(async () => {
      await result.current.addByEmail("new@example.com", "manager")
    })

    expect(mocks.addStaffByEmail).toHaveBeenCalledWith(
      "restaurant-1",
      "new@example.com",
      "manager",
    )
  })

  it("reports server errors and returns false", async () => {
    mocks.updateStaffMembership.mockRejectedValueOnce(
      new Error("Only the restaurant owner can change an owner row"),
    )
    const { result } = renderHook(
      () =>
        useStaff("restaurant-1", { onError: mocks.onError }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.staff).toHaveLength(1))

    let ok = true
    await act(async () => {
      ok = await result.current.setRole("staff-1", "owner")
    })

    expect(ok).toBe(false)
    expect(mocks.onError).toHaveBeenCalledWith(
      "Only the restaurant owner can change an owner row",
    )
  })
})
