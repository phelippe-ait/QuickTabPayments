import type { ReactNode } from "react"
import { NavLink } from "react-router"
import styles from "../../App.module.css"
import { usePlan } from "@shared/plans/usePlan"
import { Icon, type IconName } from "@shared/ui/Icon"
import { Badge } from "@shared/ui/shadcn/badge"
import type { Section } from "../../types"

type AdminShellProps = {
  sections: Section[]
  restaurantName: string
  userName: string
  userRole: string
  userInitials: string
  onOpenProfile: () => void
  onSignOut: () => void
  mobileNavOpen: boolean
  onToggleMobileNav: () => void
  onCloseMobileNav: () => void
  children: ReactNode
}

const sectionLabels: Record<Section, string> = {
  catalog: "Catalog",
  tables: "Tables",
  users: "Users",
  orders: "Order history",
  reports: "Reports",
  settings: "Settings",
}

const sectionIcons: Record<Section, IconName> = {
  catalog: "catalog",
  tables: "tables",
  users: "users",
  orders: "orders",
  reports: "grid",
  settings: "settings",
}

export function AdminShell({ sections, restaurantName, userName, userRole, userInitials, onOpenProfile, onSignOut, mobileNavOpen, onToggleMobileNav, onCloseMobileNav, children }: AdminShellProps) {
  const { has } = usePlan()
  const reportsLocked = !has("reports")

  return (
    <div className={styles["app-shell"]}>
      <button
        type="button"
        className={styles["mobile-menu"]}
        onClick={onToggleMobileNav}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
        aria-controls="admin-sidebar"
      >
        <span /><span /><span />
      </button>
      {mobileNavOpen && <button type="button" className={styles["nav-scrim"]} onClick={onCloseMobileNav} aria-label="Close navigation" />}
      <aside id="admin-sidebar" className={`${styles["sidebar"]} ${mobileNavOpen ? styles["open"] : ""}`}>
        <div className={styles["brand"]}><span><Icon name="coffee" size={23} /></span><div><strong>{restaurantName}</strong><small>Admin workspace</small></div></div>
        <nav className={styles["sidebar-nav"]} aria-label="Admin sections">
          <p>Workspace</p>
          {sections.map((item) => (
            <NavLink
              key={item}
              to={`/admin/${item}`}
              className={({ isActive }) => `${styles["nav-link"]} ${isActive ? styles["active"] : ""}`}
              onClick={onCloseMobileNav}
            >
              <Icon name={sectionIcons[item]} />
              <span>{sectionLabels[item]}</span>
              {item === "reports" && reportsLocked ? (
                <Badge className="ml-auto">PRO</Badge>
              ) : (
                <i aria-hidden="true" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className={styles["sidebar-footer"]}>
          <button
            type="button"
            className={styles["admin-profile"]}
            onClick={onOpenProfile}
            aria-haspopup="dialog"
            aria-label={`Profile settings for ${userName}`}
            title="Profile settings"
          >
            <span>{userInitials}</span><div><strong>{userName}</strong><small>{userRole}</small></div><Icon name="chevron" size={15} />
          </button>
          <button type="button" onClick={onSignOut}><Icon name="logout" />Sign out</button>
        </div>
      </aside>
      <main>
        <div className={styles["content"]}>{children}</div>
        <footer className={styles["technology-footer"]}>Developed by QuickTab Payments Team</footer>
      </main>
    </div>
  )
}
