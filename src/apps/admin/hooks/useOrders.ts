import { useMemo } from "react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  fetchOrder,
  fetchOrderStats,
  fetchOrders,
  orderKeys,
  updateOrderStatus,
  type OrderFilters,
} from "@shared/data/orders"
import type { OrderStatus } from "@shared/lib/database.types"
import { canTransitionStatus } from "@shared/orders/status"
import { toOrderVM } from "../mappers"
import type { OrderVM } from "../viewModels"

type RestaurantDisplay = { currency: string; timezone: string }
type HooksOptions = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function useOrders(
  restaurantId: string,
  filters: OrderFilters,
  restaurant: RestaurantDisplay,
) {
  const query = useQuery({
    queryKey: orderKeys.list(restaurantId, filters),
    queryFn: () => fetchOrders(restaurantId, filters),
    enabled: Boolean(restaurantId),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const { currency, timezone } = restaurant
  const orders = useMemo(
    () => rows.map((row) => toOrderVM(row, { currency, timezone })),
    [currency, rows, timezone],
  )

  return {
    orders,
    count: query.data?.count ?? 0,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

export function useOrder(
  restaurantId: string,
  id: string | undefined,
  restaurant: RestaurantDisplay,
) {
  const query = useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: () => fetchOrder(id as string),
    enabled: Boolean(restaurantId && id),
    refetchInterval: 30_000,
  })

  return {
    order: query.data ? toOrderVM(query.data, restaurant) : null,
    isLoading: query.isPending,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

export type OrderStats = {
  today: { orders: number; revenue: number; average: number }
  yesterday: { orders: number; revenue: number; average: number }
}

const emptyStats = { orders: 0, revenue: 0, average: 0 }

export function useOrderStats(restaurantId: string, timezone: string) {
  const query = useQuery({
    queryKey: orderKeys.stats(restaurantId),
    queryFn: () => fetchOrderStats(restaurantId, timezone),
    enabled: Boolean(restaurantId),
    refetchInterval: 30_000,
  })

  const rows = query.data ?? []
  const pick = (period: "today" | "yesterday") => {
    const row = rows.find((entry) => entry.period === period)
    return row
      ? {
          orders: row.orders_count,
          revenue: row.revenue,
          average: row.avg_order_value,
        }
      : emptyStats
  }

  const stats: OrderStats = { today: pick("today"), yesterday: pick("yesterday") }

  return {
    stats,
    isLoading: query.isPending,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

type Task = { run: () => Promise<unknown>; message: string }

export function useOrderMutations(
  restaurantId: string,
  options: HooksOptions = {},
) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (task: Task) => {
      await task.run()
    },
    onSuccess: (_data, task) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] })
      void queryClient.invalidateQueries({
        queryKey: orderKeys.stats(restaurantId),
      })
      options.onSuccess?.(task.message)
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  const run = async (task: Task): Promise<boolean> => {
    try {
      await mutation.mutateAsync(task)
      return true
    } catch {
      return false
    }
  }

  const setStatus = (
    id: string,
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<boolean> => {
    if (!canTransitionStatus(from, to)) {
      options.onError?.(`An order cannot move from ${from} to ${to}.`)
      return Promise.resolve(false)
    }

    return run({
      message: to === "cancelled" ? "Order cancelled" : "Order status updated",
      run: () => updateOrderStatus(id, to),
    })
  }

  return {
    isMutating: mutation.isPending,
    setStatus,
    cancel: (id: string, from: OrderStatus) => setStatus(id, from, "cancelled"),
  }
}

export type { OrderVM }
