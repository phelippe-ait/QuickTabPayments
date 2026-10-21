import type { ReactNode } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import type { Section } from "../../types"

type AdminShellProps = {
  section: Section
  sections: Section[]
  restaurantName: string
  userName: string
  userRole: string
  userInitials: string
  onSignOut: () => void
  mobileNavOpen: boolean
  onNavigate: (section: Section) => void
  onToggleMobileNav: () => void
  onCloseMobileNav: () => void
  children: ReactNode
}

const sectionLabels: Record<Section, string> = {
  catalog: "Catalog",
  tables: "Tables",
  users: "Users",
  orders: "Order history",
}

const sectionIcons: Record<Section, "catalog" | "tables" | "users" | "orders"> = {
  catalog: "catalog",
  tables: "tables",
  users: "users",
  orders: "orders",
}

export function AdminShell({ section, sections, restaurantName, userName, userRole, userInitials, onSignOut, mobileNavOpen, onNavigate, onToggleMobileNav, onCloseMobileNav, children }: AdminShellProps) {
  return (
    <div className={styles["app-shell"]}>
      <button className={styles["mobile-menu"]} onClick={onToggleMobileNav} aria-label="Open navigation"><span /><span /><span /></button>
      {mobileNavOpen && <button className={styles["nav-scrim"]} onClick={onCloseMobileNav} aria-label="Close navigation" />}
      <aside className={mobileNavOpen ? styles["open"] : ""}>
        <div className={styles["brand"]}><span><Icon name="coffee" size={25} /></span><div><strong>{restaurantName}</strong><small>Admin workspace</small></div></div>
        <nav>
          <p>Workspace</p>
          {sections.map((item) => (
            <button key={item} className={section === item ? styles["active"] : ""} onClick={() => onNavigate(item)}><Icon name={sectionIcons[item]} />{sectionLabels[item]}</button>
          ))}
        </nav>
        <div className={styles["sidebar-footer"]}>
          <div className={styles["admin-profile"]}><span>{userInitials}</span><div><strong>{userName}</strong><small>{userRole}</small></div><Icon name="chevron" size={15} /></div>
          <button onClick={onSignOut}><Icon name="logout" />Sign out</button>
        </div>
      </aside>
      <main>
        <div className={styles["content"]}>{children}</div>
        <footer className={styles["technology-footer"]}>Developed by QuickTab Payments Team</footer>
      </main>
    </div>
  )
}
