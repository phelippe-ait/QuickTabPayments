import type { ReactNode } from "react"
import { NavLink } from "react-router"
import styles from "../../App.module.css"
import { Icon, type IconName } from "@shared/ui/Icon"
import type { Section } from "../../types"

type AdminShellProps = {
  sections: Section[]
  restaurantName: string
  userName: string
  userRole: string
  userInitials: string
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
  settings: "Settings",
}

const sectionIcons: Record<Section, IconName> = {
  catalog: "catalog",
  tables: "tables",
  users: "users",
  orders: "orders",
  settings: "settings",
}

export function AdminShell({ sections, restaurantName, userName, userRole, userInitials, onSignOut, mobileNavOpen, onToggleMobileNav, onCloseMobileNav, children }: AdminShellProps) {
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
      <aside id="admin-sidebar" className={mobileNavOpen ? styles["open"] : ""}>
        <div className={styles["brand"]}><span><Icon name="coffee" size={25} /></span><div><strong>{restaurantName}</strong><small>Admin workspace</small></div></div>
        <nav aria-label="Admin sections">
          <p>Workspace</p>
          {sections.map((item) => (
            <NavLink
              key={item}
              to={`/admin/${item}`}
              className={({ isActive }) => isActive ? styles["active"] : ""}
              onClick={onCloseMobileNav}
            >
              <Icon name={sectionIcons[item]} />{sectionLabels[item]}
            </NavLink>
          ))}
        </nav>
        <div className={styles["sidebar-footer"]}>
          <div className={styles["admin-profile"]}><span>{userInitials}</span><div><strong>{userName}</strong><small>{userRole}</small></div><Icon name="chevron" size={15} /></div>
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
