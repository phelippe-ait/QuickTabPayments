/**
 * Canonical QR URL contract (see README):
 *
 *   {origin}/?r={restaurant.slug}&t={table.qr_token}
 *
 * `parseQrParams` only parses; resolving the slug/token against the database
 * happens in `apps/customer/data/qrContext.ts`. Older `?table={number}` links
 * are intentionally unsupported.
 */
export function buildTableQrUrl({
  origin,
  slug,
  qrToken,
}: {
  origin?: string
  slug: string
  qrToken: string
}): string {
  const base = origin ?? window.location.origin
  const url = new URL(base)
  url.pathname = "/"
  url.search = ""
  url.hash = ""
  url.searchParams.set("r", slug)
  url.searchParams.set("t", qrToken)
  return url.toString()
}

export type QrParams =
  | { status: "ok"; slug: string; tableToken: string }
  | { status: "none" }
  | { status: "incomplete"; missing: Array<"r" | "t"> }

/** Parse `?r=<slug>&t=<table token>` from a location search string. */
export function parseQrParams(search: string): QrParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  )
  const slug = params.get("r")?.trim() ?? ""
  const tableToken = params.get("t")?.trim() ?? ""

  // No QR contract keys at all: the app may use a stored/dev context.
  if (!params.has("r") && !params.has("t")) return { status: "none" }

  const missing: Array<"r" | "t"> = []
  if (!slug) missing.push("r")
  if (!tableToken) missing.push("t")
  if (missing.length > 0) return { status: "incomplete", missing }

  return { status: "ok", slug, tableToken }
}
