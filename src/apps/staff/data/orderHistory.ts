import type { Order } from "../types";
import type { Database } from "@shared/lib/database.types";

type DatabaseOrder = Database["public"]["Tables"]["orders"]["Row"];

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
  const time = createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const isToday = createdAt.toDateString() === new Date().toDateString();
  return isToday ? `Today, ${time}` : `${createdAt.toLocaleDateString()} ${time}`;
}

export function toHistoryOrder(row: DatabaseOrder): Order {
  const notes = readOrderNotes(row.notes);
  const kitchenStatus = {
    pending: "New",
    confirmed: "New",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  }[row.status] as Order["kitchenStatus"];

  return {
    id: row.order_number,
    databaseId: row.id,
    table: "Pickup",
    guest: notes.customerName || "Guest",
    time: formatOrderTime(row.created_at),
    total: Number(row.total),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    status: row.status === "completed"
      ? "Completed"
      : row.status === "cancelled"
        ? "Cancelled"
        : "In progress",
    kitchenStatus,
    server: "—",
    guests: 1,
    payment: "Paid",
    items: (notes.items ?? []).map((item) => ({
      name: item.name || "Menu item",
      qty: Number(item.quantity) || 0,
      price: Number(item.unitPrice) || 0,
    })),
  };
}
