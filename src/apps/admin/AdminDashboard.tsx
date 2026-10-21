import { useState } from "react"
import styles from "./App.module.css"
import { useAdminToast } from "./hooks/useAdminToast"
import { useAdminWorkspace } from "./hooks/useAdminWorkspace"
import { AdminShell } from "./components/layout/AdminShell"
import { ConfirmDialog } from "./components/AdminUi"
import { CatalogPage } from "./features/catalog/CatalogPage"
import { ItemModal, SectionsModal } from "./features/catalog/CatalogDialogs"
import { TablesPage } from "./features/tables/TablesPage"
import { TableModal } from "./features/tables/TableDialog"
import { UsersPage } from "./features/users/UsersPage"
import { UserModal } from "./features/users/UserDialog"
import { OrdersPage } from "./features/orders/OrdersPage"
import { RequireStaff } from "./features/auth/AdminGate"
import { useAuth } from "@shared/auth/AuthContext"
import {
  getInitials,
  getProfileName,
  RestaurantProvider,
  roleLabels,
  useRestaurant,
} from "@shared/restaurant/RestaurantProvider"
import type { CafeTable, Confirmation, MenuItem, Section, User } from "./types"

export default function App() {
  return (
    <RestaurantProvider>
      <RequireStaff>
        <AdminWorkspace />
      </RequireStaff>
    </RestaurantProvider>
  )
}

function AdminWorkspace() {
  const { restaurant, role } = useRestaurant()
  const { profile, user, signOut } = useAuth()
  const allowedSections: Section[] = role === "kitchen"
    ? ["orders"]
    : ["catalog", "tables", "users", "orders"]
  const [section, setSection] = useState<Section>(allowedSections[0])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [itemModal, setItemModal] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null })
  const [tableModal, setTableModal] = useState<{ open: boolean; table: CafeTable | null }>({ open: false, table: null })
  const [userModal, setUserModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null })
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const { toast, showToast } = useAdminToast()
  const workspace = useAdminWorkspace({ notify: showToast, confirm: setConfirmation })
  const userName = getProfileName(profile, user?.email)

  const navigate = (next: Section) => {
    setSection(next)
    setMobileNavOpen(false)
  }

  const saveItem = (item: MenuItem) => {
    workspace.saveItem(item)
    setItemModal({ open: false, item: null })
  }

  const saveUser = (nextUser: User) => {
    workspace.saveUser(nextUser)
    setUserModal({ open: false, user: null })
  }

  const saveTable = (table: CafeTable) => {
    workspace.saveTable(table)
    setTableModal({ open: false, table: null })
  }

  return (
    <>
      <AdminShell
        section={section}
        sections={allowedSections}
        restaurantName={restaurant?.name ?? "Your restaurant"}
        userName={userName}
        userRole={role ? roleLabels[role] : ""}
        userInitials={getInitials(userName)}
        onSignOut={() => void signOut()}
        mobileNavOpen={mobileNavOpen}
        onNavigate={navigate}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
        onCloseMobileNav={() => setMobileNavOpen(false)}
      >
        {section === "catalog" && <CatalogPage
          items={workspace.items}
          sections={workspace.catalogSections}
          onAdd={() => setItemModal({ open: true, item: null })}
          onEdit={(item) => setItemModal({ open: true, item })}
          onDelete={workspace.deleteItem}
          onBulkAvailability={workspace.bulkAvailabilityItems}
          onBulkDelete={workspace.bulkDeleteItems}
          onManageSections={() => setSectionsModalOpen(true)}
        />}
        {section === "tables" && <TablesPage
          tables={workspace.tables}
          onAdd={() => setTableModal({ open: true, table: null })}
          onEdit={(table) => setTableModal({ open: true, table })}
          onDelete={workspace.deleteTable}
          onToggleAvailability={workspace.toggleTableAvailability}
          onBulkAvailability={workspace.bulkAvailabilityTables}
          onBulkDelete={workspace.bulkDeleteTables}
          onNotify={showToast}
        />}
        {section === "users" && <UsersPage
          users={workspace.users}
          onAdd={() => setUserModal({ open: true, user: null })}
          onEdit={(user) => setUserModal({ open: true, user })}
          onDelete={workspace.deleteUser}
          onBulkStatus={workspace.bulkStatusUsers}
          onBulkDelete={workspace.bulkDeleteUsers}
        />}
        {section === "orders" && <OrdersPage onNotify={showToast} />}
      </AdminShell>

      {itemModal.open && <ItemModal item={itemModal.item} sections={workspace.catalogSections} onClose={() => setItemModal({ open: false, item: null })} onSave={saveItem} />}
      {tableModal.open && <TableModal table={tableModal.table} tables={workspace.tables} onClose={() => setTableModal({ open: false, table: null })} onSave={saveTable} />}
      {userModal.open && <UserModal user={userModal.user} onClose={() => setUserModal({ open: false, user: null })} onSave={saveUser} />}
      {sectionsModalOpen && <SectionsModal
        sections={workspace.catalogSections}
        onClose={() => setSectionsModalOpen(false)}
        onSave={(nextSections, renamed, deleted) => {
          workspace.saveCatalogSections(nextSections, renamed, deleted)
          setSectionsModalOpen(false)
        }}
      />}
      {confirmation && <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
      {toast && <div className={styles["toast"]} role="status">{toast}</div>}
    </>
  )
}
