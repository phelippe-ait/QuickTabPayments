import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminApp from "./AdminDashboard";
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

vi.mock("@shared/lib/supabase", () => ({
  isSupabaseConfigured: true,
  SUPABASE_NOT_CONFIGURED_MESSAGE: "not configured",
  supabase: {},
}));

function renderAdminApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminApp />
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
  });

  it("shows the sign-in screen when signed out", () => {
    renderAdminApp();
    expect(
      screen.getByRole("heading", { name: /manager sign in/i }),
    ).toBeInTheDocument();
  });

  it("blocks signed-in users without a restaurant membership", () => {
    mocks.auth.user = { id: "user-1", email: "staff@example.com" };
    renderAdminApp();
    expect(
      screen.getByRole("heading", { name: /set up your restaurant/i }),
    ).toBeInTheDocument();
  });

  it("renders the workspace for an active staff member", () => {
    mocks.auth.user = { id: "user-1", email: "owner@example.com" };
    mocks.restaurant.membership = { id: "staff-1", role: "owner" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "owner";

    renderAdminApp();
    expect(
      screen.getByRole("heading", { name: /catalog/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Test Café")).toBeInTheDocument();
    expect(screen.getByText("Test Manager")).toBeInTheDocument();
  });

  it("limits kitchen staff to order history", () => {
    mocks.auth.user = { id: "user-2", email: "kitchen@example.com" };
    mocks.restaurant.membership = { id: "staff-2", role: "kitchen" };
    mocks.restaurant.restaurant = { name: "Test Café" };
    mocks.restaurant.role = "kitchen";

    renderAdminApp();
    expect(
      screen.getByRole("heading", { name: /order history/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /catalog/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /users/i }),
    ).not.toBeInTheDocument();
  });
});
