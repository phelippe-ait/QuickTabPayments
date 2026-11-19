import { requireSupabase } from "./client";
import type {
  CafeTable,
  TablesInsert,
  TablesUpdate,
} from "@shared/lib/database.types";

export async function fetchTables(restaurantId: string): Promise<CafeTable[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("is_system", { ascending: false })
    .order("table_number", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTable(
  input: TablesInsert<"tables">,
): Promise<CafeTable> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Table ${input.table_number} already exists for this restaurant.`
        : error.message,
    );
  }
  return data;
}

export async function updateTable(
  id: string,
  patch: TablesUpdate<"tables">,
): Promise<CafeTable> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Table ${patch.table_number ?? ""} already exists for this restaurant.`
        : error.message,
    );
  }
  return data;
}

export async function deleteTable(id: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length !== 1) {
    throw new Error(
      "Table was not deleted. It may already be gone, or you may not have permission.",
    );
  }
}

export async function deleteTables(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length !== ids.length) {
    throw new Error(
      "Some tables were not deleted. Refresh and check your permissions.",
    );
  }
}

export async function setTablesActive(
  ids: string[],
  isActive: boolean,
): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { data, error } = await client
    .from("tables")
    .update({ is_active: isActive })
    .in("id", ids)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length !== ids.length) {
    throw new Error(
      "Table status was not updated. Refresh and check your permissions.",
    );
  }
}

export const tableKeys = {
  all: (restaurantId: string) => ["tables", restaurantId] as const,
};
