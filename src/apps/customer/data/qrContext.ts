import { requireSupabase } from "@shared/data/client"
import { parseQrParams, type QrParams } from "@shared/lib/qr"
import type { QrContext, QrErrorCode } from "../types"

/** Where the current QR destination is remembered across OAuth redirects. */
export const QR_SOURCE_KEY = "quicktab:qr-source"

export type QrSource = { slug: string; tableToken: string }

export type QrResolution =
  | { ok: true; context: QrContext }
  | { ok: false; error: QrErrorCode }

type ResolveRow = {
  error?: string
  restaurant_id?: string
  restaurant_slug?: string
  restaurant_name?: string
  currency?: string
  tax_rate?: number
  table_id?: string
  table_token?: string
  table_number?: string
}

const QR_ERRORS: QrErrorCode[] = [
  "missing_params",
  "restaurant_not_found",
  "table_not_found",
  "table_inactive",
]

function toQrError(value: unknown): QrErrorCode {
  return QR_ERRORS.includes(value as QrErrorCode)
    ? (value as QrErrorCode)
    : "unknown"
}

/** Pure mapper so resolver responses can be tested without Supabase. */
export function mapResolveResult(raw: unknown): QrResolution {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "unknown" }
  }
  const row = raw as ResolveRow
  if (row.error) return { ok: false, error: toQrError(row.error) }

  if (
    !row.restaurant_id ||
    !row.restaurant_slug ||
    !row.restaurant_name ||
    !row.table_id ||
    !row.table_token ||
    !row.table_number
  ) {
    return { ok: false, error: "unknown" }
  }

  return {
    ok: true,
    context: {
      restaurantId: row.restaurant_id,
      restaurantSlug: row.restaurant_slug,
      restaurantName: row.restaurant_name,
      currency: row.currency ?? "AUD",
      taxRate: Number(row.tax_rate ?? 0),
      tableId: row.table_id,
      tableToken: row.table_token,
      tableNumber: row.table_number,
    },
  }
}

export async function resolveQrContext(
  slug: string,
  tableToken: string,
): Promise<QrResolution> {
  const client = requireSupabase()
  const { data, error } = await client.rpc("resolve_qr_context", {
    p_slug: slug,
    p_token: tableToken,
  })

  if (error) {
    console.error("Could not resolve QR context", error)
    throw new Error("We couldn't open this menu. Please try again.")
  }

  return mapResolveResult(data)
}

/**
 * Development fallback: when the app is opened without QR params, use
 * `VITE_RESTAURANT_SLUG` and its first active table. Never used when a QR
 * token was supplied.
 */
export async function resolveDevQrContext(slug: string): Promise<QrResolution> {
  const client = requireSupabase()
  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id, slug, name, currency, tax_rate")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()

  if (restaurantError) throw new Error(restaurantError.message)
  if (!restaurant) return { ok: false, error: "restaurant_not_found" }

  const { data: table, error: tableError } = await client
    .from("tables")
    .select("id, qr_token, table_number")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("table_number", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (tableError) throw new Error(tableError.message)
  if (!table) return { ok: false, error: "table_not_found" }

  return {
    ok: true,
    context: {
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      currency: restaurant.currency,
      taxRate: Number(restaurant.tax_rate),
      tableId: table.id,
      tableToken: table.qr_token,
      tableNumber: table.table_number,
    },
  }
}

export function readStoredQrSource(): QrSource | null {
  try {
    const raw = window.sessionStorage.getItem(QR_SOURCE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const row = parsed as Record<string, unknown>
    if (typeof row.slug !== "string" || typeof row.tableToken !== "string") {
      return null
    }
    return { slug: row.slug, tableToken: row.tableToken }
  } catch {
    return null
  }
}

export function persistQrSource(source: QrSource): void {
  try {
    window.sessionStorage.setItem(QR_SOURCE_KEY, JSON.stringify(source))
  } catch {
    // Private-mode storage failures must not stop ordering.
  }
}

export function clearStoredQrSource(): void {
  try {
    window.sessionStorage.removeItem(QR_SOURCE_KEY)
  } catch {
    // ignore
  }
}

/** Remove the QR token from the visible URL once it has been resolved. */
export function stripQrParams(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("r") && !url.searchParams.has("t")) return
    url.searchParams.delete("r")
    url.searchParams.delete("t")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  } catch {
    // history is best-effort; the session context still works
  }
}

/**
 * Resolve the app's QR context on boot.
 *
 * Order of precedence:
 *   1. `?r=&t=` in the URL (incomplete params are a hard error)
 *   2. the QR source persisted for this session (survives OAuth redirects)
 *   3. the documented `VITE_RESTAURANT_SLUG` development fallback
 */
export async function resolveInitialQrContext(
  search: string = window.location.search,
): Promise<QrResolution> {
  const params: QrParams = parseQrParams(search)

  if (params.status === "incomplete") {
    return { ok: false, error: "missing_params" }
  }

  if (params.status === "ok") {
    const result = await resolveQrContext(params.slug, params.tableToken)
    if (result.ok) {
      persistQrSource({ slug: params.slug, tableToken: params.tableToken })
      stripQrParams()
    }
    return result
  }

  const stored = readStoredQrSource()
  if (stored) return resolveQrContext(stored.slug, stored.tableToken)

  const devSlug = import.meta.env.VITE_RESTAURANT_SLUG?.trim()
  if (devSlug) {
    const result = await resolveDevQrContext(devSlug)
    if (result.ok) {
      persistQrSource({
        slug: result.context.restaurantSlug,
        tableToken: result.context.tableToken,
      })
    }
    return result
  }

  return { ok: false, error: "no_context" }
}
