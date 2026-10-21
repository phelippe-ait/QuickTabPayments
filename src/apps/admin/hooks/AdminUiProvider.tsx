/* eslint-disable react-refresh/only-export-components -- provider + hook share one file */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import styles from "../App.module.css"
import { ConfirmDialog } from "../components/AdminUi"
import { useAdminToast } from "./useAdminToast"
import type { Confirmation } from "../types"

type AdminUiContextValue = {
  /** Show a short-lived status toast. */
  notify: (message: string) => void
  /** Ask for confirmation before a destructive action. */
  confirm: (confirmation: Confirmation) => void
}

const AdminUiContext = createContext<AdminUiContextValue | null>(null)

/**
 * Shared toast + confirmation host for admin pages. The layout mounts it once
 * so pages can raise feedback without owning modal plumbing.
 */
export function AdminUiProvider({ children }: { children: ReactNode }) {
  const { toast, showToast } = useAdminToast()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const confirm = useCallback(
    (next: Confirmation) => setConfirmation(next),
    [],
  )

  const value = useMemo<AdminUiContextValue>(
    () => ({ notify: showToast, confirm }),
    [confirm, showToast],
  )

  return (
    <AdminUiContext.Provider value={value}>
      {children}
      {confirmation && (
        <ConfirmDialog
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
        />
      )}
      {toast && (
        <div className={styles["toast"]} role="status">
          {toast}
        </div>
      )}
    </AdminUiContext.Provider>
  )
}

export function useAdminUi(): AdminUiContextValue {
  const value = useContext(AdminUiContext)
  if (!value) {
    throw new Error("useAdminUi must be used inside AdminUiProvider")
  }
  return value
}
