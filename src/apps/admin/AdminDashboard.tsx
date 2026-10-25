import { useState } from "react"
import { Outlet } from "react-router"
import { useAuth } from "@shared/auth/AuthContext"
import { RestaurantProvider } from "@shared/restaurant/RestaurantProvider"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import {
  getInitials,
  getProfileName,
  roleLabels,
} from "@shared/restaurant/restaurantHelpers"
import { AdminErrorBoundary } from "./components/AdminErrorBoundary"
import { AdminShell } from "./components/layout/AdminShell"
import { RequireStaff } from "./features/auth/AdminGate"
import { ProfileDialog } from "./features/profile/ProfileDialog"
import { AdminUiProvider, useAdminUi } from "./hooks/AdminUiProvider"
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
  return (
    <AdminUiProvider>
      <AdminLayoutContent />
    </AdminUiProvider>
  )
}

function AdminLayoutContent() {
  const { restaurant, role } = useRestaurant()
  const { profile, user, signOut } = useAuth()
  const { confirm } = useAdminUi()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const sections: Section[] =
    role === "kitchen"
      ? ["orders"]
      : ["catalog", "tables", "users", "orders", "settings"]
  const userName = getProfileName(profile, user?.email)

  const requestSignOut = () => {
    confirm({
      title: "Sign out of QuickTab?",
      description:
        "You will need to sign in again to manage this restaurant. Unsaved changes are not kept.",
      actionLabel: "Sign out",
      onConfirm: () => {
        void signOut()
      },
    })
  }

  return (
    <>
      <AdminShell
        sections={sections}
        restaurantName={restaurant?.name ?? "Your restaurant"}
        userName={userName}
        userRole={role ? roleLabels[role] : ""}
        userInitials={getInitials(userName)}
        onOpenProfile={() => setProfileOpen(true)}
        onSignOut={requestSignOut}
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
        onCloseMobileNav={() => setMobileNavOpen(false)}
      >
        <Outlet />
      </AdminShell>
      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
    </>
  )
}
