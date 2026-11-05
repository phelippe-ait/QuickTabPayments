export type AddressMatch = {
  label: string
  latitude: number
  longitude: number
}

type NominatimResult = {
  display_name?: unknown
  lat?: unknown
  lon?: unknown
}

/** A user-triggered, single-address lookup kept behind one provider boundary. */
export async function findAddressMatches(address: string): Promise<AddressMatch[]> {
  const query = address.trim()
  if (!query) return []

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "5")
  url.searchParams.set("q", query)

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    referrerPolicy: "strict-origin-when-cross-origin",
  })
  if (!response.ok) throw new Error("Address lookup is temporarily unavailable.")

  const results = (await response.json()) as NominatimResult[]
  return results.flatMap((result) => {
    const latitude = Number(result.lat)
    const longitude = Number(result.lon)
    if (
      typeof result.display_name !== "string" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      return []
    }
    return [{ label: result.display_name, latitude, longitude }]
  })
}
