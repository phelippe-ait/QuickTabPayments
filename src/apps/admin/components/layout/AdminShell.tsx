import type { ReactNode } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import type { Section } from "../../types"

type AdminShellProps = {
  section: Section
  mobileNavOpen: boolean
  onNavigate: (section: Section) => void
  onToggleMobileNav: () => void
  onCloseMobileNav: () => void
  children: ReactNode
}

export function AdminShell({ section, mobileNavOpen, onNavigate, onToggleMobileNav, onCloseMobileNav, children }: AdminShellProps) {
  return (
    <div className={styles["app-shell"]}>
      <button className={styles["mobile-menu"]} onClick={onToggleMobileNav} aria-label="Open navigation"><span /><span /><span /></button>
      {mobileNavOpen && <button className={styles["nav-scrim"]} onClick={onCloseMobileNav} aria-label="Close navigation" />}
      <aside className={mobileNavOpen ? styles["open"] : ""}>
        <div className={styles["brand"]}><span><Icon name="coffee" size={25} /></span><div><strong>Café Shop</strong><small>Admin workspace</small></div></div>
        <nav>
          <p>Workspace</p>
          <button className={section === "catalog" ? styles["active"] : ""} onClick={() => onNavigate("catalog")}><Icon name="catalog" />Catalog</button>
          <button className={section === "tables" ? styles["active"] : ""} onClick={() => onNavigate("tables")}><Icon name="tables" />Tables</button>
          <button className={section === "users" ? styles["active"] : ""} onClick={() => onNavigate("users")}><Icon name="users" />Users</button>
          <button className={section === "orders" ? styles["active"] : ""} onClick={() => onNavigate("orders")}><Icon name="orders" />Order history</button>
        </nav>
        <div className={styles["sidebar-footer"]}>
          <div className={styles["admin-profile"]}><span>MJ</span><div><strong>Maya Johnson</strong><small>Manager</small></div><Icon name="chevron" size={15} /></div>
          <button><Icon name="logout" />Sign out</button>
        </div>
      </aside>
      <main>
        <div className={styles["content"]}>{children}</div>
        <footer className={styles["technology-footer"]}>Developed by QuickTab Payments Team</footer>
      </main>
    </div>
  )
}
