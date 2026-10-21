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
