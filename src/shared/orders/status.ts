import type { OrderStatus } from "@shared/lib/database.types"
import type { StatusTone } from "@shared/ui/StatusPill"

/**
 * Single source of truth for order status display and transitions.
 *
 * `completed_at` means "closed at": it is set when an order enters `completed`
 * OR `cancelled`, so customers/staff must not read it as "picked up". Refunds
 * are independent rows against `payments`; cancelling never auto-refunds.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const satisfies readonly OrderStatus[]

export const OPEN_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
] as const satisfies readonly OrderStatus[]

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const orderStatusTones: Record<OrderStatus, StatusTone> = {
  pending: "neutral",
  confirmed: "info",
  preparing: "warning",
  ready: "primary",
  completed: "success",
  cancelled: "danger",
}

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function canTransitionStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return transitions[from].includes(to)
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...transitions[from]]
}

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return (OPEN_ORDER_STATUSES as readonly OrderStatus[]).includes(status)
}
