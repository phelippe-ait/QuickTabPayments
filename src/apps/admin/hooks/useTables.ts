import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createTable as createTableRow,
  deleteTable as deleteTableRow,
  deleteTables as deleteTablesRow,
  fetchTables,
  setTablesActive,
  tableKeys,
  updateTable as updateTableRow,
} from "@shared/data/tables"
import { fetchOpenOrdersByTable, orderKeys } from "@shared/data/orders"
import type { TablesUpdate } from "@shared/lib/database.types"
import { toTableVM } from "../mappers"
import type { TableVM } from "../viewModels"

export type NewTableInput = {
  table_number: string
  location_label: string | null
  seats: number | null
  is_active: boolean
}

type UseTablesOptions = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

type Task = {
  run: () => Promise<unknown>
  message: string
}

/**
 * Tables + derived occupancy. `tables` owns enable/disable and CRUD; open
 * orders are polled separately (30 s) so occupancy reflects the order flow
 * without conflating it with `is_active`.
 */
export function useTables(
  restaurantId: string,
  options: UseTablesOptions = {},
) {
  const queryClient = useQueryClient()

  const tablesQuery = useQuery({
    queryKey: tableKeys.all(restaurantId),
    queryFn: () => fetchTables(restaurantId),
    enabled: Boolean(restaurantId),
  })
  const openOrdersQuery = useQuery({
    queryKey: orderKeys.openTables(restaurantId),
    queryFn: () => fetchOpenOrdersByTable(restaurantId),
    enabled: Boolean(restaurantId),
    refetchInterval: 30_000,
  })

  const tableRows = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data])
  const openByTable = useMemo(
    () => openOrdersQuery.data ?? {},
    [openOrdersQuery.data],
  )
  const tables: TableVM[] = useMemo(
    () => tableRows.map((row) => toTableVM(row, openByTable[row.id])),
    [openByTable, tableRows],
  )

  const mutation = useMutation({
    mutationFn: async (task: Task) => {
      await task.run()
    },
    onSuccess: (_data, task) => {
      void queryClient.invalidateQueries({
        queryKey: tableKeys.all(restaurantId),
      })
      void queryClient.invalidateQueries({
        queryKey: orderKeys.openTables(restaurantId),
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

  return {
    tables,
    isLoading: tablesQuery.isPending,
    error:
      (tablesQuery.error as Error | null) ??
      (openOrdersQuery.error as Error | null),
    refetch: () => {
      void tablesQuery.refetch()
      void openOrdersQuery.refetch()
    },
    isMutating: mutation.isPending,

    createTable: (input: NewTableInput) =>
      run({
        message: `Table ${input.table_number} created`,
        run: () =>
          createTableRow({
            restaurant_id: restaurantId,
            ...input,
          }),
      }),

    updateTable: (id: string, patch: TablesUpdate<"tables">) =>
      run({ message: "Table saved", run: () => updateTableRow(id, patch) }),

    deleteTable: (id: string) =>
      run({ message: "Table deleted", run: () => deleteTableRow(id) }),

    deleteTables: (ids: string[]) =>
      run({
        message: `${ids.length} tables deleted`,
        run: () => deleteTablesRow(ids),
      }),

    setActive: (ids: string[], isActive: boolean) =>
      run({
        message: `${ids.length} ${ids.length === 1 ? "table" : "tables"} ${isActive ? "enabled" : "disabled"}`,
        run: () => setTablesActive(ids, isActive),
      }),
  }
}

export type TablesController = ReturnType<typeof useTables>
