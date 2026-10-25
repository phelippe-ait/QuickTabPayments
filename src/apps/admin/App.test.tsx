import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { adminRoutes } from "../../routes/AppRoutes";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as { id: string; email?: string } | null,
    profile: null as null | {
      first_name: string | null;
      last_name: string | null;
    },
    loading: false,
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => {}),
  },
  restaurant: {
    membership: null as null | { id: string; role: string },
    restaurant: null as null | { name: string },
    role: null as string | null,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  invite: null as null | {
    id: string;
    email: string;
    restaurant_name: string;
    restaurant_slug: string;
    expires_at: string;
  },
}));

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  RestaurantProvider: ({ children }: { children: ReactNode }) => children,
  useRestaurant: () => mocks.restaurant,
  roleLabels: { owner: "Owner", manager: "Manager", kitchen: "Kitchen" },
  getProfileName: () => "Test Manager",
  getInitials: () => "TM",
}));

vi.mock("@shared/data/invites", () => ({
  fetchMyRestaurantInvite: async () => mocks.invite,
  claimRestaurantInvite: vi.fn(async () => ({ id: "restaurant-new" })),
  inviteKeys: {
    my: (userId: string) => ["restaurant-invites", "mine", userId],
  },
}));

vi.mock("@shared/lib/supabase", () => ({
  isSupabaseConfigured: true,
  SUPABASE_NOT_CONFIGURED_MESSAGE: "not configured",
  supabase: {},
}));

function renderAdminApp(initialEntries: string[] = ["/admin"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(adminRoutes, { initialEntries });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Admin app access gate", () => {
  beforeEach(() => {
    mocks.auth.user = null;
    mocks.auth.profile = null;
    mocks.auth.loading = false;
    mocks.restaurant.membership = null;
    mocks.restaurant.restaurant = null;
    mocks.restaurant.role = null;
    mocks.restaurant.isLoading = false;
    mocks.restaurant.error = null;
    mocks.invite = null;
    mocks.auth.signOut.mockClear();
  });

  it("shows the sign-in screen when signed out", async () => {
    renderAdminApp();
    expect(
      await screen.findByRole(
        "heading",
        { name: /manager sign in/i },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toHaveClass(
      "bg-berry-deep",
    );
  });

  it("blocks signed-in users without a restaurant membership", async () => {
    mocks.auth.user = { id: "user-1", email: "staff@example.com" };
    renderAdminApp();
    expect(
      await screen.findByRole("heading", { name: /no restaurant linked/i }),
    ).toBeInTheDocument();
  });

  it("shows prefilled details for a pending invitation", async () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.invite = {
      id: "invite-1",
      email: "owner@example.com",
      restaurant_name: "Harbour Café",
      restaurant_slug: "harbour-cafe",
      expires_at: "2026-12-01T00:00:00Z",
    };

    renderAdminApp();

    expect(
      await screen.findByRole("heading", { name: /you've been invited/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/restaurant name/i)).toHaveValue("Harbour Café");
    expect(screen.getByLabelText(/web address/i)).toHaveValue("harbour-cafe");
  });

  it("redirects owners from /admin to the catalog", async () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.restaurant.membership = { id: "staff-1", role: "owner" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "owner";

    renderAdminApp();
    expect(
      await screen.findByRole("heading", { name: /^catalog$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Test Café")).toBeInTheDocument();
    expect(screen.getByText("Test Manager")).toBeInTheDocument();
  });

  it("redirects kitchen staff from /admin to order history", async () => {
    mocks.auth.user = { id: "user-2", email: "kitchen@example.com" };
    mocks.restaurant.membership = { id: "staff-2", role: "kitchen" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "kitchen";

    renderAdminApp();
    expect(
      await screen.findByRole("heading", { name: /order history/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /catalog/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /users/i }),
    ).not.toBeInTheDocument();
  });

  it("blocks a kitchen deep link to an owner/manager section", async () => {
    mocks.auth.user = { id: "user-2", email: "kitchen@example.com" };
    mocks.restaurant.membership = { id: "staff-2", role: "kitchen" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "kitchen";

    renderAdminApp(["/admin/users"]);
    expect(
      await screen.findByRole("heading", {
        name: /not available for your role/i,
      }),
    ).toBeInTheDocument();
  });

  it("marks the active nav link with aria-current", async () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.restaurant.membership = { id: "staff-1", role: "owner" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "owner";

    renderAdminApp(["/admin/catalog"]);
    const catalogLink = await screen.findByRole("link", { name: /catalog/i });
    expect(catalogLink).toHaveAttribute("aria-current", "page");
  });

  it("asks for confirmation before signing out", async () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.restaurant.membership = { id: "staff-1", role: "owner" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "owner";

    renderAdminApp();
    await screen.findByRole("heading", { name: /^catalog$/i });

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/sign out of quicktab/i),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /^sign out$/i }),
    );
    await waitFor(() => expect(mocks.auth.signOut).toHaveBeenCalled());
  });

  it("renders the settings placeholder for owner/manager", async () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.restaurant.membership = { id: "staff-1", role: "owner" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "owner";

    renderAdminApp(["/admin/settings"]);
    expect(
      await screen.findByRole("heading", { name: /^settings$/i }),
    ).toBeInTheDocument();
  });
});
