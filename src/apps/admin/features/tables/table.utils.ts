import type { TableStatus } from "@shared/lib/database.types"

export type TableOccupancyState = "occupied" | "needs_cleaning" | "free"

/**
 * Staff own the floor plan. Confirmed orders mark their table occupied
 * automatically (database trigger), so `tables.status` is the single source of
 * truth here. Only staff can free or mark a table for cleaning.
 */
export function tableOccupancyState(
  status: TableStatus,
): TableOccupancyState {
  if (status === "occupied") return "occupied"
  if (status === "needs_cleaning") return "needs_cleaning"
  return "free"
}

/** Human-readable elapsed time from a real ISO timestamp. */
export function formatElapsed(startedAt: string, now: number): string {
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return "just now"

  const minutes = Math.max(0, Math.floor((now - started) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m ago` : `${hours}h ago`
}

/** Seats are optional; Pick-up tables never show a count. */
export function normaliseSeats(
  locationLabel: string,
  seats: string,
): number | null {
  if (locationLabel.trim().toLowerCase() === "pick-up") return null
  if (!seats.trim()) return null
  return Number(seats)
}
