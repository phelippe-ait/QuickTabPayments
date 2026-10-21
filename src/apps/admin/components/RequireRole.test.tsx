import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { RequireRole } from "./RequireRole";

const mocks = vi.hoisted(() => ({
  role: null as "owner" | "manager" | "kitchen" | null,
}));

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  useRestaurant: () => ({ role: mocks.role }),
  roleLabels: { owner: "Owner", manager: "Manager", kitchen: "Kitchen" },
}));

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn(async () => {}) }),
}));

function renderGuard(roles: Array<"owner" | "manager" | "kitchen">) {
  return render(
    <MemoryRouter>
      <RequireRole roles={roles}>
        <h1>Allowed content</h1>
      </RequireRole>
    </MemoryRouter>,
  );
}

describe("RequireRole", () => {
  it("renders children when the role is allowed", () => {
    mocks.role = "manager";
    renderGuard(["owner", "manager"]);
    expect(
      screen.getByRole("heading", { name: /allowed content/i }),
    ).toBeInTheDocument();
  });

  it("renders the blocked state when the role is not allowed", () => {
    mocks.role = "kitchen";
    renderGuard(["owner", "manager"]);
    expect(
      screen.getByRole("heading", { name: /not available for your role/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /allowed content/i }),
    ).not.toBeInTheDocument();
  });
});
