import type { StatusTone } from "@shared/ui/StatusPill"
import type { TableStatus } from "../../types"

/**
 * One tap moves a table through its operational cycle:
 * available → occupied → needs_cleaning → available.
 */
const nextStatus: Record<TableStatus, TableStatus> = {
  available: "occupied",
  occupied: "needs_cleaning",
  needs_cleaning: "available",
}

export function nextTableStatus(current: TableStatus): TableStatus {
  return nextStatus[current]
}

export const tableStatusLabels: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  needs_cleaning: "Needs cleaning",
}

/** Short, action-first copy for the single-tap cycle button. */
export const tableStatusActionLabels: Record<TableStatus, string> = {
  available: "Seat guests",
  occupied: "Mark for cleaning",
  needs_cleaning: "Mark clean",
}

const statusTones: Record<TableStatus, StatusTone> = {
  available: "success",
  occupied: "info",
  needs_cleaning: "warning",
}

export function tableStatusTone(status: TableStatus): StatusTone {
  return statusTones[status]
}

/** Sentence announced through the tables workspace `aria-live` region. */
export function tableStatusAnnouncement(
  tableNumber: string,
  status: TableStatus,
): string {
  return status === "needs_cleaning"
    ? `Table ${tableNumber} needs cleaning.`
    : `Table ${tableNumber} is now ${tableStatusLabels[status].toLowerCase()}.`
}
