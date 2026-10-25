import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TablesPage } from "./TablesPage"
import type { TableVM } from "../../viewModels"

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
  rows: [] as TableVM[],
  isLoading: false,
  error: null as Error | null,
}))

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: () => ({
    restaurant: {
      id: "restaurant-1",
      name: "Test Café",
      slug: "test-cafe",
      currency: "AUD",
    },
    role: "owner",
  }),
}))

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, confirm: mocks.confirm }),
}))

vi.mock("../../hooks/useTables", () => ({
  useTables: () => ({
    tables: mocks.rows,
    isLoading: mocks.isLoading,
    error: mocks.error,
    refetch: mocks.refetch,
    isMutating: false,
    createTable: vi.fn(async () => true),
    updateTable: vi.fn(async () => true),
    deleteTable: vi.fn(async () => true),
    deleteTables: vi.fn(async () => true),
    setActive: vi.fn(async () => true),
  }),
}))

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
  },
}))

const occupied: TableVM = {
  id: "table-1",
  number: "T02",
  locationLabel: "Indoors",
  seats: 4,
  isActive: true,
  qrToken: "9f3ab12c7d44e0a8",
  openOrder: {
    orderNumber: "1002",
    status: "preparing",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
}

const free: TableVM = {
  id: "table-2",
  number: "Pick-up",
  locationLabel: "Pick-up",
  seats: null,
  isActive: true,
  qrToken: "aaaaaaaaaaaaaaaa",
  openOrder: null,
}

describe("TablesPage", () => {
  beforeEach(() => {
    mocks.rows = []
    mocks.isLoading = false
    mocks.error = null
  })

  it("shows a loading state", () => {
    mocks.isLoading = true
    render(<TablesPage />)
    expect(screen.getByRole("status")).toHaveTextContent(/loading tables/i)
  })

  it("shows a retryable error", () => {
    mocks.error = new Error("tables unavailable")
    render(<TablesPage />)
    expect(screen.getByText(/couldn't load your tables/i)).toBeInTheDocument()
    expect(screen.getByText("tables unavailable")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("derives occupancy from open orders and keeps seats real", async () => {
    mocks.rows = [occupied, free]
    render(<TablesPage />)

    expect(screen.getByText("#1002")).toBeInTheDocument()
    expect(screen.getByText("Occupied")).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("5 min ago")).toBeInTheDocument()
    expect(await screen.findByAltText(/QR code for table T02/i)).toBeInTheDocument()

    const seats = screen.getAllByText("—")
    expect(seats.length).toBeGreaterThan(0)
  })
})
