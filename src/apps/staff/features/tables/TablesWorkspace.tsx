import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import type { Table, TableStatus } from "../../types"
import { Stat } from "../../components/StaffUi"

export function TableCard({
  table,
  selected,
  onSelect,
}: {
  table: Table
  selected: boolean
  onSelect: (table: Table) => void
}) {
  const occupied = table.status === "occupied"
  return (
    <button
      className={`group min-h-[190px] rounded-[22px] border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#6b5b4b]/5 ${
        selected
          ? "border-berry bg-paper shadow-md shadow-[#9c4555]/10"
          : occupied
            ? "border-line bg-paper"
            : "border-dashed border-line bg-cream-3"
      }`}
      onClick={() => onSelect(table)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`${styles["eyebrow"]}`}>Table</p>
          <p className="mt-0.5 font-serif text-4xl">
            {table.tableNumber ?? table.id.toString().padStart(2, "0")}
          </p>
        </div>
        <StatusPill tone={table.status === "occupied" ? "primary" : "success"}>{table.status}</StatusPill>
      </div>
      {occupied ? (
        <div className="mt-7 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold">{table.guest}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Icon name="clock" size={14} /> {table.since}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="users" size={14} /> {table.occupants} guests
              </span>
            </div>
          </div>
          <span className="font-serif text-xl">${table.total?.toFixed(2)}</span>
        </div>
      ) : (
        <div className="mt-8 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#858c80]">
            <Icon name="users" size={16} />
{table.seats != null ? `Seats ${table.seats}` : "Capacity not set"}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sage transition group-hover:bg-sage group-hover:text-white">
            <Icon name="arrow" size={15} />
          </span>
        </div>
      )}
    </button>
  )
}

export function TableEditor({
  table,
  onClose,
  onSave,
}: {
  table: Table
  onClose: () => void
  onSave: (table: Table) => void
}) {
  const [status, setStatus] = useState<TableStatus>(table.status)
  const [guest, setGuest] = useState(table.guest ?? "")
  const [occupants, setOccupants] = useState(table.occupants)
  const occupied = status === "occupied"

  function saveChanges() {
    onSave({
      ...table,
      status,
      guest: occupied ? guest.trim() || "Walk-in guest" : undefined,
      occupants: occupied ? Math.max(1, Math.min(table.seats ?? Infinity, occupants)) : 0,
      since: occupied ? (table.since ?? "Just now") : undefined,
      total: occupied ? (table.total ?? 0) : undefined,
      items: occupied ? (table.items ?? 0) : undefined,
    })
  }

  return (
    <>
      <button
        aria-label="Close order details"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[440px] sm:p-8`}>
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Edit table</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="mt-8 flex items-end justify-between border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl">
              {table.tableNumber ?? table.id.toString().padStart(2, "0")}
            </h2>
            <p className="mt-2 text-sm text-muted-2">
              Capacity · {table.seats} guests
            </p>
          </div>
          <StatusPill tone={status === "occupied" ? "primary" : "success"} withDot={false}>
            {status}
          </StatusPill>
        </div>

        <div className="mt-7">
          <p className={`${styles["detail-label"]} mb-3`}>Table status</p>
          <div className="grid grid-cols-2 gap-3">
            {(["available", "occupied"] as const).map((option) => (
              <button
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold capitalize transition ${
                  status === option
                    ? option === "occupied"
                      ? "border-berry bg-berry-soft text-berry-strong"
                      : "border-sage bg-sage-soft text-sage-strong"
                    : "border-line bg-white text-muted-2 hover:border-placeholder"
                }`}
                key={option}
                onClick={() => setStatus(option)}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {option}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`mt-7 space-y-6 transition ${
            occupied ? "" : "pointer-events-none opacity-40"
          }`}
        >
          <label className="block">
            <span className={`${styles["detail-label"]}`}>Guest name</span>
            <input
              className="mt-2.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition placeholder:text-placeholder focus:border-berry focus:ring-2 focus:ring-berry/10"
              disabled={!occupied}
              onChange={(event) => setGuest(event.target.value)}
              placeholder="Enter guest or party name"
              value={guest}
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className={`${styles["detail-label"]}`}>Number of occupants</span>
              <span className="text-xs text-muted">
                Maximum {table.seats}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line bg-white p-2">
              <button
                aria-label="Decrease occupants"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!occupied || occupants <= 1}
                onClick={() =>
                  setOccupants((current) => Math.max(1, current - 1))
                }
              >
                −
              </button>
              <div className="text-center">
                <strong className="font-serif text-2xl font-normal">
                  {occupied ? Math.max(1, occupants) : 0}
                </strong>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                  Guests
                </p>
              </div>
              <button
                aria-label="Increase occupants"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!occupied || (table.seats !== undefined && occupants >= table.seats)}
                onClick={() =>
                  setOccupants((current) =>
                    Math.min(table.seats ?? Infinity, Math.max(1, current) + 1),
                  )
                }
              >
                +
              </button>
            </div>
          </div>
        </div>

        {!occupied && (
          <div className="mt-7 rounded-xl bg-sage-soft p-4 text-xs leading-5 text-sage-strong">
            Setting this table to available will clear its current guest and
            occupant details.
          </div>
        )}

        <button
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-berry py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
          onClick={saveChanges}
        >
          <Icon name="check" size={16} /> Save table changes
        </button>
      </aside>
    </>
  )
}

export function TablesWorkspace({ tableList, filteredTables, occupied, filter, selectedTable, onFilterChange, onSelectTable, userName }: {
  tableList: Table[]
    userName: string
  filteredTables: Table[]
  occupied: number
  filter: "all" | TableStatus
  selectedTable: Table | null
  onFilterChange: (filter: "all" | TableStatus) => void
  onSelectTable: (table: Table) => void
}) {

    const firstName = userName.trim().split(/\s+/)[0] || "there"
  const hour = new Date().getHours()

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening"
  return (
            <>
              <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className={`${styles["eyebrow"]}`}>Floor plan</p>
                  <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
                    {greeting}, {firstName}.
                  </h1>
                  <p className="mt-2 text-sm text-muted-2">
                    Here’s what’s happening in the dining room.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Stat
                    value={occupied.toString().padStart(2, "0")}
                    label="Occupied"
                    tone="rose"
                  />
                  <Stat
                    value={(tableList.length - occupied)
                      .toString()
                      .padStart(2, "0")}
                    label="Available"
                    tone="green"
                  />
                </div>
              </section>

              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex rounded-full border border-line bg-line-soft p-1">
                  {(["all", "occupied", "available"] as const).map((item) => (
                    <button
                      className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition ${
                        filter === item
                          ? "bg-white text-ink shadow-sm"
                          : "text-muted-2 hover:text-ink"
                      }`}
                      key={item}
                      onClick={() => onFilterChange(item)}
                    >
                      {item}{" "}
                      {item !== "all" &&
                        `(${tableList.filter((table) => table.status === item).length})`}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">
                  Main dining room · {tableList.length} {tableList.length === 1 ? "table" : "tables"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredTables.map((table) => (
                  <TableCard
                    key={table.id}
                    selected={selectedTable?.id === table.id}
                    table={table}
                    onSelect={onSelectTable}
                  />
                ))}
              </div>
            </>
  )
}
