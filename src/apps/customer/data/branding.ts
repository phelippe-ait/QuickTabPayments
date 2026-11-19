import { requireSupabase } from "@shared/data/client"

/** Public branding assets stored on the restaurant row. */
export type RestaurantBranding = {
  logoUrl: string | null
  coverUrl: string | null
}

/**
 * Restaurants are publicly readable while active, so the menu can resolve its
 * branding with the same anon key used for the rest of the customer app.
 */
export async function fetchRestaurantBranding(
  restaurantId: string,
): Promise<RestaurantBranding> {
  const client = requireSupabase()
  const { data, error } = await client
    .from("restaurants")
    .select("logo_url, cover_image_url")
    .eq("id", restaurantId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    logoUrl: data?.logo_url ?? null,
    coverUrl: data?.cover_image_url ?? null,
  }
}
