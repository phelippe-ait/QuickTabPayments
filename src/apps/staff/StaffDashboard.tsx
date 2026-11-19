import { useEffect, useMemo, useState } from "react"
import { useStaffWorkspace } from "./hooks/useStaffWorkspace"
import { StaffShell } from "./components/StaffShell"
import { TableEditor, TablesWorkspace } from "./features/tables/TablesWorkspace"
import { KitchenWorkspace } from "./features/kitchen/KitchenWorkspace"
import { HistoryOrderDrawer, OrderHistory } from "./features/orders/OrderHistory"
import { ReservationWorkspace } from "./features/reservations/ReservationWorkspace"
import { NewOrderWorkspace } from "./features/newOrder/NewOrderWorkspace"
import type { Order, Table, TableStatus, View } from "./types"
import { useAuth } from "@shared/auth/AuthContext"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { AdminErrorBoundary } from "../admin/components/AdminErrorBoundary"
import { RequireRole } from "../admin/components/RequireRole"
import { RestaurantProvider } from "@shared/restaurant/RestaurantProvider"
import { RequireStaff } from "@shared/auth/RequireStaff"
import { roleLabels } from "@shared/restaurant/restaurantHelpers"
import { RESERVATIONS_ENABLED } from "./flags"

const ANY_STAFF = ["owner", "manager", "staff", "kitchen"] as const

export default function App() {
  return (
    <AdminErrorBoundary>
      <RestaurantProvider>
        <RequireStaff variant="staff" redirectTo="/staff">
          <RequireRole
            roles={[...ANY_STAFF]}
            fallbackTo="/staff"
            fallbackLabel="Back to workspace"
          >
            <StaffWorkspace />
          </RequireRole>
        </RequireStaff>
      </RestaurantProvider>
    </AdminErrorBoundary>
  )
}

function StaffWorkspace() {
  const { membership, restaurant, role } = useRestaurant()
  const { user, profile, signOut } = useAuth()
  const [view, setView] = useState<View>(() =>
    role === "kitchen" ? "kitchen" : "tables",
  )
  const [filter, setFilter] = useState<"all" | TableStatus>("all")
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [query, setQuery] = useState("")
  const restaurantId = membership?.restaurantId ?? null
  const workspace = useStaffWorkspace(restaurantId)

  // Keep an open history drawer live: payment/status updates replace the
  // snapshot captured when the row was clicked.
  const liveSelectedOrder = useMemo(
    () =>
      selectedOrder
        ? (workspace.historyOrders.find(
            (order) => order.databaseId === selectedOrder.databaseId,
          ) ?? selectedOrder)
        : null,
    [selectedOrder, workspace.historyOrders],
  )

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Staff member"

  // A stale "reservations" view must never reveal the hidden workspace.
  useEffect(() => {
    if (!RESERVATIONS_ENABLED && view === "reservations") setView("tables")
  }, [view])

  // Kitchen accounts only get the kitchen board and order history.
  useEffect(() => {
    if (
      role === "kitchen" &&
      view !== "kitchen" &&
      view !== "history"
    ) {
      setView("kitchen")
    }
  }, [role, view])

  // The counter / pick-up point is a service point, not a seat. It stays
  // available to New order but never appears on the floor plan.
  const staffTables = useMemo(
    () => workspace.tableList.filter((table) => !table.isSystem),
    [workspace.tableList],
  )
  const filteredTables = useMemo(
    () =>
      staffTables.filter(
        (table) => filter === "all" || table.status === filter,
      ),
    [filter, staffTables],
  )
  const filteredOrders = useMemo(() => {
    const term = query.toLowerCase()
    return workspace.historyOrders.filter((order) =>
      [order.id, order.table, order.guest, order.status].some((value) =>
        value.toLowerCase().includes(term),
      ),
    )
  }, [workspace.historyOrders, query])
  const occupied = staffTables.filter(
    (table) => table.status === "occupied",
  ).length
  const currency = restaurant?.currency ?? "AUD"

  const saveTable = (table: Table) => {
    const statusChanged =
      selectedTable !== null && table.status !== selectedTable.status
    workspace.updateTable(table)
    // The guest name is derived from the table's latest open order; only the
    // operational status is a staff-owned field that needs persisting here.
    if (statusChanged) {
      void workspace.updateTableStatus(String(table.id), table.status)
    }
    setSelectedTable(null)
  }

  return (
    <StaffShell
      view={view}
      onViewChange={setView}
      userName={userName}
      restaurantName={restaurant?.name ?? "Your restaurant"}
      role={role ?? "staff"}
      roleLabel={role ? roleLabels[role] : ""}
      onSignOut={() => void signOut()}
      connectionState={workspace.connectionState}
    >
      {view === "tables" && (
        <TablesWorkspace
          userName={userName}
          tableList={staffTables}
          filteredTables={filteredTables}
          occupied={occupied}
          filter={filter}
          selectedTable={selectedTable}
          onFilterChange={setFilter}
          onSelectTable={setSelectedTable}
          onTableStatusChange={workspace.updateTableStatus}
          updatingTableIds={workspace.tableStatusUpdating}
          currency={currency}
          isLoading={workspace.tablesLoading}
          error={workspace.tablesError}
        />
      )}
      {view === "new-order" && (
        <NewOrderWorkspace
          restaurantId={restaurantId}
          currency={currency}
          taxRate={restaurant?.tax_rate ?? 0}
          tables={workspace.tableList}
          onOrderCreated={workspace.refreshWorkspace}
          onViewKitchen={() => setView("kitchen")}
        />
      )}
      {view === "kitchen" && (
        <KitchenWorkspace
          orders={workspace.activeKitchenOrders}
          previousOrders={workspace.previousKitchenOrders}
          onStatusChange={workspace.updateKitchenStatus}
          ordersLoading={workspace.ordersLoading}
          ordersError={workspace.ordersError}
          sound={workspace.sound}
          unseenOrderIds={workspace.unseenOrderIds}
          onOrderSeen={workspace.markOrderSeen}
        />
      )}
      {view === "history" && (
        <OrderHistory
          filteredOrders={filteredOrders}
          totalOrders={workspace.historyOrders.length}
          isLoading={workspace.historyLoading}
          error={workspace.historyError}
          query={query}
          setQuery={setQuery}
          onSelect={setSelectedOrder}
          currency={currency}
        />
      )}
      {RESERVATIONS_ENABLED && view === "reservations" && (
        <ReservationWorkspace
          reservations={workspace.reservations}
          onCreate={workspace.createReservation}
          onCancel={workspace.cancelReservation}
        />
      )}

      {selectedTable && view === "tables" && (
        <TableEditor
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onSave={saveTable}
        />
      )}
      {liveSelectedOrder && view === "history" && (
        <HistoryOrderDrawer
          order={liveSelectedOrder}
          onClose={() => setSelectedOrder(null)}
          currency={currency}
        />
      )}
    </StaffShell>
  )
}
