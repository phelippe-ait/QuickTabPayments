/**
 * Canonical QR URL contract (see plan §9.1):
 *
 *   {origin}/?r={restaurant.slug}&t={table.qr_token}
 *
 * The customer app will resolve `r`/`t` later; older `?table={number}`
 * links are intentionally unsupported.
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
