import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { ProfileDialog } from "./ProfileDialog"

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  notify: vi.fn(),
  onClose: vi.fn(),
}))

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({
    profile: {
      first_name: "Maya",
      last_name: "Johnson",
      email: "maya@example.com",
    },
    user: { email: "maya@example.com" },
    updateProfile: mocks.updateProfile,
  }),
}))

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: () => ({ restaurant: { id: "restaurant-1" } }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  )
}

describe("ProfileDialog", () => {
  beforeEach(() => {
    mocks.updateProfile.mockReset()
    mocks.updateProfile.mockResolvedValue({ error: null })
    mocks.notify.mockClear()
    mocks.onClose.mockClear()
  })

  it("shows the current name and email", () => {
    render(<ProfileDialog onClose={mocks.onClose} />, { wrapper })

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Maya")
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Johnson")
    expect(screen.getByLabelText(/email/i)).toHaveValue("maya@example.com")
    expect(screen.getByLabelText(/email/i)).toBeDisabled()
  })

  it("saves trimmed names and closes", async () => {
    render(<ProfileDialog onClose={mocks.onClose} />, { wrapper })

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "  Maya  " },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: " Chen " },
    })
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        firstName: "Maya",
        lastName: "Chen",
      }),
    )
    await waitFor(() => expect(mocks.onClose).toHaveBeenCalled())
    expect(mocks.notify).toHaveBeenCalledWith("Profile updated")
  })

  it("requires at least one name", async () => {
    render(<ProfileDialog onClose={mocks.onClose} />, { wrapper })

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: " " },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: " " },
    })
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }))

    expect(
      screen.getByText(/enter at least a first or last name/i),
    ).toBeInTheDocument()
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it("surfaces a save error and stays open", async () => {
    mocks.updateProfile.mockResolvedValueOnce({
      error: new Error("permission denied"),
    })
    render(<ProfileDialog onClose={mocks.onClose} />, { wrapper })

    fireEvent.click(screen.getByRole("button", { name: /save profile/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "permission denied",
    )
    expect(mocks.onClose).not.toHaveBeenCalled()
  })
})
