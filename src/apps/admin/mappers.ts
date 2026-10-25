import type {
  CafeTable as DbTable,
  MenuCategory,
  MenuItem as DbMenuItem,
} from "@shared/lib/database.types"
import type { OpenTableOrder, OrderWithDetails } from "@shared/data/orders"
import type { StaffDirectoryEntry } from "@shared/data/restaurants"
import type { CategoryVM, MenuItemVM, OrderVM, StaffVM, TableVM } from "./viewModels"

/**
 * Database rows → admin view models. Keep this free of React so the mapping
 * can be unit-tested and reused by hooks.
 */

export function toCategoryVM(row: MenuCategory): CategoryVM {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
  }
}

export function toMenuItemVM(
  row: DbMenuItem,
  categories: MenuCategory[],
): MenuItemVM {
  const category = categories.find((entry) => entry.id === row.category_id)

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: category?.name ?? "Uncategorized",
    description: row.description ?? "",
    price: row.price,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    displayOrder: row.display_order,
  }
}

function formatOrderDate(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date)
}

function paymentMethodLabel(method: string | null): string {
  switch (method) {
    case "card":
      return "Card"
    case "apple_pay":
      return "Apple Pay"
    case "google_pay":
      return "Google Pay"
    default:
      return "Other"
  }
}

export function toOrderVM(
  row: OrderWithDetails,
  restaurant: { currency: string; timezone: string },
): OrderVM {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    createdAt: row.created_at,
    createdAtLabel: formatOrderDate(row.created_at, restaurant.timezone),
    total: row.total,
    subtotal: row.subtotal,
    tax: row.tax,
    currency: restaurant.currency,
    tableNumber: row.tables?.table_number ?? null,
    customerName: row.customer_name_snapshot?.trim() || "Guest",
    lineItems: row.order_items.map((item) => ({
      id: item.id,
      name: item.item_name_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price_snapshot,
      subtotal: item.subtotal,
      imageUrl: item.menu_items?.image_url ?? null,
      notes: item.notes,
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      method: paymentMethodLabel(payment.payment_method_type),
      paidAt: payment.paid_at,
      receiptUrl: payment.receipt_url,
      failureReason: payment.failure_reason,
    })),
    refundedTotal: (row.refunds ?? [])
      .filter((refund) => refund.status === "succeeded")
      .reduce((total, refund) => total + refund.amount, 0),
  }
}

export function toStaffVM(entry: StaffDirectoryEntry): StaffVM {
  const fullName = [entry.first_name, entry.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  const name =
    fullName || entry.email?.split("@")[0] || "Team member"
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return {
    staffId: entry.staff_id,
    userId: entry.user_id,
    name,
    email: entry.email ?? "",
    initials: initials || "TM",
    role: entry.role,
    isActive: entry.is_active,
  }
}

export function toTableVM(
  row: DbTable,
  openOrder: OpenTableOrder | undefined,
): TableVM {
  return {
    id: row.id,
    number: row.table_number,
    locationLabel: row.location_label,
    seats: row.seats,
    isActive: row.is_active,
    qrToken: row.qr_token,
    openOrder: openOrder
      ? {
          orderNumber: openOrder.orderNumber,
          status: openOrder.status,
          startedAt: openOrder.createdAt,
        }
      : null,
  }
}
