import type { Order } from "../../types"

export function getOrderDate(value: string) {
  const currentDate = new Date()
  const [dateLabel, timeLabel] = value.split(", ")
  const orderDate = dateLabel === "Today"
    ? new Date(currentDate)
    : dateLabel === "Yesterday"
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)
      : new Date(`${dateLabel}, ${currentDate.getFullYear()}`)
  const timeMatch = timeLabel?.match(/(\d+):(\d+) (AM|PM)/)
  if (timeMatch) {
    const hours = (Number(timeMatch[1]) % 12) + (timeMatch[3] === "PM" ? 12 : 0)
    orderDate.setHours(hours, Number(timeMatch[2]), 0, 0)
  }
  return orderDate
}

export function formatRunningTime(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - getOrderDate(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function getRefundStatus(order: Pick<Order, "total" | "refundedAmount">) {
  if (order.refundedAmount <= 0) return null
  return order.refundedAmount >= Number(order.total.replace("$", "")) ? "Refunded" : "Partial refund"
}
