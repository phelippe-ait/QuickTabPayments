import { useMemo, useState } from "react"
import styles from "./App.module.css";
import { Icon, type IconName } from "@shared/ui/Icon";
import { StatusPill, type StatusTone } from "@shared/ui/StatusPill";

type TableStatus = "occupied" | "available"
type KitchenStatus = "New" | "Preparing" | "Ready" | "Completed" | "Cancelled"
type View = "tables" | "kitchen" | "history" | "reservations"

type Table = {
  id: number
  seats: number
  occupants: number
  status: TableStatus
  guest?: string
  since?: string
  total?: number
  items?: number
}

type Order = {
  id: string
  table: string
  guest: string
  time: string
  total: number
  status: "In progress" | "Completed" | "Cancelled"
  kitchenStatus: KitchenStatus
  server: string
  guests: number
  payment: string
  items: { name: string; qty: number; price: number }[]
}

type Reservation = {
  id: number
  guest: string
  date: string
  time: string
  guests: number
  table?: string
  status: "upcoming" | "past" | "cancelled"
  notes?: string
}

const tables: Table[] = [
  {
    id: 1,
    seats: 2,
    occupants: 2,
    status: "occupied",
    guest: "Olivia Chen",
    since: "6:32 PM",
    total: 86.5,
    items: 5,
  },
  { id: 2, seats: 4, occupants: 0, status: "available" },
  {
    id: 3,
    seats: 4,
    occupants: 3,
    status: "occupied",
    guest: "Marcus Lee",
    since: "6:48 PM",
    total: 124,
    items: 7,
  },
  { id: 4, seats: 2, occupants: 0, status: "available" },
  {
    id: 5,
    seats: 6,
    occupants: 5,
    status: "occupied",
    guest: "The Parkers",
    since: "6:10 PM",
    total: 212.8,
    items: 11,
  },
  {
    id: 6,
    seats: 4,
    occupants: 2,
    status: "occupied",
    guest: "Sofia Patel",
    since: "7:02 PM",
    total: 67.25,
    items: 4,
  },
  { id: 7, seats: 2, occupants: 0, status: "available" },
  {
    id: 8,
    seats: 8,
    occupants: 7,
    status: "occupied",
    guest: "Daniel Wright",
    since: "5:56 PM",
    total: 318.4,
    items: 14,
  },
  { id: 9, seats: 4, occupants: 0, status: "available" },
  { id: 10, seats: 6, occupants: 0, status: "available" },
  {
    id: 11,
    seats: 2,
    occupants: 2,
    status: "occupied",
    guest: "Emma Ross",
    since: "7:15 PM",
    total: 48.5,
    items: 3,
  },
  { id: 12, seats: 4, occupants: 0, status: "available" },
]

const orderHistory: Order[] = [
  {
    id: "#1050",
    table: "Table 3",
    guest: "Marcus Lee",
    time: "Today, 7:42 PM",
    total: 124,
    status: "In progress",
    kitchenStatus: "New",
    server: "Theo R.",
    guests: 3,
    payment: "Not paid",
    items: [
      { name: "Crispy calamari", qty: 1, price: 18 },
      { name: "Short rib pappardelle", qty: 2, price: 58 },
      { name: "House red", qty: 2, price: 16 },
      { name: "Tiramisu", qty: 1, price: 12 },
    ],
  },
  {
    id: "#1049",
    table: "Table 1",
    guest: "Olivia Chen",
    time: "Today, 7:38 PM",
    total: 86.5,
    status: "In progress",
    kitchenStatus: "Preparing",
    server: "Maya K.",
    guests: 2,
    payment: "Not paid",
    items: [
      { name: "Burrata & heirloom tomato", qty: 1, price: 18 },
      { name: "Grilled branzino", qty: 1, price: 36 },
      { name: "Roasted potatoes", qty: 1, price: 12 },
      { name: "Sparkling water", qty: 2, price: 9.5 },
    ],
  },
  {
    id: "#1048",
    table: "Table 6",
    guest: "Sofia Patel",
    time: "Today, 7:34 PM",
    total: 67.25,
    status: "In progress",
    kitchenStatus: "New",
    server: "Jamie L.",
    guests: 2,
    payment: "Not paid",
    items: [
      { name: "Roasted beet salad", qty: 1, price: 16 },
      { name: "Wild mushroom tagliatelle", qty: 1, price: 24 },
      { name: "Tiramisu", qty: 1, price: 12 },
      { name: "Sparkling water", qty: 2, price: 9.5 },
    ],
  },
  {
    id: "#1047",
    table: "Table 11",
    guest: "Emma Ross",
    time: "Today, 7:28 PM",
    total: 48.5,
    status: "In progress",
    kitchenStatus: "Preparing",
    server: "Maya K.",
    guests: 2,
    payment: "Not paid",
    items: [
      { name: "Burrata & heirloom tomato", qty: 1, price: 18 },
      { name: "Margherita pizza", qty: 1, price: 21 },
      { name: "Still water", qty: 1, price: 5 },
    ],
  },
  {
    id: "#1046",
    table: "Table 4",
    guest: "Noah Williams",
    time: "Today, 7:12 PM",
    total: 92.4,
    status: "Completed",
    kitchenStatus: "Completed",
    server: "Jamie L.",
    guests: 3,
    payment: "Visa ···· 8241",
    items: [
      { name: "Fritto misto", qty: 1, price: 19 },
      { name: "Grilled branzino", qty: 1, price: 36 },
      { name: "Rigatoni alla vodka", qty: 1, price: 22 },
      { name: "Espresso", qty: 2, price: 8 },
    ],
  },
  {
    id: "#1045",
    table: "Table 9",
    guest: "Mia Thompson",
    time: "Today, 6:54 PM",
    total: 156.8,
    status: "Completed",
    kitchenStatus: "Completed",
    server: "Theo R.",
    guests: 4,
    payment: "Amex ···· 1008",
    items: [
      { name: "Chef's antipasti board", qty: 1, price: 28 },
      { name: "Short rib pappardelle", qty: 2, price: 58 },
      { name: "Grilled branzino", qty: 1, price: 36 },
      { name: "House red", qty: 3, price: 24 },
    ],
  },
  {
    id: "#1044",
    table: "Table 2",
    guest: "James Kim",
    time: "Today, 6:21 PM",
    total: 74.25,
    status: "Completed",
    kitchenStatus: "Completed",
    server: "Maya K.",
    guests: 2,
    payment: "Mastercard ···· 5612",
    items: [
      { name: "Caesar salad", qty: 1, price: 14 },
      { name: "Chicken under a brick", qty: 1, price: 29 },
      { name: "Cacio e pepe", qty: 1, price: 21 },
      { name: "Limonata", qty: 2, price: 8 },
    ],
  },
  {
    id: "#1043",
    table: "Table 7",
    guest: "Ava & Liam",
    time: "Today, 5:48 PM",
    total: 108.9,
    status: "Completed",
    kitchenStatus: "Completed",
    server: "Theo R.",
    guests: 2,
    payment: "Visa ···· 3370",
    items: [
      { name: "Burrata & heirloom tomato", qty: 1, price: 18 },
      { name: "Lamb ragu gnocchi", qty: 1, price: 27 },
      { name: "Grilled branzino", qty: 1, price: 36 },
      { name: "Panna cotta", qty: 2, price: 20 },
    ],
  },
]

const initialReservations: Reservation[] = [
  { id: 1, guest: "Isabella Moore", date: "Today", time: "7:30 PM", guests: 4, table: "Table 9", status: "upcoming", notes: "Birthday dinner" },
  { id: 2, guest: "Ethan Carter", date: "Today", time: "8:00 PM", guests: 2, table: "Table 4", status: "upcoming" },
  { id: 3, guest: "Amelia Brooks", date: "Today", time: "8:15 PM", guests: 6, status: "upcoming", notes: "Window table preferred" },
  { id: 4, guest: "Lucas Bennett", date: "Tomorrow", time: "6:30 PM", guests: 3, table: "Table 3", status: "upcoming" },
  { id: 5, guest: "Harper Wilson", date: "Tomorrow", time: "7:45 PM", guests: 5, status: "upcoming" },
  { id: 6, guest: "Charlotte Davis", date: "Today", time: "5:00 PM", guests: 2, table: "Table 1", status: "past" },
  { id: 7, guest: "Benjamin Hall", date: "Today", time: "5:30 PM", guests: 4, table: "Table 6", status: "past" },
  { id: 8, guest: "Lily Anderson", date: "Yesterday", time: "7:15 PM", guests: 2, table: "Table 11", status: "past" },
]

function App() {
  const [view, setView] = useState<View>("tables")
  const [filter, setFilter] = useState<"all" | TableStatus>("all")
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [orders, setOrders] = useState<Order[]>(orderHistory)
  const [reservations, setReservations] =
    useState<Reservation[]>(initialReservations)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [query, setQuery] = useState("")

  const filteredTables = useMemo(
    () =>
      tableList.filter((table) => filter === "all" || table.status === filter),
    [filter, tableList],
  )

  const filteredOrders = useMemo(() => {
    const term = query.toLowerCase()
    return orders.filter((order) =>
      [order.id, order.table, order.guest, order.status].some((value) =>
        value.toLowerCase().includes(term),
      ),
    )
  }, [orders, query])

  const activeKitchenOrders = orders.filter(
    (order) =>
      order.kitchenStatus !== "Completed" &&
      order.kitchenStatus !== "Cancelled",
  )
  const previousKitchenOrders = orders
    .filter(
      (order) =>
        order.kitchenStatus === "Completed" ||
        order.kitchenStatus === "Cancelled",
    )
    .slice(0, 2)

  const occupied = tableList.filter(
    (table) => table.status === "occupied",
  ).length

  function updateTable(updatedTable: Table) {
    setTableList((current) =>
      current.map((table) =>
        table.id === updatedTable.id ? updatedTable : table,
      ),
    )
    setSelectedTable(null)
  }

  function createReservation(reservation: Omit<Reservation, "id" | "status">) {
    setReservations((current) => [
      { ...reservation, id: Date.now(), status: "upcoming" },
      ...current,
    ])
  }

  function cancelReservation(id: number) {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? { ...reservation, status: "cancelled" }
          : reservation,
      ),
    )
  }

  function updateKitchenStatus(id: string, kitchenStatus: KitchenStatus) {
    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? {
              ...order,
              kitchenStatus,
              status:
                kitchenStatus === "Cancelled" ? "Cancelled" : order.status,
            }
          : order,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-cream-2 text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-paper px-5 py-7 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-berry font-serif text-xl text-white">
            S
          </div>
          <div>
            <p className="font-serif text-[21px] leading-5">Café Shop</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Dining room
            </p>
          </div>
        </div>

        <nav className="mt-12 space-y-1.5">
          <NavButton
            active={view === "tables"}
            icon="grid"
            label="Table overview"
            onClick={() => setView("tables")}
          />
          <NavButton
            active={view === "kitchen"}
            icon="kitchen"
            label="Kitchen"
            onClick={() => setView("kitchen")}
          />
          <NavButton
            active={view === "history"}
            icon="receipt"
            label="Order history"
            onClick={() => setView("history")}
          />
          <NavButton
            active={view === "reservations"}
            icon="calendar"
            label="Reservations"
            onClick={() => setView("reservations")}
          />
        </nav>

        <div className="mt-auto">
          <button className={`${styles["nav-button"]} mb-5 w-full`}>
            <Icon name="settings" />
            Settings
          </button>
          <div className="border-t border-line-soft pt-5">
            <div className="flex items-center gap-3 rounded-2xl bg-cream-2 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#413a30] text-xs font-bold text-white">
                AM
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Alex Morgan</p>
                <p className="text-xs text-muted">Floor manager</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-paper/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-berry font-serif text-lg text-white">
              S
            </div>
            <span className="font-serif text-lg">Café Shop</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold">Friday, May 24</p>
            <p className="mt-0.5 text-xs text-muted">
              Dinner service · 5:00 PM – 11:00 PM
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-soft sm:flex">
              <span className="h-2 w-2 rounded-full bg-sage" />
              Service live
            </div>
            <button
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:border-berry hover:text-berry"
            >
              <Icon name="bell" size={19} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-berry" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-10">
          {view === "tables" ? (
            <>
              <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className={`${styles["eyebrow"]}`}>Floor plan</p>
                  <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
                    Good evening, Alex.
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
                      onClick={() => setFilter(item)}
                    >
                      {item}{" "}
                      {item !== "all" &&
                        `(${tableList.filter((table) => table.status === item).length})`}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">
                  Main dining room · 12 tables
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredTables.map((table) => (
                  <TableCard
                    key={table.id}
                    selected={selectedTable?.id === table.id}
                    table={table}
                    onSelect={setSelectedTable}
                  />
                ))}
              </div>
            </>
          ) : view === "kitchen" ? (
            <KitchenWorkspace
              orders={activeKitchenOrders}
              previousOrders={previousKitchenOrders}
              onStatusChange={updateKitchenStatus}
            />
          ) : view === "history" ? (
            <OrderHistory
              filteredOrders={filteredOrders}
              totalOrders={orders.length}
              query={query}
              setQuery={setQuery}
              onSelect={setSelectedOrder}
            />
          ) : (
            <ReservationWorkspace
              reservations={reservations}
              onCreate={createReservation}
              onCancel={cancelReservation}
            />
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-line bg-paper lg:hidden">
          <MobileNav
            active={view === "tables"}
            icon="grid"
            label="Tables"
            onClick={() => setView("tables")}
          />
          <MobileNav
            active={view === "kitchen"}
            icon="kitchen"
            label="Kitchen"
            onClick={() => setView("kitchen")}
          />
          <MobileNav
            active={view === "history"}
            icon="receipt"
            label="History"
            onClick={() => setView("history")}
          />
          <MobileNav
            active={view === "reservations"}
            icon="calendar"
            label="Bookings"
            onClick={() => setView("reservations")}
          />
        </nav>
      </div>

      {selectedTable && view === "tables" && (
        <TableEditor
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onSave={updateTable}
        />
      )}
      {selectedOrder && view === "history" && (
        <HistoryOrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: IconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`${styles["nav-button"]} w-full ${
        active ? "bg-cream-2 text-berry-strong" : ""
      }`}
      onClick={onClick}
    >
      <Icon name={icon} />
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-berry" />
      )}
    </button>
  )
}

function MobileNav({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: IconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`flex min-w-20 flex-col items-center gap-1 text-[10px] font-bold ${
        active ? "text-berry" : "text-muted"
      }`}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  )
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone: "rose" | "green"
}) {
  return (
    <div className="min-w-28 rounded-2xl border border-line bg-paper px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            tone === "rose" ? "bg-berry" : "bg-sage"
          }`}
        />
        <strong className="font-serif text-2xl font-normal">{value}</strong>
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
        {label}
      </p>
    </div>
  )
}

function TableCard({
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
            {table.id.toString().padStart(2, "0")}
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
            <Icon name="users" size={16} /> Seats {table.seats}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sage transition group-hover:bg-sage group-hover:text-white">
            <Icon name="arrow" size={15} />
          </span>
        </div>
      )}
    </button>
  )
}

function TableEditor({
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
      occupants: occupied ? Math.max(1, Math.min(table.seats, occupants)) : 0,
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
              Table {table.id.toString().padStart(2, "0")}
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
                disabled={!occupied || occupants >= table.seats}
                onClick={() =>
                  setOccupants((current) =>
                    Math.min(table.seats, Math.max(1, current) + 1),
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

function OrderHistory({
  filteredOrders,
  totalOrders,
  query,
  setQuery,
  onSelect,
}: {
  filteredOrders: Order[]
  totalOrders: number
  query: string
  setQuery: (value: string) => void
  onSelect: (order: Order) => void
}) {
  return (
    <>
      <section className="mb-8">
        <p className={`${styles["eyebrow"]}`}>Activity</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
          Order history
        </h1>
        <p className="mt-2 text-sm text-muted-2">
          Review current and completed checks from today’s service.
        </p>
      </section>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row">
        <label className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-muted focus-within:border-berry">
          <Icon name="search" size={18} />
          <input
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-placeholder"
            placeholder="Search guest, table or order"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="rounded-xl border border-line bg-paper px-4 py-3 text-left text-xs font-bold sm:text-center">
          Today, May 24
        </button>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <div className="hidden grid-cols-[0.7fr_0.8fr_1.4fr_1.2fr_0.8fr_32px] gap-4 border-b border-line-soft bg-cream-2 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted md:grid">
          <span>Order</span>
          <span>Table</span>
          <span>Guest</span>
          <span>Time</span>
          <span>Total</span>
          <span />
        </div>
        {filteredOrders.map((order) => (
          <button
            aria-label={`View details for order ${order.id}`}
            className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-line-soft px-5 py-5 text-left transition last:border-0 hover:bg-cream-3 focus-visible:bg-cream-3 focus-visible:outline-2 focus-visible:outline-berry focus-visible:outline-offset-[-2px] md:grid-cols-[0.7fr_0.8fr_1.4fr_1.2fr_0.8fr_32px] md:px-6"
            key={order.id}
            onClick={() => onSelect(order)}
          >
            <span className="text-sm font-bold">{order.id}</span>
            <span className="row-start-2 text-xs text-muted-2 md:row-auto md:text-sm md:text-ink">
              {order.table}
            </span>
            <span className="text-sm font-bold md:font-normal">
              {order.guest}
            </span>
            <span className="hidden text-sm text-muted-2 md:block">
              {order.time}
            </span>
            <span className="row-span-2 row-start-1 text-right font-serif text-lg md:row-auto md:text-left">
              ${order.total.toFixed(2)}
            </span>
            <span className="hidden text-placeholder transition group-hover:translate-x-1 group-hover:text-berry md:block">
              <Icon name="chevron" size={18} />
            </span>
          </button>
        ))}
        {filteredOrders.length === 0 && (
          <p className="p-12 text-center text-sm text-muted">
            No orders match your search.
          </p>
        )}
      </div>
      <p className="pb-16 pt-4 text-xs text-muted lg:pb-0">
        Showing {filteredOrders.length} of {totalOrders} orders
      </p>
    </>
  )
}

function KitchenWorkspace({
  orders,
  previousOrders,
  onStatusChange,
}: {
  orders: Order[]
  previousOrders: Order[]
  onStatusChange: (id: string, status: KitchenStatus) => void
}) {
  const [pendingAction, setPendingAction] = useState<{
    order: Order
    status: KitchenStatus
  } | null>(null)
  const preparing = orders.filter(
    (order) => order.kitchenStatus === "Preparing",
  ).length
  const ready = orders.filter((order) => order.kitchenStatus === "Ready").length

  function confirmStatusChange() {
    if (!pendingAction) return
    onStatusChange(pendingAction.order.id, pendingAction.status)
    setPendingAction(null)
  }

  return (
    <>
      <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className={`${styles["eyebrow"]}`}>Kitchen display</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
            Active orders
          </h1>
          <p className="mt-2 text-sm text-muted-2">
            Keep the kitchen moving and let the floor know what’s ready.
          </p>
        </div>
        <div className="flex gap-3">
          <Stat value={preparing.toString().padStart(2, "0")} label="Preparing" tone="rose" />
          <Stat value={ready.toString().padStart(2, "0")} label="Ready" tone="green" />
        </div>
      </section>

      {orders.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {orders.map((order) => (
            <article
              className="overflow-hidden rounded-[22px] border border-line bg-paper"
              key={order.id}
            >
              <div className="flex items-start justify-between border-b border-line-soft px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-3xl">{order.id}</h2>
                    <KitchenStatusPill status={order.kitchenStatus} />
                  </div>
                  <p className="mt-1.5 text-sm font-bold">{order.table}</p>
                  <p className="mt-1 text-xs text-muted">
                    {order.time.replace("Today, ", "")} · {order.server}
                  </p>
                </div>
                <span className="rounded-full bg-cream-2 px-3 py-1.5 text-xs font-bold text-muted-2">
                  {order.items.reduce((sum, item) => sum + item.qty, 0)} items
                </span>
              </div>

              <div className="px-5 py-2 sm:px-6">
                {order.items.map((item) => (
                  <div
                    className="flex items-center gap-3 border-b border-sand py-3.5 last:border-0"
                    key={item.name}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand text-sm font-bold">
                      {item.qty}
                    </span>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-line-soft bg-cream-3 p-4 sm:gap-3">
                <button
                  className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                    order.kitchenStatus === "Preparing"
                      ? "border-[#d59a52] bg-amber-soft text-amber"
                      : "border-[#e5c89f] bg-cream-3 text-amber hover:border-[#d59a52] hover:bg-amber-soft"
                  }`}
                  disabled={order.kitchenStatus === "Preparing"}
                  onClick={() =>
                    setPendingAction({ order, status: "Preparing" })
                  }
                >
                  Prepare
                </button>
                <button
                  className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                    order.kitchenStatus === "Ready"
                      ? "border-sage bg-sage-soft text-sage-strong"
                      : "border-[#bfd0bb] bg-paper text-sage-strong hover:border-sage hover:bg-sage-soft"
                  }`}
                  disabled={order.kitchenStatus === "Ready"}
                  onClick={() => setPendingAction({ order, status: "Ready" })}
                >
                  Ready
                </button>
                <button
                  className="rounded-xl border border-[#dfb9b9] bg-paper px-2 py-3 text-xs font-bold text-danger transition hover:border-berry-strong hover:bg-danger-soft"
                  onClick={() =>
                    setPendingAction({ order, status: "Cancelled" })
                  }
                >
                  Cancel
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-line bg-cream-3 px-6 py-20 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sage-soft text-sage-strong">
            <Icon name="check" size={22} />
          </span>
          <h2 className="mt-4 font-serif text-2xl">Kitchen is all caught up</h2>
          <p className="mt-1 text-sm text-muted">
            New active orders will appear here.
          </p>
        </div>
      )}

      {previousOrders.length > 0 && (
        <section className="mt-10 border-t border-line pt-8">
          <div className="mb-4">
            <p className={`${styles["eyebrow"]}`}>Recently closed</p>
            <h2 className="mt-1 font-serif text-2xl">Previous orders</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {previousOrders.map((order) => (
              <article
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper px-5 py-4"
                key={order.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="font-serif text-xl">{order.id}</p>
                    <KitchenStatusPill status={order.kitchenStatus} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-2">
                    {order.table} · {order.time.replace("Today, ", "")} ·{" "}
                    {order.items.reduce((sum, item) => sum + item.qty, 0)} items
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="h-16 lg:hidden" />

      {pendingAction && (
        <KitchenStatusConfirmation
          order={pendingAction.order}
          status={pendingAction.status}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmStatusChange}
        />
      )}
    </>
  )
}

function KitchenStatusConfirmation({
  order,
  status,
  onCancel,
  onConfirm,
}: {
  order: Order
  status: KitchenStatus
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelled = status === "Cancelled"
  const actionLabel =
    status === "Preparing"
      ? "start preparing"
      : status === "Ready"
        ? "mark as ready"
        : "cancel"

  return (
    <div
      aria-labelledby="kitchen-confirmation-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-5 backdrop-blur-[2px]"
      role="dialog"
    >
      <button
        aria-label="Close confirmation"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-[22px] border border-line bg-paper p-6 shadow-2xl">
        <div
          className={`grid h-11 w-11 place-items-center rounded-full ${
            cancelled
              ? "bg-berry-soft text-berry-strong"
              : "bg-sage-soft text-sage-strong"
          }`}
        >
          <Icon name={cancelled ? "close" : "check"} size={20} />
        </div>
        <p className={`${styles["eyebrow"]} mt-5`}>Double-check</p>
        <h2
          className="mt-2 font-serif text-3xl"
          id="kitchen-confirmation-title"
        >
          {cancelled ? "Cancel this order?" : `Set order to ${status}?`}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-2">
          You’re about to {actionLabel}{" "}
          <strong className="text-ink">{order.id}</strong> for{" "}
          <strong className="text-ink">{order.table}</strong>.
          {cancelled && " It will be removed from the active kitchen queue."}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            className="rounded-xl border border-line bg-white py-3 text-sm font-bold text-ink-soft transition hover:border-placeholder"
            onClick={onCancel}
          >
            Go back
          </button>
          <button
            className={`rounded-xl py-3 text-sm font-bold text-white transition ${
              cancelled
                ? "bg-berry-strong hover:bg-[#9f354b]"
                : "bg-sage-strong hover:bg-sage-strong"
            }`}
            onClick={onConfirm}
          >
            Yes, {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function KitchenStatusPill({ status }: { status: KitchenStatus }) {
  const tones: Record<KitchenStatus, StatusTone> = {
    New: "neutral",
    Preparing: "warning",
    Ready: "success",
    Completed: "info",
    Cancelled: "danger",
  }

  return <StatusPill tone={tones[status]}>{status}</StatusPill>
}

function HistoryOrderDrawer({
  order,
  onClose,
}: {
  order: Order
  onClose: () => void
}) {
  const subtotal = order.total / 1.09
  const tax = order.total - subtotal
  const completed = order.status === "Completed"

  return (
    <>
      <button
        aria-label="Close order details"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        aria-label={`Details for order ${order.id}`}
        className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[460px] sm:p-8`}
      >
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Order details</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="mt-8 flex items-start justify-between border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl">{order.id}</h2>
            <p className="mt-2 text-sm text-muted-2">
              {order.table} · {order.guest}
            </p>
          </div>
          <StatusPill tone={completed ? "success" : "primary"}>
            {order.status}
          </StatusPill>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-4">
          <div>
            <p className={`${styles["detail-label"]}`}>Time</p>
            <p className="mt-1.5 text-xs font-bold">
              {order.time.replace("Today, ", "")}
            </p>
          </div>
          <div>
            <p className={`${styles["detail-label"]}`}>Server</p>
            <p className="mt-1.5 text-xs font-bold">{order.server}</p>
          </div>
          <div>
            <p className={`${styles["detail-label"]}`}>Guests</p>
            <p className="mt-1.5 text-xs font-bold">{order.guests}</p>
          </div>
        </div>

        <div className="mt-9">
          <div className="mb-3 flex items-center justify-between">
            <p className={`${styles["detail-label"]}`}>Items</p>
            <p className="text-xs text-muted">
              {order.items.reduce((sum, item) => sum + item.qty, 0)} items
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line-soft">
            {order.items.map((item) => (
              <div
                className="flex items-center justify-between border-b border-line-soft px-4 py-4 last:border-0"
                key={item.name}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-sand text-xs font-bold">
                    {item.qty}
                  </span>
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                <span className="text-sm">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
          <div className="flex justify-between text-muted-2">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-2">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 font-serif text-2xl">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-7 rounded-2xl bg-cream-2 p-4">
          <p className={`${styles["detail-label"]}`}>
            {completed ? "Payment" : "Payment status"}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold">
            {completed && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-sage text-white">
                <Icon name="check" size={12} />
              </span>
            )}
            {order.payment}
          </div>
        </div>

        <button
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-3.5 text-sm font-bold transition hover:border-berry hover:text-berry-strong"
          onClick={onClose}
        >
          Close details
        </button>
      </aside>
    </>
  )
}

function ReservationWorkspace({
  reservations,
  onCreate,
  onCancel,
}: {
  reservations: Reservation[]
  onCreate: (reservation: Omit<Reservation, "id" | "status">) => void
  onCancel: (id: number) => void
}) {
  const [reservationView, setReservationView] = useState<"upcoming" | "past">(
    "upcoming",
  )
  const [creating, setCreating] = useState(false)
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null)
  const visibleReservations = reservations.filter(
    (reservation) =>
      reservationView === "upcoming"
        ? reservation.status === "upcoming"
        : reservation.status !== "upcoming",
  )

  return (
    <>
      <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className={`${styles["eyebrow"]}`}>Guest book</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
            Reservations
          </h1>
          <p className="mt-2 text-sm text-muted-2">
            Manage arrivals and keep every booking organized.
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-berry px-5 py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
          onClick={() => setCreating(true)}
        >
          <span className="text-xl font-normal leading-none">+</span>
          New reservation
        </button>
      </section>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-fit rounded-full border border-line bg-line-soft p-1">
          {(["upcoming", "past"] as const).map((option) => (
            <button
              className={`rounded-full px-5 py-2 text-xs font-bold capitalize transition ${
                reservationView === option
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted-2 hover:text-ink"
              }`}
              key={option}
              onClick={() => setReservationView(option)}
            >
              {option} (
              {
                reservations.filter((reservation) =>
                  option === "upcoming"
                    ? reservation.status === "upcoming"
                    : reservation.status !== "upcoming",
                ).length
              }
              )
            </button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">
          {reservationView === "upcoming"
            ? "Next seating · 7:30 PM"
            : "Reservation archive"}
        </p>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.8fr] gap-4 border-b border-line-soft bg-cream-2 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted md:grid">
          <span>Guest</span>
          <span>Date</span>
          <span>Time</span>
          <span>Party</span>
          <span>Table</span>
        </div>
        {visibleReservations.map((reservation) => (
          <button
            aria-label={`View reservation for ${reservation.guest}`}
            className="group grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-b border-line-soft px-5 py-5 text-left transition last:border-0 hover:bg-cream-3 focus-visible:bg-cream-3 focus-visible:outline-2 focus-visible:outline-berry focus-visible:outline-offset-[-2px] md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.8fr] md:items-center md:gap-4 md:px-6"
            key={reservation.id}
            onClick={() => setSelectedReservation(reservation)}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{reservation.guest}</p>
                {reservation.status === "cancelled" && (
                  <span className="rounded-full bg-sand px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-muted-2">
                    Cancelled
                  </span>
                )}
              </div>
              {reservation.notes && (
                <p className="mt-1 text-xs text-muted">
                  {reservation.notes}
                </p>
              )}
            </div>
            <span className="row-start-2 text-xs text-muted-2 md:row-auto md:text-sm">
              {reservation.date}
            </span>
            <span className="row-start-2 font-serif text-lg md:row-auto">
              {reservation.time}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-ink-mid md:text-sm">
              <Icon name="users" size={15} />
              {reservation.guests} guests
            </span>
            <span className="text-right text-xs text-muted-2 md:text-left">
              {reservation.table ?? "Unassigned"}
            </span>
          </button>
        ))}
      </div>
      <p className="pb-16 pt-4 text-xs text-muted lg:pb-0">
        Showing {visibleReservations.length} {reservationView} reservations
      </p>

      {creating && (
        <NewReservationDrawer
          onClose={() => setCreating(false)}
          onCreate={(reservation) => {
            onCreate(reservation)
            setReservationView("upcoming")
            setCreating(false)
          }}
        />
      )}
      {selectedReservation && (
        <ReservationDetailDrawer
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onCancel={() => {
            onCancel(selectedReservation.id)
            setSelectedReservation(null)
            setReservationView("past")
          }}
        />
      )}
    </>
  )
}

function NewReservationDrawer({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (reservation: Omit<Reservation, "id" | "status">) => void
}) {
  const [guest, setGuest] = useState("")
  const [date, setDate] = useState("Today")
  const [time, setTime] = useState("7:30 PM")
  const [guests, setGuests] = useState(2)
  const [table, setTable] = useState("")
  const [notes, setNotes] = useState("")

  function submitReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!guest.trim()) return
    onCreate({
      guest: guest.trim(),
      date,
      time,
      guests,
      table: table || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const fieldClass =
    "mt-2.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-berry focus:ring-2 focus:ring-berry/10"

  return (
    <>
      <button
        aria-label="Close new reservation"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[460px] sm:p-8`}>
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>New booking</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="mt-8 border-b border-line pb-7">
          <h2 className="font-serif text-4xl">Create reservation</h2>
          <p className="mt-2 text-sm text-muted-2">
            Add the guest’s details and seating preferences.
          </p>
        </div>

        <form className="mt-7 space-y-6" onSubmit={submitReservation}>
          <label className="block">
            <span className={`${styles["detail-label"]}`}>Guest or party name</span>
            <input
              autoFocus
              className={fieldClass}
              onChange={(event) => setGuest(event.target.value)}
              placeholder="Enter guest name"
              required
              value={guest}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={`${styles["detail-label"]}`}>Date</span>
              <select
                className={fieldClass}
                onChange={(event) => setDate(event.target.value)}
                value={date}
              >
                <option>Today</option>
                <option>Tomorrow</option>
                <option>Saturday, May 26</option>
                <option>Sunday, May 27</option>
              </select>
            </label>
            <label className="block">
              <span className={`${styles["detail-label"]}`}>Time</span>
              <input
                className={fieldClass}
                onChange={(event) => setTime(event.target.value)}
                placeholder="7:30 PM"
                required
                value={time}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className={`${styles["detail-label"]}`}>Guests</span>
              <span className="text-xs text-muted">Party size</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line bg-white p-2">
              <button
                aria-label="Decrease guests"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl transition hover:bg-line-soft disabled:opacity-40"
                disabled={guests <= 1}
                onClick={() => setGuests((current) => Math.max(1, current - 1))}
                type="button"
              >
                −
              </button>
              <strong className="font-serif text-2xl font-normal">
                {guests}
              </strong>
              <button
                aria-label="Increase guests"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl transition hover:bg-line-soft"
                onClick={() => setGuests((current) => current + 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <label className="block">
            <span className={`${styles["detail-label"]}`}>Table</span>
            <select
              className={fieldClass}
              onChange={(event) => setTable(event.target.value)}
              value={table}
            >
              <option value="">Unassigned</option>
              {tables.map((item) => (
                <option key={item.id}>Table {item.id}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={`${styles["detail-label"]}`}>Notes</span>
            <textarea
              className={`${fieldClass} min-h-24 resize-none`}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Dietary needs, occasion, seating preference..."
              value={notes}
            />
          </label>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-berry py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
            type="submit"
          >
            <Icon name="check" size={16} />
            Create reservation
          </button>
        </form>
      </aside>
    </>
  )
}

function ReservationDetailDrawer({
  reservation,
  onClose,
  onCancel,
}: {
  reservation: Reservation
  onClose: () => void
  onCancel: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const isUpcoming = reservation.status === "upcoming"
  const isCancelled = reservation.status === "cancelled"

  return (
    <>
      <button
        aria-label="Close reservation details"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[440px] sm:p-8`}>
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Reservation details</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="mt-8 flex items-start justify-between border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl">{reservation.guest}</h2>
            <p className="mt-2 text-sm text-muted-2">
              {reservation.date} · {reservation.time}
            </p>
          </div>
          <StatusPill tone={isCancelled ? "danger" : "success"}>
            {isCancelled ? "Cancelled" : isUpcoming ? "Upcoming" : "Completed"}
          </StatusPill>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-cream-2 p-4">
            <p className={`${styles["detail-label"]}`}>Party size</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold">
              <Icon name="users" size={16} />
              {reservation.guests} guests
            </p>
          </div>
          <div className="rounded-2xl bg-cream-2 p-4">
            <p className={`${styles["detail-label"]}`}>Table</p>
            <p className="mt-2 text-sm font-bold">
              {reservation.table ?? "Unassigned"}
            </p>
          </div>
        </div>

        {reservation.notes && (
          <div className="mt-6 rounded-2xl border border-line-soft bg-white p-4">
            <p className={`${styles["detail-label"]}`}>Guest notes</p>
            <p className="mt-2 text-sm leading-6 text-ink-mid">
              {reservation.notes}
            </p>
          </div>
        )}

        {isUpcoming && !confirming && (
          <button
            className="mt-8 w-full rounded-xl border border-[#d7aab2] bg-white py-3.5 text-sm font-bold text-berry-strong transition hover:bg-berry-soft"
            onClick={() => setConfirming(true)}
          >
            Cancel reservation
          </button>
        )}

        {isUpcoming && confirming && (
          <div className="mt-8 rounded-2xl border border-[#e4bdc4] bg-berry-soft p-5">
            <p className="text-sm font-bold text-[#9f394d]">
              Cancel this reservation?
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-2">
              It will be removed from Upcoming and moved to the Past list as
              cancelled.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-line bg-white py-3 text-xs font-bold"
                onClick={() => setConfirming(false)}
              >
                Keep booking
              </button>
              <button
                className="rounded-xl bg-berry-strong py-3 text-xs font-bold text-white transition hover:bg-[#9f394d]"
                onClick={onCancel}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        )}

        {!isUpcoming && (
          <button
            className="mt-8 w-full rounded-xl border border-line bg-white py-3.5 text-sm font-bold transition hover:border-berry hover:text-berry-strong"
            onClick={onClose}
          >
            Close details
          </button>
        )}
      </aside>
    </>
  )
}

export default App
