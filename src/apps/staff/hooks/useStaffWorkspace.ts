import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { initialReservations } from "../data/fixtures"
import type { KitchenStatus, Order, Reservation, Table, TableStatus } from "../types"
import { supabase } from "@shared/lib/supabase"
import { toHistoryOrder } from "../data/orderHistory"
import {
  fetchStaffTables,
  updateStaffTableStatus,
} from "../services/staffTables"
import {
  canKitchenTransition,
  fetchStaffOrders,
  mapStaffOrder,
  updateStaffOrderStatus,
} from "../services/staffOrders"
import {
  deriveConnectionState,
  type ConnectionSignal,
  type ConnectionState,
} from "./connectionState"
import { mergeOrders } from "./mergeOrders"
import { useConnectionPolling } from "./useConnectionPolling"
import { useNewOrders } from "./useNewOrders"
import { useOrderSound } from "./useOrderSound"

/** REST refresh cadence while the Realtime socket is down. */
export const STAFF_POLL_INTERVAL_MS = 10_000

/**
 * Staff workspace data. The signed-in member's restaurant id comes from the
 * auth gate (`RestaurantProvider`), so every query resolves the same
 * restaurant — no ad-hoc slug lookups.
 */
export function useStaffWorkspace(restaurantId: string | null) {
  const sound = useOrderSound()
  const { play: playOrderSound } = sound
  const newOrders = useNewOrders()
  const {
    observe: observeOrders,
    register: registerNewOrder,
    markSeen: markOrderSeen,
    reset: resetNewOrders,
  } = newOrders

  const [tableList, setTableList] = useState<Table[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [tableStatusUpdating, setTableStatusUpdating] = useState<
    ReadonlySet<string>
  >(new Set())

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [reservations, setReservations] = useState<Reservation[]>(
    initialReservations,
  )

  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : "connecting",
  )
  const connectionStateRef = useRef<ConnectionState>(connectionState)
  const hasConnectedRef = useRef(false)
  // The board/history fetches are the single source of truth for both Realtime
  // and the polling fallback. Keeping them in refs lets the channel handler
  // re-sync without duplicating query logic (or the new-order dedupe).
  const refreshOrdersRef = useRef<(() => Promise<void>) | null>(null)
  const refreshHistoryRef = useRef<(() => Promise<void>) | null>(null)

  const applyConnectionSignal = useCallback((signal: ConnectionSignal) => {
    const current = connectionStateRef.current
    const next = deriveConnectionState(current, signal)
    if (next === current) return

    connectionStateRef.current = next
    setConnectionState(next)

    if (next !== "online") return

    // Re-sync after a reconnect: the stream may have dropped events while the
    // socket was down. Decision: re-fetch the full open-orders slice instead of
    // an `updated_at` cursor — the board is small, and a full fetch also heals
    // updates/deletes we never saw. Both paths are idempotent, and
    // `useNewOrders` dedupes by order id, so rows that merely re-appear never
    // chime or badge twice.
    if (hasConnectedRef.current) {
      void refreshOrdersRef.current?.()
      void refreshHistoryRef.current?.()
    }
    hasConnectedRef.current = true
  }, [])

  // Browser connectivity is a second signal: the websocket can take a while to
  // notice a dropped network, and coming back online means "connecting" until
  // the channel actually rejoins.
  useEffect(() => {
    const onOnline = () =>
      applyConnectionSignal({ type: "browser", online: true })
    const onOffline = () =>
      applyConnectionSignal({ type: "browser", online: false })

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [applyConnectionSignal])

  // Live kitchen board. The initial fetch hydrates the board; afterwards
  // Realtime drives updates and `useConnectionPolling` falls back to REST while
  // the socket is offline. Unpaid (`pending`) orders are filtered out by the
  // query, so the kitchen only ever acts on paid orders.
  useEffect(() => {
    resetNewOrders()
    refreshOrdersRef.current = null

    if (!restaurantId) {
      setOrdersLoading(false)
      setTablesLoading(false)
      setOrdersError("No active staff restaurant found")
      return
    }

    let cancelled = false
    let loading = false

    // A restaurant switch must not merge the previous tenant's board in.
    setOrders([])

    async function loadOrders(id: string) {
      if (cancelled || loading) return
      loading = true
      try {
        const rows = await fetchStaffOrders(id)
        if (!cancelled) {
          const mapped = rows.map(mapStaffOrder)
          const additions = observeOrders(mapped)
          if (additions.length > 0) playOrderSound()
          setOrders((current) => mergeOrders(current, mapped))
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

    refreshOrdersRef.current = () => loadOrders(restaurantId)

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
            status: row.status,
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
    })()

    return () => {
      cancelled = true
      refreshOrdersRef.current = null
    }
  }, [restaurantId, playOrderSound, observeOrders, resetNewOrders])

  // While Realtime is offline, poll the board over REST so a dropped socket
  // never freezes the kitchen. Reconnecting flips `enabled` back to false and
  // cancels the interval; `applyConnectionSignal` then performs the re-sync
  // fetch once.
  useConnectionPolling({
    enabled: connectionState === "offline" && restaurantId !== null,
    intervalMs: STAFF_POLL_INTERVAL_MS,
    onPoll: () => {
      void refreshOrdersRef.current?.()
    },
  })

  // Order history + Realtime. Assigning the channel synchronously means the
  // cleanup always removes it, even under React StrictMode double-mounting.
  useEffect(() => {
    refreshHistoryRef.current = null

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

    const loadHistory = async () => {
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

    refreshHistoryRef.current = () => loadHistory()

    void loadHistory().catch((error: unknown) => {
      if (!active) return
      console.error("Could not load order history", error)
      setHistoryError(
        "Could not load recent orders. Check your connection and try again.",
      )
      setHistoryLoading(false)
    })

    // Scoping guarantee (C7): every staff subscription is filtered to this
    // restaurant on the server, so Realtime never streams another tenant's
    // orders. Do not remove this filter or create an unscoped `orders` channel.
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
        (payload) => {
          // A paid order becomes a kitchen order when it is inserted as
          // non-pending or updated from `pending` to `confirmed`. Chime only
          // for order numbers the board has not already seen.
          const row = payload.new as {
            order_number?: string
            status?: string
          }
          if (
            (payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE") &&
            row.order_number &&
            row.status &&
            row.status !== "pending" &&
            registerNewOrder(row.order_number)
          ) {
            playOrderSound()
          }
          // Both fetches are the same path used for hydration, polling and
          // re-sync. Each tab owns its own channel + fetch, so two open staff
          // tabs converge on the database without cross-tab messaging.
          void loadHistory()
          void refreshOrdersRef.current?.()
        },
      )
      .subscribe((status) => {
        if (active) applyConnectionSignal({ type: "realtime", status })
      })

    return () => {
      active = false
      refreshHistoryRef.current = null
      void client.removeChannel(channel)
    }
  }, [
    restaurantId,
    playOrderSound,
    registerNewOrder,
    applyConnectionSignal,
  ])

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

  /**
   * One-tap table status cycle. The pill flips optimistically, then rolls back
   * if the write fails (RLS, offline, stale id). Table status is fetch-on-demand:
   * there is deliberately no `tables` Realtime subscription (P17 scoping), so
   * other devices pick the new status up the next time they load the floor.
   */
  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    const table = tableList.find(
      (candidate) => String(candidate.id) === tableId,
    )
    if (!table || table.status === status) return

    if (!restaurantId) {
      setTablesError("No active staff restaurant found")
      return
    }

    const previousStatus = table.status
    setTablesError(null)
    setTableStatusUpdating((current) => new Set(current).add(tableId))
    setTableList((current) =>
      current.map((candidate) =>
        String(candidate.id) === tableId
          ? { ...candidate, status }
          : candidate,
      ),
    )

    try {
      await updateStaffTableStatus(restaurantId, tableId, status)
    } catch (error) {
      console.error("Failed to update table status:", error)
      setTableList((current) =>
        current.map((candidate) =>
          String(candidate.id) === tableId
            ? { ...candidate, status: previousStatus }
            : candidate,
        ),
      )
      setTablesError(
        error instanceof Error
          ? error.message
          : "Could not update the table. Please try again.",
      )
    } finally {
      setTableStatusUpdating((current) => {
        const next = new Set(current)
        next.delete(tableId)
        return next
      })
    }
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

    const previousOrder = orders.find((order) => order.id === id)
    if (!previousOrder) return

    // The board only renders legal actions, but a stale poll or a second tab
    // can still race us. Refuse locally too — the P03 trigger is the final
    // guard, and this keeps the optimistic state honest.
    if (!canKitchenTransition(previousOrder.kitchenStatus, kitchenStatus)) {
      setOrdersError(
        "That status change isn't allowed. Refresh the order and try again.",
      )
      return
    }

    // Advancing an order is the acknowledgement: its "New" highlight is no
    // longer needed once the kitchen has acted on it.
    markOrderSeen(id)
    setOrdersError(null)

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

    try {
      if (!restaurantId) throw new Error("No active staff restaurant found")

      await updateStaffOrderStatus(restaurantId, id, statusMap[kitchenStatus])
    } catch (error) {
      console.error("Failed to update order status:", error)
      setOrders((current) =>
        current.map((order) => (order.id === id ? previousOrder : order)),
      )
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
    tableStatusUpdating,
    orders,
    ordersLoading,
    ordersError,
    historyOrders,
    historyLoading,
    historyError,
    reservations,
    connectionState,
    activeKitchenOrders,
    previousKitchenOrders,
    unseenOrderIds: newOrders.unseenOrderIds,
    markOrderSeen,
    sound,
    updateTable,
    updateTableStatus,
    createReservation,
    cancelReservation,
    updateKitchenStatus,
  }
}
