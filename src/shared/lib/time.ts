function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
    second: value("second"),
  }
}

/**
 * UTC instant for local midnight of `YYYY-MM-DD` in an IANA timezone.
 * Used for server-side order date filters without adding a date library.
 */
export function startOfDayInZone(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const target = Date.UTC(year, month - 1, day, 0, 0, 0)
  let candidate = target

  // Two passes handle DST offsets that differ between the guess and midnight.
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = zonedParts(new Date(candidate), timeZone)
    const asUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    )
    candidate += target - asUtc
  }

  return new Date(candidate).toISOString()
}

/** Inclusive end of an order date filter. */
export function endOfDayInZone(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const nextDate = next.toISOString().slice(0, 10)
  return new Date(
    new Date(startOfDayInZone(nextDate, timeZone)).getTime() - 1,
  ).toISOString()
}
