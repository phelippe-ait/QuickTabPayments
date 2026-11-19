import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { Skeleton } from "@shared/ui/shadcn/skeleton"
import { cn } from "@shared/lib/cn"
import { formatMoney } from "@shared/lib/money"
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus"
import type { Table, TableStatus } from "../../types"
import { Stat } from "../../components/StaffUi"
import {
  nextTableStatus,
  tableStatusActionLabels,
  tableStatusAnnouncement,
  tableStatusLabels,
  tableStatusTone,
} from "./tableStatus"

function tableLabel(table: Table): string {
  return table.tableNumber ?? String(table.id).padStart(2, "0")
}

function seatedTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function TableCard({
  table,
  selected,
  onSelect,
  onAdvance,
  isUpdating = false,
  currency,
}: {
  table: Table
  selected: boolean
  onSelect: (table: Table) => void
  onAdvance: (table: Table) => void
  isUpdating?: boolean
  currency: string
}) {
  const { status } = table
  const occupied = status === "occupied"
  const label = tableLabel(table)
  const actionLabel = tableStatusActionLabels[status]
  const nextStatus = nextTableStatus(status)

  return (
    <article
      className={cn(
        "group flex min-h-[210px] flex-col rounded-[22px] border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#6b5b4b]/5",
        selected
          ? "border-berry bg-paper shadow-md shadow-[#9c4555]/10"
          : occupied
            ? "border-line bg-paper"
            : status === "needs_cleaning"
              ? "border-amber/50 bg-paper"
              : "border-dashed border-line bg-cream-3",
      )}
    >
      <button
        type="button"
        aria-label={`Open table ${label} details (${tableStatusLabels[status]})`}
        className="flex w-full flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry"
        onClick={() => onSelect(table)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`${styles["eyebrow"]}`}>Table</p>
            <p className="mt-0.5 font-serif text-4xl">{label}</p>
          </div>
          <StatusPill tone={tableStatusTone(status)}>
            {tableStatusLabels[status]}
          </StatusPill>
        </div>
        {occupied ? (
          <div className="mt-7 flex items-end justify-between gap-3">
            {table.since != null ? (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {table.guest || "Guest"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Icon name="clock" size={14} /> {seatedTime(table.since)}
                    </span>
                    {table.occupants > 0 && (
                      <span className="flex items-center gap-1">
                        <Icon name="users" size={14} /> {table.occupants} guests
                      </span>
                    )}
                  </div>
                </div>
                {table.total != null && (
                  <span className="shrink-0 font-serif text-xl">
                    {formatMoney(table.total, currency)}
                  </span>
                )}
              </>
            ) : (
              <p className="text-sm font-bold text-muted">No open order</p>
            )}
          </div>
        ) : status === "needs_cleaning" ? (
          <div className="mt-7">
            <p className="text-sm font-bold text-amber">Awaiting cleaning</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted">
              <Icon name="users" size={16} />
              {table.seats != null ? `Seats ${table.seats}` : "Capacity not set"}
            </p>
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <Icon name="users" size={16} />
              {table.seats != null ? `Seats ${table.seats}` : "Capacity not set"}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sage transition group-hover:bg-sage group-hover:text-white">
              <Icon name="arrow" size={15} />
            </span>
          </div>
        )}
      </button>

      <button
        type="button"
        aria-label={`${actionLabel} at table ${label}`}
        aria-busy={isUpdating}
        className={cn(
          "mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry disabled:cursor-not-allowed disabled:opacity-60",
          nextStatus === "occupied" &&
            "border-sage/40 bg-sage-soft text-sage-strong hover:bg-sage-soft/70",
          nextStatus === "needs_cleaning" &&
            "border-amber/40 bg-amber-soft text-amber hover:bg-amber-soft/70",
          nextStatus === "available" &&
            "border-sage/40 bg-paper text-sage-strong hover:bg-sage-soft",
        )}
        disabled={isUpdating}
        onClick={() => onAdvance(table)}
      >
        {isUpdating ? "Updating…" : actionLabel}
      </button>
    </article>
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
  const panelRef = useDialogFocus<HTMLElement>(onClose)
  useBodyScrollLock()

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
        aria-label="Close table editor"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-editor-title"
        className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[440px] sm:p-8`}
      >
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Edit table</p>
          <button
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="mt-8 flex items-end justify-between gap-3 border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl" id="table-editor-title">
              {tableLabel(table)}
            </h2>
            <p className="mt-2 text-sm text-muted-2">
              Capacity · {table.seats ?? "not set"} guests
            </p>
          </div>
          <StatusPill tone={tableStatusTone(status)} withDot={false}>
            {tableStatusLabels[status]}
          </StatusPill>
        </div>

        <div className="mt-7">
          <p className={`${styles["detail-label"]} mb-3`}>Table status</p>
          <div className="grid grid-cols-3 gap-2">
            {(["available", "occupied", "needs_cleaning"] as const).map(
              (option) => (
                <button
                  type="button"
                  aria-pressed={status === option}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                    status === option
                      ? option === "occupied"
                        ? "border-info/40 bg-info-soft text-info"
                        : option === "needs_cleaning"
                          ? "border-amber/40 bg-amber-soft text-amber"
                          : "border-sage bg-sage-soft text-sage-strong"
                      : "border-line bg-white text-muted-2 hover:border-placeholder"
                  }`}
                  key={option}
                  onClick={() => setStatus(option)}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {option === "needs_cleaning" ? "Cleaning" : tableStatusLabels[option]}
                </button>
              ),
            )}
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
              className="mt-2.5 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-sm outline-none transition placeholder:text-placeholder focus:border-berry focus:ring-2 focus:ring-berry/10"
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
                Maximum {table.seats ?? "—"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line bg-white p-2">
              <button
                aria-label="Decrease occupants"
                className="grid h-11 w-11 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
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
                className="grid h-11 w-11 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
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
            {status === "needs_cleaning"
              ? "Guests and occupant details are cleared while this table waits to be cleaned."
              : "Setting this table to available will clear its current guest and occupant details."}
          </div>
        )}

        <button
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-berry py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
          onClick={saveChanges}
        >
          <Icon name="check" size={16} /> Save table changes
        </button>
      </aside>
    </>
  )
}

export function TablesWorkspace({
  tableList,
  filteredTables,
  occupied,
  filter,
  selectedTable,
  onFilterChange,
  onSelectTable,
  onTableStatusChange,
  updatingTableIds,
  userName,
  currency,
  isLoading = false,
  error = null,
}: {
  tableList: Table[]
  userName: string
  filteredTables: Table[]
  occupied: number
  filter: "all" | TableStatus
  selectedTable: Table | null
  onFilterChange: (filter: "all" | TableStatus) => void
  onSelectTable: (table: Table) => void
  onTableStatusChange: (tableId: string, status: TableStatus) => void
  updatingTableIds?: ReadonlySet<string>
  currency: string
  isLoading?: boolean
  error?: string | null
}) {
  const [announcement, setAnnouncement] = useState("")
  const firstName = userName.trim().split(/\s+/)[0] || "there"
  const available = tableList.filter(
    (table) => table.status === "available",
  ).length

  const hour = new Date().getHours()
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening"

  function advanceTable(table: Table) {
    const nextStatus = nextTableStatus(table.status)
    setAnnouncement(tableStatusAnnouncement(tableLabel(table), nextStatus))
    onTableStatusChange(String(table.id), nextStatus)
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

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
            value={available.toString().padStart(2, "0")}
            label="Available"
            tone="green"
          />
        </div>
      </section>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-fit max-w-full flex-wrap rounded-full border border-line bg-line-soft p-1">
          {(["all", "occupied", "available", "needs_cleaning"] as const).map(
            (item) => (
              <button
                type="button"
                aria-pressed={filter === item}
                className={`min-h-11 rounded-full px-4 text-xs font-bold transition ${
                  filter === item
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted-2 hover:text-ink"
                }`}
                key={item}
                onClick={() => onFilterChange(item)}
              >
                {item === "all" ? "All" : tableStatusLabels[item]}{" "}
                {item !== "all" &&
                  `(${tableList.filter((table) => table.status === item).length})`}
              </button>
            ),
          )}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">
          Main dining room · {tableList.length}{" "}
          {tableList.length === 1 ? "table" : "tables"}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
        >
          <span className="font-bold">Tables:</span> {error}
        </div>
      )}

      {isLoading ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading tables"
        >
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-[210px] rounded-[22px]" />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line bg-cream-3 px-6 py-20 text-center">
          <h2 className="font-serif text-2xl">No tables to show</h2>
          <p className="mt-1 text-sm text-muted">
            {tableList.length === 0
              ? "Add tables in the admin workspace to start taking orders."
              : "No tables match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              currency={currency}
              isUpdating={updatingTableIds?.has(String(table.id)) ?? false}
              selected={selectedTable?.id === table.id}
              table={table}
              onAdvance={advanceTable}
              onSelect={onSelectTable}
            />
          ))}
        </div>
      )}
      <div className="h-16 lg:hidden" />
    </>
  )
}
