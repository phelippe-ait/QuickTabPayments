import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/auth/AuthContext";
import {
  fetchPrimaryMembership,
  restaurantKeys,
} from "@shared/data/restaurants";
import { RestaurantContext } from "./RestaurantContext";
import type { RestaurantContextValue } from "./RestaurantContext";

/**
 * Loads the signed-in user's active restaurant. Mount inside `AuthProvider`.
 * The launch model is one restaurant per user; `fetchMemberships` already
 * returns all memberships so a picker can be added later.
 */
export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: restaurantKeys.membership(user?.id ?? "anonymous"),
    queryFn: () => fetchPrimaryMembership(user!.id),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const { data, error, isLoading, refetch } = query;

  const value = useMemo<RestaurantContextValue>(
    () => ({
      membership: data ?? null,
      restaurant: data?.restaurant ?? null,
      role: data?.role ?? null,
      isLoading: authLoading || (Boolean(user) && isLoading),
      error: error instanceof Error ? error : null,
      refetch: () => void refetch(),
    }),
    [authLoading, data, error, isLoading, refetch, user],
  );

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}
