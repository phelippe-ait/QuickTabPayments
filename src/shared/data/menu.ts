import { requireSupabase } from "./client";
import type {
  MenuCategory,
  MenuItem,
  TablesInsert,
  TablesUpdate,
} from "@shared/lib/database.types";

export async function fetchCategories(
  restaurantId: string,
): Promise<MenuCategory[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(
  input: TablesInsert<"menu_categories">,
): Promise<MenuCategory> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_categories")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategory(
  id: string,
  patch: TablesUpdate<"menu_categories">,
): Promise<MenuCategory> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_categories")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * `menu_items.category_id` is `on delete restrict`, so callers must move or
 * delete the items first. The thrown message is surfaced in the UI.
 */
export async function deleteCategory(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("menu_categories").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This category still has menu items. Move or delete them first."
        : error.message,
    );
  }
}

export async function fetchMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createMenuItem(
  input: TablesInsert<"menu_items">,
): Promise<MenuItem> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateMenuItem(
  id: string,
  patch: TablesUpdate<"menu_items">,
): Promise<MenuItem> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This item appears on past orders, so it cannot be deleted. Mark it unavailable instead."
        : error.message,
    );
  }
  if (!data || data.length !== 1) {
    throw new Error(
      "Menu item was not deleted. It may already be gone, or you may not have permission.",
    );
  }
}

export async function deleteMenuItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Some items appear on past orders. Mark them unavailable instead."
        : error.message,
    );
  }
  if (!data || data.length !== ids.length) {
    throw new Error(
      "Some menu items were not deleted. Refresh and check your permissions.",
    );
  }
}

export async function setMenuItemsAvailability(
  ids: string[],
  isAvailable: boolean,
): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .update({ is_available: isAvailable })
    .in("id", ids)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length !== ids.length) {
    throw new Error(
      "Menu availability was not updated. Refresh and check your permissions.",
    );
  }
}

/** Bulk patch used for moving items between categories (and similar actions). */
export async function updateMenuItems(
  ids: string[],
  patch: TablesUpdate<"menu_items">,
): Promise<void> {
  if (!ids.length) return;
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .update(patch)
    .in("id", ids)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length !== ids.length) {
    throw new Error(
      "Some menu items were not updated. Refresh and check your permissions.",
    );
  }
}

/** Persist a drag-free explicit order (one update per row). */
export async function reorderMenuItems(
  orders: { id: string; display_order: number }[],
): Promise<void> {
  if (!orders.length) return;
  await Promise.all(
    orders.map(async ({ id, display_order }) => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("menu_items")
        .update({ display_order })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length !== 1) {
        throw new Error(
          "Menu item order was not saved. Refresh and check your permissions.",
        );
      }
    }),
  );
}

export async function updateCategories(
  orders: { id: string; display_order: number }[],
): Promise<void> {
  if (!orders.length) return;
  await Promise.all(
    orders.map(async ({ id, display_order }) => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("menu_categories")
        .update({ display_order })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length !== 1) {
        throw new Error(
          "Category order was not saved. Refresh and check your permissions.",
        );
      }
    }),
  );
}

export const menuKeys = {
  all: (restaurantId: string) => ["menu", restaurantId] as const,
  categories: (restaurantId: string) =>
    ["menu", restaurantId, "categories"] as const,
  items: (restaurantId: string) => ["menu", restaurantId, "items"] as const,
};
