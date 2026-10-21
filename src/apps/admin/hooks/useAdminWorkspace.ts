import { useState } from "react"
import { starterTables, starterUsers } from "../data/fixtures"
import type { CafeTable, Confirmation, User } from "../types"

type UseAdminWorkspaceOptions = {
  notify: (message: string) => void;
  confirm: (confirmation: Confirmation) => void;
}

/**
 * Transitional in-memory state for the sections that are not Supabase-backed
 * yet (tables until M4, users until M7). Catalog uses `useMenu`; this hook no
 * longer owns menu data.
 */
export function useAdminWorkspace({ notify, confirm }: UseAdminWorkspaceOptions) {
  const [tables, setTables] = useState<CafeTable[]>(() => {
    if (starterTables.some((table) => table.location === "Pick-up")) {
      return starterTables
    }

    const nextTableId = Math.max(0, ...starterTables.map((table) => table.id)) + 1;
    const pickUpTable: CafeTable = { id: nextTableId, number: "Pick-up", available: true, location: "Pick-up" }

    return [...starterTables, pickUpTable]
  });
  const [users, setUsers] = useState(starterUsers)

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

  return {
    tables,
    users,
    saveUser,
    saveTable,
    deleteTable,
    toggleTableAvailability,
    bulkAvailabilityTables,
    bulkDeleteTables,
    deleteUser,
    bulkStatusUsers,
    bulkDeleteUsers,
  }
}
