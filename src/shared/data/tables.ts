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
  const { error } = await client.from("tables").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTables(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { error } = await client.from("tables").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function setTablesActive(
  ids: string[],
  isActive: boolean,
): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { error } = await client
    .from("tables")
    .update({ is_active: isActive })
    .in("id", ids);

  if (error) throw new Error(error.message);
}

export const tableKeys = {
  all: (restaurantId: string) => ["tables", restaurantId] as const,
};
