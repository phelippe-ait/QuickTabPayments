import { useContext } from "react";
import { RestaurantContext } from "./RestaurantContext";
import type { RestaurantContextValue } from "./RestaurantContext";

export function useRestaurant(): RestaurantContextValue {
  const value = useContext(RestaurantContext);
  if (!value) {
    throw new Error("useRestaurant must be used inside RestaurantProvider");
  }
  return value;
}
