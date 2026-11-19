import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TablesPage } from "./TablesPage"
import type { TableVM } from "../../viewModels"

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  notifyError: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
  deleteTable: vi.fn(async () => true),
  deleteTables: vi.fn(async () => true),
  setActive: vi.fn(async () => true),
  countOrdersForTables: vi.fn(async () => ({}) as Record<string, number>),
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
  useAdminUi: () => ({ notify: mocks.notify, notifyError: mocks.notifyError, confirm: mocks.confirm }),
}))

vi.mock("@shared/data/orders", () => ({
  countOrdersForTables: mocks.countOrdersForTables,
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
    deleteTable: mocks.deleteTable,
    deleteTables: mocks.deleteTables,
    setActive: mocks.setActive,
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
  status: "occupied",
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
  status: "available",
  openOrder: null,
}

const seatedWithoutOrder: TableVM = {
  id: "table-3",
  number: "T03",
  locationLabel: "Indoors",
  seats: 2,
  isActive: true,
  qrToken: "bbbbbbbbbbbbbbbb",
  status: "occupied",
  openOrder: null,
}

const needsCleaning: TableVM = {
  id: "table-4",
  number: "T04",
  locationLabel: "Indoors",
  seats: 4,
  isActive: true,
  qrToken: "cccccccccccccccc",
  status: "needs_cleaning",
  openOrder: null,
}

const freedByStaff: TableVM = {
  id: "table-5",
  number: "T05",
  locationLabel: "Indoors",
  seats: 4,
  isActive: true,
  qrToken: "dddddddddddddddd",
  status: "available",
  openOrder: {
    orderNumber: "1003",
    status: "confirmed",
    startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
}

describe("TablesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = []
    mocks.isLoading = false
    mocks.error = null
    mocks.countOrdersForTables.mockResolvedValue({})
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

  it("shows the staff-managed occupancy and keeps seats real", async () => {
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

  it("shows staff-seated and cleaning tables without an open order", () => {
    mocks.rows = [seatedWithoutOrder, needsCleaning]
    render(<TablesPage />)

    expect(screen.getByText("Occupied")).toBeInTheDocument()
    expect(screen.getByText("Seated by staff · no order yet")).toBeInTheDocument()
    expect(screen.getByText("Needs cleaning")).toBeInTheDocument()
    expect(screen.getByText("Awaiting cleaning")).toBeInTheDocument()
  })

  it("lets a staff-marked free table win over an old open order", () => {
    mocks.rows = [freedByStaff]
    render(<TablesPage />)

    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.queryByText("#1003")).not.toBeInTheDocument()
  })

  it("offers deactivation instead of deleting a table with past orders", async () => {
    mocks.rows = [free]
    mocks.countOrdersForTables.mockResolvedValue({ "table-2": 3 })
    render(<TablesPage />)

    fireEvent.click(screen.getByRole("button", { name: /delete table Pick-up/i }))

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const confirmation = mocks.confirm.mock.calls[0][0] as {
      description: string
      actionLabel: string
      onConfirm: () => void
    }
    expect(confirmation.actionLabel).toBe("Disable table")
    expect(confirmation.description).toMatch(/past orders/i)
    expect(confirmation.description).toMatch(/erase their table reference/i)

    confirmation.onConfirm()

    await waitFor(() => expect(mocks.setActive).toHaveBeenCalledWith(["table-2"], false))
    expect(mocks.deleteTable).not.toHaveBeenCalled()
  })

  it("deletes a table that has no past orders", async () => {
    mocks.rows = [free]
    mocks.countOrdersForTables.mockResolvedValue({})
    render(<TablesPage />)

    fireEvent.click(screen.getByRole("button", { name: /delete table Pick-up/i }))

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const confirmation = mocks.confirm.mock.calls[0][0] as {
      actionLabel: string
      onConfirm: () => void
    }
    expect(confirmation.actionLabel).toBe("Delete table")

    confirmation.onConfirm()

    await waitFor(() => expect(mocks.deleteTable).toHaveBeenCalledWith("table-2"))
    expect(mocks.setActive).not.toHaveBeenCalled()
  })

  it("does not delete when the order-history lookup fails", async () => {
    mocks.rows = [free]
    mocks.countOrdersForTables.mockRejectedValue(new Error("lookup failed"))
    render(<TablesPage />)

    fireEvent.click(screen.getByRole("button", { name: /delete table Pick-up/i }))

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledWith("lookup failed"))
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.deleteTable).not.toHaveBeenCalled()
  })
})
