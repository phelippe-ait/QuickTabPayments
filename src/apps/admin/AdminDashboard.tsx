import { useState } from "react"
import { Outlet } from "react-router"
import { useAuth } from "@shared/auth/AuthContext"
import {
  getInitials,
  getProfileName,
  RestaurantProvider,
  roleLabels,
  useRestaurant,
} from "@shared/restaurant/RestaurantProvider"
import { AdminErrorBoundary } from "./components/AdminErrorBoundary"
import { AdminShell } from "./components/layout/AdminShell"
import { RequireStaff } from "./features/auth/AdminGate"
import { AdminUiProvider } from "./hooks/AdminUiProvider"
import type { Section } from "./types"

export default function App() {
  return (
    <AdminErrorBoundary>
      <RestaurantProvider>
        <RequireStaff>
          <AdminLayout />
        </RequireStaff>
      </RestaurantProvider>
    </AdminErrorBoundary>
  )
}

/**
 * Persistent admin chrome. Section content is rendered by the router's
 * `<Outlet />`, so each page owns its queries and dialogs.
 */
function AdminLayout() {
  const { restaurant, role } = useRestaurant()
  const { profile, user, signOut } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const sections: Section[] =
    role === "kitchen"
      ? ["orders"]
      : ["catalog", "tables", "users", "orders", "settings"]
  const userName = getProfileName(profile, user?.email)

  return (
    <AdminUiProvider>
      <AdminShell
        sections={sections}
        restaurantName={restaurant?.name ?? "Your restaurant"}
        userName={userName}
        userRole={role ? roleLabels[role] : ""}
        userInitials={getInitials(userName)}
        onSignOut={() => void signOut()}
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
        onCloseMobileNav={() => setMobileNavOpen(false)}
      >
        <Outlet />
      </AdminShell>
    </AdminUiProvider>
  )
}
