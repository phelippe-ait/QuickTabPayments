import { useEffect, useMemo, useState } from "react"
import { initialReservations } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table } from "../types"
import { supabase } from "@shared/lib/supabase"
import { toHistoryOrder } from "../data/orderHistory"
import { fetchStaffTables } from "../services/staffTables"
import {
  fetchMyStaffRestaurantId,
  fetchStaffOrders,
  mapStaffOrder,
  updateStaffOrderStatus,
} from "../services/staffOrders"

const restaurantSlug =
  import.meta.env.VITE_RESTAURANT_SLUG || "quicktab-demo-cafe"

export function useStaffWorkspace() {
  const [tableList, setTableList] = useState<Table[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
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


async function loadTables(restaurantId: string) {
  try {
    const rows = await fetchStaffTables(restaurantId)

    if (cancelled) return

    setTableList(
      rows.map((row) => ({
        id: row.id,
        tableNumber: row.table_number,
        locationLabel: row.location_label,
        occupants: 0,
        status: "available" as const,
      })),
    )
  } catch (error) {
    console.error("Failed to load staff tables:", error)
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

      await Promise.all([
  loadOrders(restaurantId),
  loadTables(restaurantId),
])

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


  useEffect(() => {
    let active = true

    const loadHistory = async () => {
      if (!supabase) {
        setHistoryError("Supabase is not configured.")
        setHistoryLoading(false)
        return
      }
      const client = supabase

      const { data: restaurant, error: restaurantError } = await client
        .from("restaurants")
        .select("id")
        .eq("slug", restaurantSlug)
        .eq("is_active", true)
        .single()

      if (restaurantError || !restaurant) {
        if (!active) return
        setHistoryError("Could not find the configured restaurant.")
        setHistoryLoading(false)
        return
      }

      const loadOrders = async () => {
        const { data, error } = await client
          .from("orders")
          .select("id, restaurant_id, table_id, customer_id, order_number, status, subtotal, tax, total, notes, pickup_time_estimate, created_at, updated_at, completed_at")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(100)

        if (!active) return
        if (error) {
          console.error("Could not load order history", error)
          setHistoryError("Could not load recent orders. Check your staff access and try again.")
        } else {
          setHistoryOrders((data ?? []).map(toHistoryOrder))
          setHistoryError(null)
        }
        setHistoryLoading(false)
      }

      await loadOrders()
      if (!active) return
      const channel = client
        .channel(`staff-order-history-${restaurant.id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        }, () => { void loadOrders() })
        .subscribe()

      return () => { void client.removeChannel(channel) }
    }

    let removeSubscription: (() => void) | undefined
    void loadHistory().then((remove) => { removeSubscription = remove }).catch((error: unknown) => {
      if (!active) return
      console.error("Could not load order history", error)
      setHistoryError("Could not load recent orders. Check your connection and try again.")
      setHistoryLoading(false)
    })

    return () => {
      active = false
      removeSubscription?.()
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
    historyOrders,
    historyLoading,
    historyError,
    reservations,
    activeKitchenOrders,
    previousKitchenOrders,
    updateTable,
    createReservation,
    cancelReservation,
    updateKitchenStatus,
  }
}
