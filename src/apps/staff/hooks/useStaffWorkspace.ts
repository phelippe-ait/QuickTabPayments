import { useEffect, useMemo, useState } from "react"
import { initialReservations, orderHistory, tables } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table } from "../types"
import { supabase } from "@shared/lib/supabase"
import { toHistoryOrder } from "../data/orderHistory"

const restaurantSlug = import.meta.env.VITE_RESTAURANT_SLUG || "quicktab-demo-cafe"

export function useStaffWorkspace() {
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [orders, setOrders] = useState<Order[]>(orderHistory)
  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)

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

  const updateKitchenStatus = (id: string, kitchenStatus: KitchenStatus) => {
    setOrders((current) => current.map((order) => order.id === id
      ? { ...order, kitchenStatus, status: kitchenStatus === "Cancelled" ? "Cancelled" : order.status }
      : order))
  }

  return {
    tableList,
    orders,
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
