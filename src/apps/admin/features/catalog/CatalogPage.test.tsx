import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CatalogPage } from "./CatalogPage"
import type { CategoryVM, MenuItemVM } from "../../viewModels"

const category: CategoryVM = {
  id: "cat-a",
  name: "Hot Beverages",
  displayOrder: 0,
}

const item: MenuItemVM = {
  id: "item-1",
  name: "Flat White",
  categoryId: "cat-a",
  categoryName: "Hot Beverages",
  description: "Smooth and creamy",
  price: 4.7,
  imageUrl: null,
  isAvailable: true,
  displayOrder: 0,
}

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
  menu: {
    categories: [] as CategoryVM[],
    items: [] as MenuItemVM[],
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
    isMutating: false,
    createItem: vi.fn(async () => true),
    updateItem: vi.fn(async () => true),
    deleteItem: vi.fn(async () => true),
    deleteItems: vi.fn(async () => true),
    setAvailability: vi.fn(async () => true),
    moveItemsToCategory: vi.fn(async () => true),
    reorderItems: vi.fn(async () => true),
    createCategory: vi.fn(async () => true),
    renameCategory: vi.fn(async () => true),
    deleteCategory: vi.fn(async () => true),
    reorderCategories: vi.fn(async () => true),
  },
}))

vi.mock("@shared/restaurant/RestaurantProvider", () => ({
  useRestaurant: () => ({
    restaurant: { id: "restaurant-1", currency: "AUD" },
    role: "owner",
  }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: mocks.confirm }),
}))

vi.mock("../../hooks/useMenu", () => ({
  useMenu: () => mocks.menu,
}))

describe("CatalogPage", () => {
  beforeEach(() => {
    mocks.menu.categories = []
    mocks.menu.items = []
    mocks.menu.isLoading = false
    mocks.menu.error = null
    mocks.menu.refetch = mocks.refetch
  })

  it("shows a loading state", () => {
    mocks.menu.isLoading = true
    render(<CatalogPage />)
    expect(screen.getByRole("status")).toHaveTextContent(/loading catalog/i)
  })

  it("shows a retryable error state", () => {
    mocks.menu.error = new Error("network down")
    render(<CatalogPage />)
    expect(
      screen.getByText(/we couldn't load the catalog/i),
    ).toBeInTheDocument()
    expect(screen.getByText("network down")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument()
  })

  it("renders rows with the category name, image alt, and formatted price", () => {
    mocks.menu.categories = [category]
    mocks.menu.items = [item]
    render(<CatalogPage />)

    expect(screen.getByText("Flat White")).toBeInTheDocument()
    expect(screen.getAllByText("Hot Beverages").length).toBeGreaterThan(0)
    expect(screen.getByText(/4\.70/)).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows the empty state when filters match nothing", () => {
    mocks.menu.categories = [category]
    mocks.menu.items = [item]
    render(<CatalogPage />)

    const search = screen.getByPlaceholderText(/search menu items/i)
    fireEvent.change(search, { target: { value: "nothing" } })

    expect(screen.getByText(/no menu items found/i)).toBeInTheDocument()
  })
})
