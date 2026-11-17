import type { Order } from "../types";
import type { Database, PaymentStatus } from "@shared/lib/database.types";
import { roundMoney } from "@shared/lib/money";
import { paymentStatusLabel } from "@shared/orders/paymentLabels";

type DatabaseOrder = Database["public"]["Tables"]["orders"]["Row"];

type HistoryItemRow = {
  item_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  notes: string | null;
  order_item_modifiers?: { modifier_name_snapshot: string }[];
  menu_items: { allergens: string[] | null } | null;
};

type HistoryRow = DatabaseOrder & {
  tables: { table_number: string } | null;
  payments: { status: PaymentStatus }[];
  order_items?: HistoryItemRow[];
};

type OrderNotes = {
  customerName?: string;
  items?: Array<{
    name?: string;
    unitPrice?: number;
    quantity?: number;
  }>;
};

function readOrderNotes(notes: string | null): OrderNotes {
  if (!notes) return {};
  try {
    const parsed: unknown = JSON.parse(notes);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as OrderNotes;
  } catch {
    return {};
  }
}

function formatOrderTime(value: string): string {
  const createdAt = new Date(value);
  const time = createdAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const isToday = createdAt.toDateString() === new Date().toDateString();
  return isToday ? `Today, ${time}` : `${createdAt.toLocaleDateString()} ${time}`;
}

export function toHistoryOrder(row: HistoryRow): Order {
  const notes = readOrderNotes(row.notes);
  const kitchenStatus = {
    pending: "New",
    confirmed: "New",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  }[row.status] as Order["kitchenStatus"];

  const latestPayment = row.payments?.[0];
  const tipAmount = Number(row.tip_amount ?? 0);

  // `order_items` is authoritative (migration 0015+). The notes JSON is only a
  // fallback for legacy Phase 5 orders placed before line items existed.
  const lineItems = row.order_items?.length
    ? row.order_items.map((item) => ({
        name: item.item_name_snapshot,
        qty: item.quantity,
        price: item.unit_price_snapshot,
        ...((item.order_item_modifiers?.length ?? 0) > 0
          ? {
              modifiers: item.order_item_modifiers!.map(
                (modifier) => modifier.modifier_name_snapshot,
              ),
            }
          : {}),
        ...((item.menu_items?.allergens?.length ?? 0) > 0
          ? { allergens: item.menu_items!.allergens! }
          : {}),
      }))
    : (notes.items ?? []).map((item) => ({
        name: item.name || "Menu item",
        qty: Number(item.quantity) || 0,
        price: Number(item.unitPrice) || 0,
      }))

  return {
    id: row.order_number,
    databaseId: row.id,
    table: row.tables ? `Table ${row.tables.table_number}` : "—",
    guest: row.customer_name_snapshot || notes.customerName || "Guest",
    createdAt: row.created_at,
    time: formatOrderTime(row.created_at),
    total: Number(row.total),
    tipAmount,
    amountDue: roundMoney(Number(row.total) + tipAmount),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    status:
      row.status === "completed"
        ? "Completed"
        : row.status === "cancelled"
          ? "Cancelled"
          : "In progress",
    kitchenStatus,
    server: "—",
    guests: 1,
    payment: latestPayment ? paymentStatusLabel(latestPayment.status) : "—",
    items: lineItems,
  };
}
