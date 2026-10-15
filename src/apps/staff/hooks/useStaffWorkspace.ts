import { useMemo, useState } from "react"
import { initialReservations, orderHistory, tables } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table } from "../types"

export function useStaffWorkspace() {
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [orders, setOrders] = useState<Order[]>(orderHistory)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)

  const activeKitchenOrders = useMemo(
    () => orders.filter((order) => order.kitchenStatus !== "Completed" && order.kitchenStatus !== "Cancelled"),
    [orders],
  )
  const previousKitchenOrders = useMemo(
    () => orders.filter((order) => order.kitchenStatus === "Completed" || order.kitchenStatus === "Cancelled").slice(0, 2),
    [orders],
  )

  const updateTable = (updatedTable: Table) => {
    setTableList((current) => current.map((table) => table.id === updatedTable.id ? updatedTable : table))
  }

  const createReservation = (reservation: Omit<Reservation, "id" | "status">) => {
    setReservations((current) => [{ ...reservation, id: Date.now(), status: "upcoming" }, ...current])
  }

  const cancelReservation = (id: number) => {
    setReservations((current) => current.map((reservation) => reservation.id === id ? { ...reservation, status: "cancelled" } : reservation))
  }

  const updateKitchenStatus = (id: string, kitchenStatus: KitchenStatus) => {
    setOrders((current) => current.map((order) => order.id === id
      ? { ...order, kitchenStatus, status: kitchenStatus === "Cancelled" ? "Cancelled" : order.status }
      : order))
  }

  return {
    tableList,
    orders,
    reservations,
    activeKitchenOrders,
    previousKitchenOrders,
    updateTable,
    createReservation,
    cancelReservation,
    updateKitchenStatus,
  }
}
