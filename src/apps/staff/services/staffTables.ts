
import { supabase } from "../../../shared/lib/supabase"

export type StaffTableRow = {
  id: string
  restaurant_id: string
  table_number: string
  location_label: string | null
  is_active: boolean
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
      "id, restaurant_id, table_number, location_label, is_active",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("table_number", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as StaffTableRow[]
}
