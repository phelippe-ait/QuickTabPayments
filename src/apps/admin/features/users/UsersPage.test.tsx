import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { UsersPage } from "./UsersPage"
import type { StaffVM } from "../../types"

const mocks = vi.hoisted(() => ({
  viewerRole: "owner" as "owner" | "manager" | "kitchen",
  notify: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
  staff: [] as StaffVM[],
  isLoading: false,
  error: null as Error | null,
  setRole: vi.fn(async () => true),
  setActive: vi.fn(async () => true),
  bulkSetActive: vi.fn(async () => true),
  remove: vi.fn(async () => true),
  addByEmail: vi.fn(async () => true),
}))

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  useRestaurant: () => ({
    restaurant: { id: "restaurant-1", name: "Test Café" },
    role: mocks.viewerRole,
  }),
  roleLabels: { owner: "Owner", manager: "Manager", kitchen: "Kitchen" },
}))

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: mocks.confirm }),
}))

vi.mock("../../hooks/useStaff", () => ({
  useStaff: () => ({
    staff: mocks.staff,
    isLoading: mocks.isLoading,
    error: mocks.error,
    refetch: mocks.refetch,
    isMutating: false,
    setRole: mocks.setRole,
    setActive: mocks.setActive,
    bulkSetActive: mocks.bulkSetActive,
    remove: mocks.remove,
    addByEmail: mocks.addByEmail,
  }),
}))

const self: StaffVM = {
  staffId: "staff-1",
  userId: "user-1",
  name: "Rafael Cadena",
  email: "owner@example.com",
  initials: "RC",
  role: "owner",
  isActive: true,
}

const manager: StaffVM = {
  staffId: "staff-2",
  userId: "user-2",
  name: "Maya Johnson",
  email: "maya@example.com",
  initials: "MJ",
  role: "manager",
  isActive: true,
}

describe("UsersPage", () => {
  beforeEach(() => {
    mocks.viewerRole = "owner"
    mocks.staff = [self, manager]
    mocks.isLoading = false
    mocks.error = null
    mocks.remove.mockClear()
    mocks.addByEmail.mockClear()
    mocks.confirm.mockClear()
  })

  it("renders the real directory with roles and emails", () => {
    render(<UsersPage />)

    expect(screen.getByText("Rafael Cadena")).toBeInTheDocument()
    expect(screen.getByText("maya@example.com")).toBeInTheDocument()
    expect(screen.getAllByText("Manager").length).toBeGreaterThan(0)
    expect(screen.getByText("You")).toBeInTheDocument()
  })

  it("locks your own row and leaves other rows editable", () => {
    render(<UsersPage />)

    expect(screen.getByRole("button", { name: /edit rafael cadena/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /remove rafael cadena/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /edit maya johnson/i })).toBeEnabled()
  })

  it("does not let a manager manage the owner row", () => {
    mocks.viewerRole = "manager"
    render(<UsersPage />)

    expect(screen.getByRole("button", { name: /edit rafael cadena/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /remove rafael cadena/i })).toBeDisabled()
  })

  it("removes a member after confirmation", async () => {
    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /remove maya johnson/i }))
    expect(mocks.confirm).toHaveBeenCalledTimes(1)

    const confirmation = mocks.confirm.mock.calls[0][0] as {
      onConfirm: () => void
    }
    confirmation.onConfirm()

    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("staff-2"))
  })

  it("opens the add-by-email dialog without password fields", () => {
    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /add team member/i }))

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.getByText(/must have signed up to quicktab/i)).toBeInTheDocument()
  })

  it("shows a retryable error state", () => {
    mocks.error = new Error("directory unavailable")
    render(<UsersPage />)

    expect(screen.getByText(/couldn't load the team/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })
})
