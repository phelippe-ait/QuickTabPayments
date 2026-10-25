import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import CustomerApp from "./CustomerDashboard";

vi.mock("./data/qrContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./data/qrContext")>();
  return {
    ...actual,
    resolveInitialQrContext: vi.fn().mockResolvedValue({
      ok: true,
      context: {
        restaurantId: "restaurant-1",
        restaurantSlug: "quicktab-demo-cafe",
        restaurantName: "QuickTab Demo Cafe",
        currency: "AUD",
        taxRate: 0.1,
        tableId: "table-1",
        tableToken: "table-token-1",
        tableNumber: "T05",
      },
    }),
  };
});

vi.mock("./data/menuApi", () => ({
  fetchMenu: vi.fn().mockResolvedValue([
    {
      id: "category-1",
      name: "Hot Beverages",
      description: "Coffee",
      displayOrder: 0,
      items: [
        {
          id: "item-1",
          name: "Flat White",
          description: "Smooth and creamy.",
          price: 4.7,
          imageUrl: null,
          allergens: [],
          prepTimeMinutes: 4,
          categoryId: "category-1",
          displayOrder: 0,
        },
      ],
    },
  ]),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("Customer app", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("resolves the scanned table and renders its database menu", async () => {
    render(<CustomerApp />, { wrapper });

    expect(await screen.findByText("Table T05")).toBeInTheDocument();
    expect(await screen.findByText("Flat White")).toBeInTheDocument();
    expect(screen.getByText("QuickTab Demo Cafe")).toBeInTheDocument();
    expect(
      screen.getByText("Developed by QuickTab Payments Team"),
    ).toBeInTheDocument();
  });
});
