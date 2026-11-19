import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MenuScreen } from "./MenuScreen"
import type { QrContext } from "../../types"

const mocks = vi.hoisted(() => ({
  fetchMenu: vi.fn(),
  fetchRestaurantBranding: vi.fn(),
}))

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({ user: null, profile: null, signOut: vi.fn() }),
}))

vi.mock("../../data/menuApi", () => ({
  fetchMenu: mocks.fetchMenu,
}))

vi.mock("../../data/branding", () => ({
  fetchRestaurantBranding: mocks.fetchRestaurantBranding,
}))

const qr: QrContext = {
  restaurantId: "restaurant-1",
  restaurantSlug: "test-cafe",
  restaurantName: "Test Café",
  currency: "AUD",
  taxRate: 0.1,
  tableId: "table-1",
  tableToken: "token",
  tableNumber: "1",
}

function renderMenu() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MenuScreen
        qr={qr}
        cartCount={0}
        total={0}
        onOpenCart={vi.fn()}
        onOpenOrders={vi.fn()}
        onSelect={vi.fn()}
        onAuth={vi.fn()}
        onReconcile={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchMenu.mockResolvedValue([])
  mocks.fetchRestaurantBranding.mockResolvedValue({
    logoUrl: "https://cdn.test/logo.webp",
    coverUrl: "https://cdn.test/cover.webp",
  })
})

describe("MenuScreen branding", () => {
  it("renders the restaurant logo and cover when they are set", async () => {
    const { container } = renderMenu()

    await waitFor(() => {
      expect(
        container.querySelector('img[src="https://cdn.test/logo.webp"]'),
      ).not.toBeNull()
    })
    expect(
      container.querySelector('img[src="https://cdn.test/cover.webp"]'),
    ).not.toBeNull()
  })

  it("falls back to the name and default banner without branding", async () => {
    mocks.fetchRestaurantBranding.mockResolvedValue({
      logoUrl: null,
      coverUrl: null,
    })

    const { container } = renderMenu()

    await waitFor(() => expect(mocks.fetchRestaurantBranding).toHaveBeenCalled())
    expect(container.querySelectorAll("img")).toHaveLength(0)
  })
})
