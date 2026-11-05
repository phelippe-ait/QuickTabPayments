import { useEffect, useMemo, useState } from "react"
import { useStaffWorkspace } from "./hooks/useStaffWorkspace"
import { StaffShell } from "./components/StaffShell"
import { TableEditor, TablesWorkspace } from "./features/tables/TablesWorkspace"
import { KitchenWorkspace } from "./features/kitchen/KitchenWorkspace"
import { HistoryOrderDrawer, OrderHistory } from "./features/orders/OrderHistory"
import { ReservationWorkspace } from "./features/reservations/ReservationWorkspace"
import type { Order, Table, TableStatus, View } from "./types"
import { useAuth } from "@shared/auth/AuthContext"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { AdminErrorBoundary } from "../admin/components/AdminErrorBoundary"
import { RequireRole } from "../admin/components/RequireRole"
import { RestaurantProvider } from "@shared/restaurant/RestaurantProvider"
import { RequireStaff } from "@shared/auth/RequireStaff"
import { roleLabels } from "@shared/restaurant/restaurantHelpers"
import { RESERVATIONS_ENABLED } from "./flags"

const ANY_STAFF = ["owner", "manager", "kitchen"] as const

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
  const [view, setView] = useState<View>("tables")
  const [filter, setFilter] = useState<"all" | TableStatus>("all")
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [query, setQuery] = useState("")
  const restaurantId = membership?.restaurantId ?? null
  const workspace = useStaffWorkspace(restaurantId)

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Staff member"

  // A stale "reservations" view must never reveal the hidden workspace.
  useEffect(() => {
    if (!RESERVATIONS_ENABLED && view === "reservations") setView("tables")
  }, [view])

  const filteredTables = useMemo(
    () =>
      workspace.tableList.filter(
        (table) => filter === "all" || table.status === filter,
      ),
    [filter, workspace.tableList],
  )
  const filteredOrders = useMemo(() => {
    const term = query.toLowerCase()
    return workspace.historyOrders.filter((order) =>
      [order.id, order.table, order.guest, order.status].some((value) =>
        value.toLowerCase().includes(term),
      ),
    )
  }, [workspace.historyOrders, query])
  const occupied = workspace.tableList.filter(
    (table) => table.status === "occupied",
  ).length
  const currency = restaurant?.currency ?? "AUD"

  const saveTable = (table: Table) => {
    workspace.updateTable(table)
    setSelectedTable(null)
  }

  return (
    <StaffShell
      view={view}
      onViewChange={setView}
      userName={userName}
      restaurantName={restaurant?.name ?? "Your restaurant"}
      roleLabel={role ? roleLabels[role] : ""}
      onSignOut={() => void signOut()}
      serviceHealthy={!workspace.ordersError}
    >
      {view === "tables" && (
        <TablesWorkspace
          userName={userName}
          tableList={workspace.tableList}
          filteredTables={filteredTables}
          occupied={occupied}
          filter={filter}
          selectedTable={selectedTable}
          onFilterChange={setFilter}
          onSelectTable={setSelectedTable}
          currency={currency}
          isLoading={workspace.tablesLoading}
          error={workspace.tablesError}
        />
      )}
      {view === "kitchen" && (
        <KitchenWorkspace
          orders={workspace.activeKitchenOrders}
          previousOrders={workspace.previousKitchenOrders}
          onStatusChange={workspace.updateKitchenStatus}
          ordersLoading={workspace.ordersLoading}
          ordersError={workspace.ordersError}
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
      {selectedOrder && view === "history" && (
        <HistoryOrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          currency={currency}
        />
      )}
    </StaffShell>
  )
}
