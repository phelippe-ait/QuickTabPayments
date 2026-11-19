import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { TablesWorkspace } from "./TablesWorkspace"
import type { Table } from "../../types"

function table(overrides: Partial<Table> = {}): Table {
  return {
    id: "table-1",
    tableNumber: "1",
    seats: 4,
    occupants: 0,
    status: "available",
    ...overrides,
  }
}

function renderTables(
  tables: Table[],
  overrides: Partial<ComponentProps<typeof TablesWorkspace>> = {},
) {
  return render(
    <TablesWorkspace
      tableList={tables}
      filteredTables={tables}
      occupied={tables.filter((row) => row.status === "occupied").length}
      filter="all"
      selectedTable={null}
      onFilterChange={vi.fn()}
      onSelectTable={vi.fn()}
      onTableStatusChange={vi.fn()}
      userName="Alex Host"
      currency="AUD"
      {...overrides}
    />,
  )
}

describe("TablesWorkspace table status", () => {
  it("renders a StatusPill for every operational state", () => {
    renderTables([
      table({ id: "t1", tableNumber: "1", status: "available" }),
      table({
        id: "t2",
        tableNumber: "2",
        status: "occupied",
        guest: "Walk-in guest",
        occupants: 2,
        since: "12:30",
      }),
      table({ id: "t3", tableNumber: "3", status: "needs_cleaning" }),
    ])

    const [available, occupied, cleaning] = screen.getAllByRole("article")

    expect(within(available).getByText("Available")).toBeInTheDocument()
    expect(within(occupied).getByText("Occupied")).toBeInTheDocument()
    expect(within(cleaning).getByText("Needs cleaning")).toBeInTheDocument()
  })

  it("offers the next legal action for each state", () => {
    renderTables([
      table({ id: "t1", tableNumber: "1", status: "available" }),
      table({ id: "t2", tableNumber: "2", status: "occupied" }),
      table({ id: "t3", tableNumber: "3", status: "needs_cleaning" }),
    ])

    expect(
      screen.getByRole("button", { name: "Seat guests at table 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mark for cleaning at table 2" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mark clean at table 3" }),
    ).toBeInTheDocument()
  })

  it("calls the mutation with the correct next status for each state", () => {
    const onTableStatusChange = vi.fn()
    renderTables(
      [
        table({ id: "t1", tableNumber: "1", status: "available" }),
        table({ id: "t2", tableNumber: "2", status: "occupied" }),
        table({ id: "t3", tableNumber: "3", status: "needs_cleaning" }),
      ],
      { onTableStatusChange },
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Seat guests at table 1" }),
    )
    expect(onTableStatusChange).toHaveBeenLastCalledWith("t1", "occupied")

    fireEvent.click(
      screen.getByRole("button", { name: "Mark for cleaning at table 2" }),
    )
    expect(onTableStatusChange).toHaveBeenLastCalledWith(
      "t2",
      "needs_cleaning",
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Mark clean at table 3" }),
    )
    expect(onTableStatusChange).toHaveBeenLastCalledWith("t3", "available")
  })

  it("announces the new status through the polite live region", () => {
    renderTables([table({ id: "t1", tableNumber: "1" })])

    const liveRegion = screen.getByRole("status")
    expect(liveRegion).toHaveAttribute("aria-live", "polite")
    expect(liveRegion).toHaveTextContent("")

    fireEvent.click(
      screen.getByRole("button", { name: "Seat guests at table 1" }),
    )

    expect(liveRegion).toHaveTextContent("Table 1 is now occupied.")
  })

  it("disables the action button while its table update is in flight", () => {
    renderTables([table({ id: "t1", tableNumber: "1" })], {
      updatingTableIds: new Set(["t1"]),
    })

    const button = screen.getByRole("button", {
      name: "Seat guests at table 1",
    })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toHaveTextContent("Updating…")
  })

  it("shows the open order's guest, seated time and total without fabricated counts", () => {
    renderTables([
      table({
        id: "t2",
        tableNumber: "2",
        status: "occupied",
        guest: "Olivia",
        since: "12:30",
        total: 24.5,
        items: 3,
        occupants: 0,
      }),
    ])

    const card = screen.getByRole("article")
    expect(within(card).getByText("Olivia")).toBeInTheDocument()
    expect(within(card).getByText("12:30")).toBeInTheDocument()
    expect(within(card).getByText(/24\.50/)).toBeInTheDocument()
    expect(within(card).queryByText(/0 guests/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/\$0\.00/)).not.toBeInTheDocument()
  })

  it("hides derived occupancy fields when the occupied table has no open order", () => {
    renderTables([
      table({ id: "t2", tableNumber: "2", status: "occupied" }),
    ])

    const card = screen.getByRole("article")
    expect(within(card).getByText("No open order")).toBeInTheDocument()
    expect(within(card).queryByText(/guests/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/\$0\.00/)).not.toBeInTheDocument()
  })
})
