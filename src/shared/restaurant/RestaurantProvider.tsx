/* eslint-disable react-refresh/only-export-components -- provider + hook share a file */
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/auth/AuthContext";
import {
  fetchPrimaryMembership,
  restaurantKeys,
  type Membership,
} from "@shared/data/restaurants";
import type { Profile, StaffRole } from "@shared/lib/database.types";

export const roleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  kitchen: "Kitchen",
};

type RestaurantContextValue = {
  membership: Membership | null;
  restaurant: Membership["restaurant"] | null;
  role: StaffRole | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

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

export function useRestaurant(): RestaurantContextValue {
  const value = useContext(RestaurantContext);
  if (!value) {
    throw new Error("useRestaurant must be used inside RestaurantProvider");
  }
  return value;
}

export function getProfileName(profile: Profile | null, email?: string | null) {
  if (profile) {
    const name = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return email?.split("@")[0] ?? "Account";
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
