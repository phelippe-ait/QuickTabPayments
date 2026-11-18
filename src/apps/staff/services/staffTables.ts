import { supabase } from "../../../shared/lib/supabase"
import type { Database } from "../../../shared/lib/database.types"

export type StaffTableStatus = Database["public"]["Enums"]["table_status"]

export type StaffTableRow = {
  id: string
  restaurant_id: string
  table_number: string
  location_label: string | null
  is_active: boolean
  seats: number | null
  status: StaffTableStatus
}

/** Natural order: "2" before "10". */
export function naturalSortTableNumber(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

export async function fetchStaffTables(
  restaurantId: string,
): Promise<StaffTableRow[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured")
  }

  const { data, error } = await supabase
    .from("tables")
    .select(
      "id, restaurant_id, table_number, location_label, is_active, seats, status",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("table_number", { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as StaffTableRow[]).sort((a, b) =>
    naturalSortTableNumber(a.table_number, b.table_number),
  )
}

/**
 * Moves one table through its operational status.
 *
 * The restaurant filter keeps the write tenant-scoped even if a stale table id
 * leaks in; RLS (`tables_staff_manage`, verified in P06) is the server-side
 * guard. A zero-row result means RLS/staff access rejected the update, so it is
 * surfaced as an error instead of a silent no-op.
 */
export async function updateStaffTableStatus(
  restaurantId: string,
  tableId: string,
  status: StaffTableStatus,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured")
  }

  const { data, error } = await supabase
    .from("tables")
    .update({ status })
    .eq("restaurant_id", restaurantId)
    .eq("id", tableId)
    .select("id")

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length !== 1) {
    throw new Error(
      "Table status was not updated. Check staff permissions and RLS policies.",
    )
  }
}
