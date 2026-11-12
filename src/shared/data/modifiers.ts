import { requireSupabase } from "./client";
import type {
  MenuItemModifierGroup,
  Modifier,
  ModifierGroup,
  TablesInsert,
  TablesUpdate,
} from "@shared/lib/database.types";

export type ModifierGroupWithOptions = ModifierGroup & {
  modifiers: Modifier[];
};

export type ModifierCatalog = {
  groups: ModifierGroupWithOptions[];
  links: MenuItemModifierGroup[];
};

/**
 * Modifier groups are owned by the restaurant; their options are scoped
 * through the group id (there is no `restaurant_id` on `modifiers`). The
 * per-item links are scoped by the same group ids, so a single fetch covers
 * every group, option, and attachment the catalog editor needs.
 */
export async function fetchModifierCatalog(
  restaurantId: string,
): Promise<ModifierCatalog> {
  const client = requireSupabase();
  const { data: groupRows, error: groupError } = await client
    .from("modifier_groups")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (groupError) throw new Error(groupError.message);

  const groups = groupRows ?? [];
  const groupIds = groups.map((group) => group.id);
  if (!groupIds.length) return { groups: [], links: [] };

  const [
    { data: modifierRows, error: modifierError },
    { data: linkRows, error: linkError },
  ] = await Promise.all([
    client
      .from("modifiers")
      .select("*")
      .in("modifier_group_id", groupIds)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("menu_item_modifier_groups")
      .select("*")
      .in("modifier_group_id", groupIds)
      .order("display_order", { ascending: true }),
  ]);

  if (modifierError) throw new Error(modifierError.message);
  if (linkError) throw new Error(linkError.message);

  return {
    groups: groups.map((group) => ({
      ...group,
      modifiers: (modifierRows ?? []).filter(
        (modifier) => modifier.modifier_group_id === group.id,
      ),
    })),
    links: linkRows ?? [],
  };
}

export async function createModifierGroup(
  input: TablesInsert<"modifier_groups">,
): Promise<ModifierGroup> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("modifier_groups")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateModifierGroup(
  id: string,
  patch: TablesUpdate<"modifier_groups">,
): Promise<ModifierGroup> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("modifier_groups")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteModifierGroup(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("modifier_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createModifier(
  input: TablesInsert<"modifiers">,
): Promise<Modifier> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("modifiers")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateModifier(
  id: string,
  patch: TablesUpdate<"modifiers">,
): Promise<Modifier> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("modifiers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteModifier(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("modifiers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Persist an explicit option order (one update per row). */
export async function reorderModifiers(
  orders: { id: string; display_order: number }[],
): Promise<void> {
  if (!orders.length) return;
  await Promise.all(
    orders.map(async ({ id, display_order }) => {
      const client = requireSupabase();
      const { error } = await client
        .from("modifiers")
        .update({ display_order })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }),
  );
}

export async function linkModifierGroup(
  menuItemId: string,
  modifierGroupId: string,
  displayOrder = 0,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("menu_item_modifier_groups").insert({
    menu_item_id: menuItemId,
    modifier_group_id: modifierGroupId,
    display_order: displayOrder,
  });

  if (error) throw new Error(error.message);
}

export async function unlinkModifierGroup(
  menuItemId: string,
  modifierGroupId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("menu_item_modifier_groups")
    .delete()
    .eq("menu_item_id", menuItemId)
    .eq("modifier_group_id", modifierGroupId);

  if (error) throw new Error(error.message);
}

export const modifierKeys = {
  all: (restaurantId: string) => ["modifiers", restaurantId] as const,
  catalog: (restaurantId: string) =>
    ["modifiers", restaurantId, "catalog"] as const,
};
