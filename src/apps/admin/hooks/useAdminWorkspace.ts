import { useState } from "react"
import { starterItems, starterTables, starterUsers } from "../data/fixtures"
import type { CafeTable, Confirmation, MenuItem, User } from "../types"

type UseAdminWorkspaceOptions = {
  notify: (message: string) => void;
  confirm: (confirmation: Confirmation) => void;
}

export function useAdminWorkspace({ notify, confirm }: UseAdminWorkspaceOptions) {
  const [items, setItems] = useState(starterItems);
  const [catalogSections, setCatalogSections] = useState(["Hot Beverages", "Breakfast", "Lunch"]);
  const [tables, setTables] = useState<CafeTable[]>(() => {
    if (starterTables.some((table) => table.location === "Pick-up")) {
      return starterTables
    }

    const nextTableId = Math.max(0, ...starterTables.map((table) => table.id)) + 1;
    const pickUpTable: CafeTable = { id: nextTableId, number: "Pick-up", available: true, location: "Pick-up" }

    return [...starterTables, pickUpTable]
  });
  const [users, setUsers] = useState(starterUsers)

  const saveItem = (item: MenuItem) => {
    setItems((current) => current.some((entry) => entry.id === item.id) ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current])
    notify(`Menu item ${item.name} saved`)
  }

  const saveUser = (user: User) => {
    setUsers((current) => current.some((entry) => entry.id === user.id) ? current.map((entry) => entry.id === user.id ? user : entry) : [user, ...current])
    notify(`User ${user.name} saved`)
  }

  const saveTable = (table: CafeTable) => {
    const normalizedTable = table.available
      ? { ...table, currentOrder: undefined, seatedAt: undefined }
      : { ...table, currentOrder: table.currentOrder ?? "Awaiting order", seatedAt: table.seatedAt ?? "Just now" }
    setTables((current) => current.some((entry) => entry.id === table.id) ? current.map((entry) => entry.id === table.id ? normalizedTable : entry) : [...current, normalizedTable])
    notify(`Table ${table.number} saved`)
  }

  const deleteItem = (id: number) => {
    const item = items.find((entry) => entry.id === id)
    confirm({
      title: `Delete ${item?.name ?? "menu item"}?`,
      description: "This item will be permanently removed from the catalog.",
      actionLabel: "Delete item",
      onConfirm: () => {
        setItems((current) => current.filter((entry) => entry.id !== id))
        notify("Menu item deleted")
      },
    })
  }

  const bulkAvailabilityItems = (ids: number[], available: boolean) => {
    setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, available } : item))
    notify(`${ids.length} menu items updated`)
  }

  const bulkDeleteItems = (ids: number[]) => confirm({
    title: `Delete ${ids.length} menu items?`,
    description: "The selected items will be permanently removed from the catalog.",
    actionLabel: "Delete items",
    onConfirm: () => {
      setItems((current) => current.filter((item) => !ids.includes(item.id)))
      notify(`${ids.length} menu items deleted`)
    },
  })

  const deleteTable = (id: number) => {
    const table = tables.find((entry) => entry.id === id)
    confirm({
      title: `Delete table ${table?.number ?? ""}?`,
      description: "Its ordering link and QR code will no longer be managed here.",
      actionLabel: "Delete table",
      onConfirm: () => {
        setTables((current) => current.filter((entry) => entry.id !== id))
        notify("Table deleted")
      },
    })
  }

  const toggleTableAvailability = (id: number) => {
    setTables((current) => current.map((table) => table.id === id
      ? table.available
        ? { ...table, available: false, currentOrder: "Awaiting order", seatedAt: "Just now" }
        : { ...table, available: true, currentOrder: undefined, seatedAt: undefined }
      : table))
    const table = tables.find((entry) => entry.id === id)
    notify(`Table ${table?.number} marked ${table?.available ? "occupied" : "available"}`)
  }

  const bulkAvailabilityTables = (ids: number[], available: boolean) => {
    setTables((current) => current.map((table) => ids.includes(table.id)
      ? available
        ? { ...table, available: true, currentOrder: undefined, seatedAt: undefined }
        : { ...table, available: false, currentOrder: table.currentOrder ?? "Awaiting order", seatedAt: table.seatedAt ?? "Just now" }
      : table))
    notify(`${ids.length} tables updated`)
  }

  const bulkDeleteTables = (ids: number[]) => confirm({
    title: `Delete ${ids.length} tables?`,
    description: "Their ordering links and QR codes will no longer be managed here.",
    actionLabel: "Delete tables",
    onConfirm: () => {
      setTables((current) => current.filter((table) => !ids.includes(table.id)))
      notify(`${ids.length} tables deleted`)
    },
  })

  const deleteUser = (id: number) => {
    const user = users.find((entry) => entry.id === id)
    confirm({
      title: `Delete ${user?.name ?? "user"}?`,
      description: "This person will lose access to the Café Shop workspace.",
      actionLabel: "Delete user",
      onConfirm: () => {
        setUsers((current) => current.filter((entry) => entry.id !== id))
        notify("User deleted")
      },
    })
  }

  const bulkStatusUsers = (ids: number[], status: User["status"]) => {
    setUsers((current) => current.map((user) => ids.includes(user.id) ? { ...user, status } : user))
    notify(`${ids.length} users marked ${status.toLowerCase()}`)
  }

  const bulkDeleteUsers = (ids: number[]) => confirm({
    title: `Delete ${ids.length} users?`,
    description: "The selected people will lose access to the Café Shop workspace.",
    actionLabel: "Delete users",
    onConfirm: () => {
      setUsers((current) => current.filter((user) => !ids.includes(user.id)))
      notify(`${ids.length} users deleted`)
    },
  })

  const saveCatalogSections = (nextSections: string[], renamed: Record<string, string>, deleted: string[]) => {
    setCatalogSections(nextSections)
    setItems((current) => current.map((item) => {
      if (renamed[item.category]) return { ...item, category: renamed[item.category] }
      if (deleted.includes(item.category)) return { ...item, category: nextSections[0] }
      return item
    }))
    notify("Catalog sections saved")
  }

  return {
    items,
    catalogSections,
    tables,
    users,
    saveItem,
    saveUser,
    saveTable,
    deleteItem,
    bulkAvailabilityItems,
    bulkDeleteItems,
    deleteTable,
    toggleTableAvailability,
    bulkAvailabilityTables,
    bulkDeleteTables,
    deleteUser,
    bulkStatusUsers,
    bulkDeleteUsers,
    saveCatalogSections,
  }
}
