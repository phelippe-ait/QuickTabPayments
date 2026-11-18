import { requireSupabase } from "./client";

/**
 * Shape returned by the `get_sales_report` RPC (migration 0021). Money and
 * per-item revenue arrive as text so Postgres can avoid float drift; this
 * layer is the only place that turns them into numbers.
 */
export type SalesReportTopItem = {
  name: string;
  quantity: number;
  revenue: number;
};

export type SalesReportBusyHour = {
  hour: number;
  orders: number;
};

export type SalesReport = {
  currency: string;
  from: string;
  to: string;
  order_count: number;
  gross_revenue: number;
  paid_revenue: number;
  refunded_amount: number;
  aov: number;
  /** Revenue-led top 10 (migration 0021). */
  top_items: SalesReportTopItem[];
  /** Quantity-led top 10 for kitchen prep (migration 0026). */
  popular_items: SalesReportTopItem[];
  busy_hours: SalesReportBusyHour[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown): number {
  return Math.trunc(toNumber(value));
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

function itemRecords(value: unknown): SalesReportTopItem[] {
  return asRecords(value).map((item) => ({
    name: typeof item.name === "string" ? item.name : "",
    quantity: toInteger(item.quantity),
    revenue: toNumber(item.revenue),
  }));
}

/** Parse the RPC's jsonb payload, tolerating null/missing money fields. */
export function parseSalesReport(payload: unknown): SalesReport {
  const row =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};

  return {
    currency: typeof row.currency === "string" ? row.currency : "AUD",
    from: typeof row.from === "string" ? row.from : "",
    to: typeof row.to === "string" ? row.to : "",
    order_count: toInteger(row.order_count),
    gross_revenue: toNumber(row.gross_revenue),
    paid_revenue: toNumber(row.paid_revenue),
    refunded_amount: toNumber(row.refunded_amount),
    aov: toNumber(row.aov),
    top_items: itemRecords(row.top_items),
    popular_items: itemRecords(row.popular_items),
    busy_hours: asRecords(row.busy_hours).map((entry) => ({
      hour: toInteger(entry.hour),
      orders: toInteger(entry.orders),
    })),
  };
}

function reportError(error: { message?: string; code?: string }): Error {
  const message = error.message ?? "";
  const isRaise = error.code === "P0001" || error.code === "P0002";

  if (isRaise && message.includes("not_authorised")) {
    return new Error("You do not have permission to view sales reports.");
  }
  if (isRaise && message.includes("invalid_date_range")) {
    return new Error("Choose a valid date range and try again.");
  }
  return new Error(message || "The sales report could not be loaded.");
}

export async function fetchSalesReport(
  from: string | null,
  to: string | null,
): Promise<SalesReport> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_sales_report", {
    p_from: from,
    p_to: to,
  });

  if (error) throw reportError(error);
  return parseSalesReport(data);
}

export const reportKeys = {
  all: (restaurantId: string) => ["sales-report", restaurantId] as const,
  range: (restaurantId: string, from: string | null, to: string | null) =>
    ["sales-report", restaurantId, from, to] as const,
};
