import { initialReservations, tables } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table } from "../types"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../../shared/lib/supabase"
import {
  fetchMyStaffRestaurantId,
  fetchStaffOrders,
  mapStaffOrder,
  updateStaffOrderStatus,
} from "../services/staffOrders"



export function useStaffWorkspace() {
  
  useEffect(() => {
  async function testConnection() {
    if (!supabase) {
      console.error("Supabase is not configured")
      return
    }

    const { data, error } = await supabase.auth.getUser()

    if (error) {
      console.error("Supabase authentication:", error.message)
    } else {
      console.log("Supabase connection test:", data.user?.id ?? "No authenticated user")
    }
  }

  void testConnection()
}, [])
  
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [orders, setOrders] = useState<Order[]>([])
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [ordersLoading, setOrdersLoading] = useState(true)
const [ordersError, setOrdersError] = useState<string | null>(null)


useEffect(() => {
  let cancelled = false
  let loading = false
  let interval: ReturnType<typeof setInterval> | undefined

  
async function loadOrders(restaurantId: string) {
  if (cancelled || loading) return

  loading = true

  try {
    const rows = await fetchStaffOrders(restaurantId)

    if (!cancelled) {
      setOrders(rows.map(mapStaffOrder))
      setOrdersError(null)
    }
  } catch (error) {
    if (!cancelled) {
      console.error("Failed to load staff orders:", error)
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Unable to load orders",
      )
    }
  } finally {
    loading = false

    if (!cancelled) {
      setOrdersLoading(false)
    }
  }
}


  async function startPolling() {

    
    try {
      const restaurantId = await fetchMyStaffRestaurantId()

      if (cancelled) return

      if (!restaurantId) {
  setOrdersError("No active staff restaurant found")
  setOrdersLoading(false)
  return
}

      await loadOrders(restaurantId)

      if (cancelled) return

      interval = setInterval(() => {
        void loadOrders(restaurantId)
      }, 5000)
    } catch (error) {
  if (!cancelled) {
    console.error("Failed to start staff orders polling:", error)

    setOrdersError(
      error instanceof Error
        ? error.message
        : "Unable to connect to restaurant",
    )
    setOrdersLoading(false)
  }
}
  }
  void startPolling()

  return () => {
    cancelled = true

    if (interval !== undefined) {
      clearInterval(interval)
    }
  }
}, [])


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

  
const updateKitchenStatus = async (
  id: string,
  kitchenStatus: KitchenStatus,
) => {
  const statusMap = {
  Preparing: "preparing",
  Ready: "ready",
  Completed: "completed",
  Cancelled: "cancelled",
} as const

 if (
  kitchenStatus !== "Preparing" &&
  kitchenStatus !== "Ready" &&
  kitchenStatus !== "Completed" &&
  kitchenStatus !== "Cancelled"
) {
  return
}

  try {
    const restaurantId = await fetchMyStaffRestaurantId()

    if (!restaurantId) {
      throw new Error("No active staff restaurant found")
    }

    await updateStaffOrderStatus(
      restaurantId,
      id,
      statusMap[kitchenStatus],
    )

    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? {
              ...order,
              kitchenStatus,
              status:
  kitchenStatus === "Cancelled"
    ? "Cancelled"
    : kitchenStatus === "Completed"
      ? "Completed"
      : "In progress",
            }
          : order,
      ),
    )

    console.log("Order status saved:", id, kitchenStatus)
  } catch (error) {
    console.error("Failed to update order status:", error)
    window.alert(
      "Could not update the order. Please try again.",
    )
  }
}


  return {
    tableList,
    orders,
    ordersLoading,
  ordersError,
    reservations,
    activeKitchenOrders,
    previousKitchenOrders,
    updateTable,
    createReservation,
    cancelReservation,
    updateKitchenStatus,
  }
}
