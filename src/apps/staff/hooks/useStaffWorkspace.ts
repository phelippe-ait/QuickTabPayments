import { useEffect, useMemo, useState } from "react"
import { initialReservations } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table } from "../types"
import { supabase } from "@shared/lib/supabase"
import { toHistoryOrder } from "../data/orderHistory"
import { fetchStaffTables } from "../services/staffTables"
import {
  fetchStaffOrders,
  mapStaffOrder,
  updateStaffOrderStatus,
} from "../services/staffOrders"

/**
 * Staff workspace data. The signed-in member's restaurant id comes from the
 * auth gate (`RestaurantProvider`), so every query resolves the same
 * restaurant — no ad-hoc slug lookups.
 */
export function useStaffWorkspace(restaurantId: string | null) {
  const [tableList, setTableList] = useState<Table[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [reservations, setReservations] = useState<Reservation[]>(
    initialReservations,
  )

  // Live kitchen board: poll every 5s. Unpaid (`pending`) orders are filtered
  // out by the query, so the kitchen only ever acts on paid orders.
  useEffect(() => {
    if (!restaurantId) {
      setOrdersLoading(false)
      setTablesLoading(false)
      setOrdersError("No active staff restaurant found")
      return
    }

    let cancelled = false
    let loading = false
    let interval: ReturnType<typeof setInterval> | undefined

    async function loadOrders(id: string) {
      if (cancelled || loading) return
      loading = true
      try {
        const rows = await fetchStaffOrders(id)
        if (!cancelled) {
          setOrders(rows.map(mapStaffOrder))
          setOrdersError(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load staff orders:", error)
          setOrdersError(
            error instanceof Error ? error.message : "Unable to load orders",
          )
        }
      } finally {
        loading = false
        if (!cancelled) setOrdersLoading(false)
      }
    }

    async function loadTables(id: string) {
      try {
        const rows = await fetchStaffTables(id)
        if (cancelled) return
        setTableList(
          rows.map((row) => ({
            id: row.id,
            tableNumber: row.table_number,
            locationLabel: row.location_label,
            seats: row.seats ?? undefined,
            occupants: 0,
            status: "available" as const,
          })),
        )
        setTablesError(null)
      } catch (error) {
        console.error("Failed to load staff tables:", error)
        if (!cancelled) {
          setTablesError(
            error instanceof Error ? error.message : "Unable to load tables",
          )
        }
      } finally {
        if (!cancelled) setTablesLoading(false)
      }
    }

    void (async () => {
      await Promise.all([loadOrders(restaurantId), loadTables(restaurantId)])
      if (cancelled) return
      interval = setInterval(() => {
        void loadOrders(restaurantId)
      }, 5000)
    })()

    return () => {
      cancelled = true
      if (interval !== undefined) clearInterval(interval)
    }
  }, [restaurantId])

  // Order history + Realtime. Assigning the channel synchronously means the
  // cleanup always removes it, even under React StrictMode double-mounting.
  useEffect(() => {
    if (!restaurantId) {
      setHistoryLoading(false)
      setHistoryError("No active staff restaurant found")
      return
    }
    if (!supabase) {
      setHistoryError("Supabase is not configured.")
      setHistoryLoading(false)
      return
    }

    const client = supabase
    let active = true

    const loadOrders = async () => {
      const { data, error } = await client
        .from("orders")
        .select(
          "id, restaurant_id, table_id, customer_id, customer_name_snapshot, order_number, status, subtotal, tax, total, tip_amount, notes, pickup_time_estimate, tracking_token, created_at, updated_at, completed_at, tables(table_number), payments(status, payment_method_type)",
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(100)

      if (!active) return
      if (error) {
        console.error("Could not load order history", error)
        setHistoryError(
          "Could not load recent orders. Check your staff access and try again.",
        )
      } else {
        setHistoryOrders((data ?? []).map(toHistoryOrder))
        setHistoryError(null)
      }
      setHistoryLoading(false)
    }

    void loadOrders().catch((error: unknown) => {
      if (!active) return
      console.error("Could not load order history", error)
      setHistoryError(
        "Could not load recent orders. Check your connection and try again.",
      )
      setHistoryLoading(false)
    })

    const channel = client
      .channel(`staff-order-history-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void loadOrders()
        },
      )
      .subscribe()

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [restaurantId])

  const activeKitchenOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.kitchenStatus !== "Completed" &&
          order.kitchenStatus !== "Cancelled",
      ),
    [orders],
  )
  const previousKitchenOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.kitchenStatus === "Completed" ||
            order.kitchenStatus === "Cancelled",
        )
        .slice(0, 2),
    [orders],
  )

  const updateTable = (updatedTable: Table) => {
    setTableList((current) =>
      current.map((table) =>
        table.id === updatedTable.id ? updatedTable : table,
      ),
    )
  }

  const createReservation = (
    reservation: Omit<Reservation, "id" | "status">,
  ) => {
    setReservations((current) => [
      { ...reservation, id: Date.now(), status: "upcoming" },
      ...current,
    ])
  }

  const cancelReservation = (id: number) => {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? { ...reservation, status: "cancelled" }
          : reservation,
      ),
    )
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
      if (!restaurantId) throw new Error("No active staff restaurant found")

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
    } catch (error) {
      console.error("Failed to update order status:", error)
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Could not update the order. Please try again.",
      )
    }
  }

  return {
    tableList,
    tablesLoading,
    tablesError,
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
