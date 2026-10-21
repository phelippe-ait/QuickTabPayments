import { requireSupabase } from "./client";
import type { Restaurant } from "@shared/lib/database.types";

export type RestaurantInvite = {
  id: string;
  email: string;
  restaurant_name: string;
  restaurant_slug: string;
  expires_at: string;
};

export const inviteKeys = {
  my: (userId: string) => ["restaurant-invites", "mine", userId] as const,
};

/** Pending invitation for the signed-in verified email, if any. */
export async function fetchMyRestaurantInvite(): Promise<RestaurantInvite | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_my_restaurant_invite");

  if (error) throw new Error(error.message);
  return (data?.[0] as RestaurantInvite | undefined) ?? null;
}

/**
 * Claims the pending invitation and creates the restaurant + owner membership
 * atomically. The RPC re-checks the verified email, expiry, and slug.
 */
export async function claimRestaurantInvite(input: {
  name: string;
  slug: string;
}): Promise<Restaurant> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("claim_restaurant_invite", {
    p_name: input.name.trim(),
    p_slug: input.slug.trim(),
  });

  if (error) throw new Error(error.message);
  return data;
}
