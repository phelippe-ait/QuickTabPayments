import { requireSupabase } from "./client";
import type {
  Restaurant,
  RestaurantStaff,
  StaffRole,
  TablesUpdate,
} from "@shared/lib/database.types";

export type Membership = {
  id: string;
  role: StaffRole;
  restaurantId: string;
  restaurant: Restaurant;
};

/**
 * The launch model is one active restaurant per staff user (the first active
 * membership wins). `fetchMemberships` exists so multi-restaurant switching can
 * be added later without changing the query layer.
 */
export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const client = requireSupabase();

  const { data: rows, error } = await client
    .from("restaurant_staff")
    .select("id, role, restaurant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  const { data: restaurants, error: restaurantError } = await client
    .from("restaurants")
    .select("*")
    .in(
      "id",
      rows.map((row) => row.restaurant_id),
    );

  if (restaurantError) throw new Error(restaurantError.message);

  const byId = new Map((restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]));

  return rows.flatMap((row) => {
    const restaurant = byId.get(row.restaurant_id);
    return restaurant
      ? [
          {
            id: row.id,
            role: row.role,
            restaurantId: row.restaurant_id,
            restaurant,
          },
        ]
      : [];
  });
}

export async function fetchPrimaryMembership(
  userId: string,
): Promise<Membership | null> {
  const memberships = await fetchMemberships(userId);
  return memberships[0] ?? null;
}

export async function fetchRestaurant(id: string): Promise<Restaurant> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateRestaurant(
  id: string,
  patch: TablesUpdate<"restaurants">,
): Promise<Restaurant> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("restaurants")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export type StaffMember = Pick<
  RestaurantStaff,
  "id" | "user_id" | "role" | "is_active" | "created_at"
>;

export type CreateRestaurantInput = {
  name: string;
  slug: string;
  ownerId: string;
};

export type NewRestaurantInput = {
  name: string;
  slug: string;
};

/**
 * Atomic onboarding: inserts the restaurant and its owner membership inside
 * one security-definer function (`create_restaurant_with_owner`, 0007).
 */
export async function createRestaurant({
  name,
  slug,
}: NewRestaurantInput): Promise<Restaurant> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_restaurant_with_owner", {
    p_name: name.trim(),
    p_slug: slug.trim(),
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That web address is already taken. Try a different one."
        : error.message,
    );
  }

  return data;
}

/**
 * Creates the restaurant and its owner membership. Two writes are needed
 * because `restaurants.owner_id` and `restaurant_staff` are separate tables;
 * if the second fails we delete the restaurant so no orphan is left behind.
 *
 * This path only needs the existing RLS policies:
 *   * `restaurants_owner_insert` — owner_id must equal auth.uid()
 *   * `staff_owner_manage`       — owner may add their own membership
 */
export async function createRestaurantWithOwner({
  name,
  slug,
  ownerId,
}: CreateRestaurantInput): Promise<Restaurant> {
  const client = requireSupabase();

  const { data: restaurant, error } = await client
    .from("restaurants")
    .insert({ name: name.trim(), slug, owner_id: ownerId })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That web address is already taken. Try a different slug."
        : error.message,
    );
  }

  const { error: staffError } = await client
    .from("restaurant_staff")
    .insert({
      restaurant_id: restaurant.id,
      user_id: ownerId,
      role: "owner",
    });

  if (staffError) {
    await client.from("restaurants").delete().eq("id", restaurant.id);
    throw new Error(staffError.message);
  }

  return restaurant;
}

export type StaffDirectoryEntry = {
  staff_id: string;
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
};

/** Reads names/emails through the security-definer directory RPC. */
export async function fetchStaffDirectory(
  restaurantId: string,
): Promise<StaffDirectoryEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("list_staff_directory", {
    p_restaurant_id: restaurantId,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Adds an existing QuickTab account to the restaurant; returns the membership id. */
export async function addStaffByEmail(
  restaurantId: string,
  email: string,
  role: StaffRole,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("add_staff_by_email", {
    p_restaurant_id: restaurantId,
    p_email: email.trim(),
    p_role: role,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function updateStaffMembership(
  staffId: string,
  patch: TablesUpdate<"restaurant_staff">,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("restaurant_staff")
    .update(patch)
    .eq("id", staffId);

  if (error) throw new Error(error.message);
}

export async function removeStaffMembership(staffId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("restaurant_staff")
    .delete()
    .eq("id", staffId);

  if (error) throw new Error(error.message);
}

export async function fetchStaff(
  restaurantId: string,
): Promise<StaffMember[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("restaurant_staff")
    .select("id, user_id, role, is_active, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export const restaurantKeys = {
  all: ["restaurants"] as const,
  membership: (userId: string) => ["restaurants", "membership", userId] as const,
  detail: (id: string) => ["restaurants", "detail", id] as const,
  staff: (id: string) => ["restaurants", id, "staff"] as const,
};
