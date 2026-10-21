import { useState } from "react"
import { starterUsers } from "../data/fixtures"
import type { Confirmation, User } from "../types"

type UseAdminWorkspaceOptions = {
  notify: (message: string) => void;
  confirm: (confirmation: Confirmation) => void;
}

/**
 * Transitional in-memory user state until the staff directory lands in M7.
 * Catalog and tables are Supabase-backed already.
 */
export function useAdminWorkspace({ notify, confirm }: UseAdminWorkspaceOptions) {
  const [users, setUsers] = useState(starterUsers)

  const saveUser = (user: User) => {
    setUsers((current) => current.some((entry) => entry.id === user.id) ? current.map((entry) => entry.id === user.id ? user : entry) : [user, ...current])
    notify(`User ${user.name} saved`)
  }

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
    users,
    saveUser,
    deleteUser,
    bulkStatusUsers,
    bulkDeleteUsers,
  }
}
