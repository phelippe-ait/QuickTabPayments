import { createContext } from "react";
import type { Membership } from "@shared/data/restaurants";
import type { StaffRole } from "@shared/lib/database.types";

export type RestaurantContextValue = {
  membership: Membership | null;
  restaurant: Membership["restaurant"] | null;
  role: StaffRole | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

export const RestaurantContext =
  createContext<RestaurantContextValue | null>(null);
