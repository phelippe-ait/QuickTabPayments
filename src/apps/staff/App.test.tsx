import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import StaffApp from "./StaffDashboard";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; user_metadata?: object },
  membership: null as null | { restaurantId: string; role: string },
  role: null as null | "owner" | "manager" | "kitchen",
}));

vi.mock("@shared/lib/supabase", () => ({
  isSupabaseConfigured: true,
  SUPABASE_NOT_CONFIGURED_MESSAGE: "",
  supabase: null,
}));

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  RestaurantProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: () => ({
    membership: state.membership,
    restaurant: state.membership
      ? { id: "r1", name: "QuickTab Demo Cafe", currency: "AUD" }
      : null,
    role: state.role,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({
    user: state.user,
    loading: false,
    profile: null,
    session: null,
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    updateProfile: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("./hooks/useStaffWorkspace", () => ({
  useStaffWorkspace: () => ({
    tableList: [],
    tablesLoading: false,
    tablesError: null,
    orders: [],
    ordersLoading: false,
    ordersError: null,
    historyOrders: [],
    historyLoading: false,
    historyError: null,
    reservations: [],
    activeKitchenOrders: [],
    previousKitchenOrders: [],
    updateTable: vi.fn(),
    createReservation: vi.fn(),
    cancelReservation: vi.fn(),
    updateKitchenStatus: vi.fn(),
  }),
}));

describe("Staff app auth gate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 25, 19, 0, 0));
    state.user = null;
    state.membership = null;
    state.role = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the staff sign-in screen when signed out", () => {
    render(<StaffApp />);
    expect(
      screen.getByRole("heading", { name: /staff sign in/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/good evening/i)).not.toBeInTheDocument();
  });

  it("shows no-access for a signed-in non-staff account", () => {
    state.user = { id: "u1", email: "person@example.com" };
    render(<StaffApp />);
    expect(
      screen.getByRole("heading", { name: /no workspace access/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/good evening/i)).not.toBeInTheDocument();
  });

  it("renders the workspace for a signed-in kitchen member", () => {
    state.user = { id: "u1", email: "chef@example.com" };
    state.membership = { restaurantId: "r1", role: "kitchen" };
    state.role = "kitchen";
    render(<StaffApp />);

    expect(
      screen.getByRole("heading", { name: /good evening/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Developed by QuickTab Payments Team"),
    ).toBeInTheDocument();
  });

  it("hides the deferred reservations nav", () => {
    state.user = { id: "u1", email: "chef@example.com" };
    state.membership = { restaurantId: "r1", role: "kitchen" };
    state.role = "kitchen";
    render(<StaffApp />);

    expect(screen.queryByText("Reservations")).not.toBeInTheDocument();
    expect(screen.queryByText("Bookings")).not.toBeInTheDocument();
  });
});
