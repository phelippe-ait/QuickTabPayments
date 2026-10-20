import { useMemo, useState } from "react"
import { useStaffWorkspace } from "./hooks/useStaffWorkspace"
import { StaffShell } from "./components/StaffShell"
import { TableEditor, TablesWorkspace } from "./features/tables/TablesWorkspace"
import { KitchenWorkspace } from "./features/kitchen/KitchenWorkspace"
import { HistoryOrderDrawer, OrderHistory } from "./features/orders/OrderHistory"
import { ReservationWorkspace } from "./features/reservations/ReservationWorkspace"
import type { Order, Table, TableStatus, View } from "./types"

export default function App() {
  const [view, setView] = useState<View>("tables")
  const [filter, setFilter] = useState<"all" | TableStatus>("all")
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [query, setQuery] = useState("")
  const workspace = useStaffWorkspace()

  const filteredTables = useMemo(
    () => workspace.tableList.filter((table) => filter === "all" || table.status === filter),
    [filter, workspace.tableList],
  )
  const filteredOrders = useMemo(() => {
    const term = query.toLowerCase()
    return workspace.orders.filter((order) =>
      [order.id, order.table, order.guest, order.status].some((value) => value.toLowerCase().includes(term)),
    )
  }, [workspace.orders, query])
  const occupied = workspace.tableList.filter((table) => table.status === "occupied").length

  const saveTable = (table: Table) => {
    workspace.updateTable(table)
    setSelectedTable(null)
  }

  return (
    <StaffShell view={view} onViewChange={setView}>
      {view === "tables" && <TablesWorkspace
        tableList={workspace.tableList}
        filteredTables={filteredTables}
        occupied={occupied}
        filter={filter}
        selectedTable={selectedTable}
        onFilterChange={setFilter}
        onSelectTable={setSelectedTable}
      />}
      {view === "kitchen" && <KitchenWorkspace
  orders={workspace.activeKitchenOrders}
  previousOrders={workspace.previousKitchenOrders}
  onStatusChange={workspace.updateKitchenStatus}
  ordersLoading={workspace.ordersLoading}
  ordersError={workspace.ordersError}
/>}
      {view === "history" && <OrderHistory
        filteredOrders={filteredOrders}
        totalOrders={workspace.orders.length}
        query={query}
        setQuery={setQuery}
        onSelect={setSelectedOrder}
      />}
      {view === "reservations" && <ReservationWorkspace
        reservations={workspace.reservations}
        onCreate={workspace.createReservation}
        onCancel={workspace.cancelReservation}
      />}

      {selectedTable && view === "tables" && <TableEditor
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        onSave={saveTable}
      />}
      {selectedOrder && view === "history" && <HistoryOrderDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />}
    </StaffShell>
  )
}
