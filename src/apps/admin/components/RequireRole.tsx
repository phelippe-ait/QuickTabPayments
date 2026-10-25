import type { ReactNode } from "react"
import { Link } from "react-router"
import { useAuth } from "@shared/auth/AuthContext"
import {
  roleLabels,
  useRestaurant,
} from "@shared/restaurant/RestaurantProvider"
import type { StaffRole } from "@shared/lib/database.types"
import { Button, buttonVariants } from "@shared/ui/Button"

/**
 * Route-level role guard. Hiding nav entries is not enough: kitchen users can
 * deep-link, so every owner/manager route wraps its page in this component.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: StaffRole[]
  children: ReactNode
}) {
  const { role } = useRestaurant()

  if (role && roles.includes(role)) return <>{children}</>

  return <RoleBlocked role={role} />
}

function RoleBlocked({ role }: { role: StaffRole | null }) {
  const { signOut } = useAuth()

  return (
    <section className="mx-auto max-w-[520px] rounded-card border border-line bg-paper p-8 text-center shadow-card">
      <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
        Restricted area
      </p>
      <h1 className="mt-2 font-serif text-3xl text-ink">
        Not available for your role
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-2">
        {role
          ? `Your ${roleLabels[role].toLowerCase()} account doesn't have access to this section.`
          : "We couldn't confirm your role for this restaurant."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/admin/orders" className={buttonVariants()}>
          Go to order history
        </Link>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  )
}
