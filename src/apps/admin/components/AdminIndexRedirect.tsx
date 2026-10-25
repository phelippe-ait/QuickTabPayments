import { Navigate } from "react-router"
import { useRestaurant } from "@shared/restaurant/RestaurantProvider"

/**
 * `/admin` has no page of its own: owners/managers land on the catalog, kitchen
 * staff land on the only section they can use.
 */
export function AdminIndexRedirect() {
  const { role } = useRestaurant()

  return (
    <Navigate
      to={role === "kitchen" ? "/admin/orders" : "/admin/catalog"}
      replace
    />
  )
}
