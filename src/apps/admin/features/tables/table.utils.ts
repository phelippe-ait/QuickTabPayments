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
