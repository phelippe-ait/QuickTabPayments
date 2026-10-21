import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { Button } from "@shared/ui/Button"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useRestaurant } from "@shared/restaurant/RestaurantProvider"
import { formatMoney } from "@shared/lib/money"
import { endOfDayInZone, startOfDayInZone } from "@shared/lib/time"
import {
  ORDER_STATUSES,
  isOpenOrderStatus,
  orderStatusLabels,
  orderStatusTones,
} from "@shared/orders/status"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useOrderStats, useOrders } from "../../hooks/useOrders"
import type { OrderStatus } from "@shared/lib/database.types"
import type { OrderVM } from "../../types"
import { formatRunningTime, getRefundStatus } from "./order.utils"

const PAGE_SIZE = 25

function deltaLabel(today: number, yesterday: number): string {
  if (yesterday === 0) return today === 0 ? "No orders yet" : "No orders yesterday"
  const change = Math.round(((today - yesterday) / yesterday) * 100)
  if (change === 0) return "Same as yesterday"
  return `${change > 0 ? "+" : ""}${change}% from yesterday`
}

export function OrdersPage() {
  const { restaurant } = useRestaurant()
  const { notify } = useAdminUi()
  const restaurantId = restaurant?.id ?? ""
  const display = useMemo(
    () => ({
      currency: restaurant?.currency ?? "AUD",
      timezone: restaurant?.timezone ?? "UTC",
    }),
    [restaurant?.currency, restaurant?.timezone],
  )

  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateUntil, setDateUntil] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [now, setNow] = useState(() => Date.now())

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      status: status === "all" ? undefined : status,
      from: dateFrom ? startOfDayInZone(dateFrom, display.timezone) : undefined,
      to: dateUntil ? endOfDayInZone(dateUntil, display.timezone) : undefined,
      search: deferredQuery.trim() || undefined,
    }),
    [dateFrom, dateUntil, deferredQuery, display.timezone, page, status],
  )

  const ordersQuery = useOrders(restaurantId, filters, display)
  const statsQuery = useOrderStats(restaurantId, display.timezone)
  const orders = ordersQuery.orders
  const totalPages = Math.max(1, Math.ceil(ordersQuery.count / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateUntil, deferredQuery, status])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(
    () => setSelected((current) => current.filter((id) => orders.some((order) => order.id === id))),
    [orders],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const exportOrders = (rows: OrderVM[]) => {
    const spreadsheetCell = (value: string) => {
      const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replaceAll('"', '""')}"`
    }
    const csvRows = [
      ["Order", "Table", "Customer", "Date", "Total", "Status", "Refund status"],
      ...rows.map((order) => [
        order.orderNumber,
        order.tableNumber ?? "—",
        order.customerName,
        order.createdAtLabel,
        formatMoney(order.total, order.currency),
        orderStatusLabels[order.status],
        getRefundStatus(order.refundedTotal, order.total) ?? "",
      ]),
    ]
    const csv = csvRows
      .map((row) => row.map((cell) => spreadsheetCell(String(cell))).join(","))
      .join("\n")
    const downloadUrl = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    notify(`${rows.length} ${rows.length === 1 ? "order" : "orders"} exported`)
  }

  const visibleIds = orders.map((order) => order.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))

  return (
    <>
      <PageHeader eyebrow="Sales archive" title="Order history" description="Review live, completed, and cancelled orders from your restaurant." />

      <div className={`${styles["stats"]}`}>
        <div>
          <span>Today’s orders</span>
          <strong>{statsQuery.stats.today.orders}</strong>
          <small>{deltaLabel(statsQuery.stats.today.orders, statsQuery.stats.yesterday.orders)}</small>
        </div>
        <div>
          <span>Today’s revenue</span>
          <strong>{formatMoney(statsQuery.stats.today.revenue, display.currency)}</strong>
          <small>{deltaLabel(statsQuery.stats.today.revenue, statsQuery.stats.yesterday.revenue)}</small>
        </div>
        <div>
          <span>Average order</span>
          <strong>{formatMoney(statsQuery.stats.today.average, display.currency)}</strong>
          <small>Today’s completed and active orders</small>
        </div>
      </div>

      <div className={`${styles["toolbar"]} ${styles["orders-toolbar"]}`}>
        <label className={`${styles["search-box"]}`}>
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order # or customer" />
        </label>
        <div className={`${styles["order-filters"]}`}>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Order status</span>
            <div className={`${styles["filter-pills"]}`}>
              <button className={status === "all" ? styles["active"] : ""} onClick={() => setStatus("all")}>All orders</button>
              {ORDER_STATUSES.map((entry) => (
                <button key={entry} className={status === entry ? styles["active"] : ""} onClick={() => setStatus(entry)}>
                  {orderStatusLabels[entry]}
                </button>
              ))}
            </div>
          </div>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Date</span>
            <div className={`${styles["date-range"]}`}>
              <label className={`${styles["filter-select"]}`}>
                <span>From</span>
                <input type="date" value={dateFrom} max={dateUntil || undefined} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label className={`${styles["filter-select"]}`}>
                <span>Until</span>
                <input type="date" value={dateUntil} min={dateFrom || undefined} onChange={(event) => setDateUntil(event.target.value)} />
              </label>
            </div>
          </div>
          <button
            className={`${styles["reset-filters"]}`}
            type="button"
            disabled={!query && status === "all" && !dateFrom && !dateUntil}
            onClick={() => {
              setQuery("")
              setStatus("all")
              setDateFrom("")
              setDateUntil("")
            }}
          >
            Reset filters
          </button>
          <button className={`${styles["export-table"]}`} type="button" disabled={orders.length === 0} onClick={() => exportOrders(orders)}>
            <Icon name="download" size={15} />
            Export page
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => exportOrders(orders.filter((order) => selected.includes(order.id)))}><Icon name="download" size={14} />Export selected</button>
        </SelectionBar>
      )}

      {ordersQuery.error ? (
        <>
          <EmptyState title="We couldn't load orders" description={ordersQuery.error.message} />
          <div className="flex justify-center">
            <Button variant="secondary" onClick={ordersQuery.refetch}>Try again</Button>
          </div>
        </>
      ) : ordersQuery.isLoading && orders.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-2" role="status">Loading orders…</div>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders found" description="Try changing your search, status, or date filters." />
      ) : (
        <div className={`${styles["table-card"]} ${styles["order-table"]} selection-table`}>
          <div className={`${styles["table-heading"]}`}>
            <label className={`${styles["inline-select"]}`} aria-label="Select all visible orders">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(
                    allVisibleSelected
                      ? selected.filter((id) => !visibleIds.includes(id))
                      : [...new Set([...selected, ...visibleIds])],
                  )
                }
              />
            </label>
            <span>Order</span><span>Customer</span><span>Date</span><span>Total</span><span>Status</span>
          </div>
          {orders.map((order) => {
            const refundStatus = getRefundStatus(order.refundedTotal, order.total)
            return (
              <div className={`${styles["table-row"]}`} key={order.id}>
                <label className={`${styles["inline-select"]}`} aria-label={`Select order ${order.orderNumber}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(order.id)
                          ? current.filter((id) => id !== order.id)
                          : [...current, order.id],
                      )
                    }
                  />
                </label>
                <Link className={`${styles["order-link"]}`} to={`/admin/orders/${order.id}`}>
                  <strong>#{order.orderNumber}</strong>
                </Link>
                <div>
                  <strong>{order.customerName}</strong>
                  <small>{order.lineItems.length} {order.lineItems.length === 1 ? "item" : "items"}{order.tableNumber ? ` · Table ${order.tableNumber}` : ""}</small>
                </div>
                <div>
                  <span>{order.createdAtLabel}</span>
                  {isOpenOrderStatus(order.status) && <small className={`${styles["running-time"]}`}>Running {formatRunningTime(order.createdAt, now)}</small>}
                </div>
                <strong>{formatMoney(order.total, order.currency)}</strong>
                <div className={`${styles["order-statuses"]}`}>
                  <StatusPill tone={orderStatusTones[order.status]}>{orderStatusLabels[order.status]}</StatusPill>
                  {refundStatus && <StatusPill tone={refundStatus === "Refunded" ? "warning" : "neutral"} className="whitespace-nowrap">{refundStatus}</StatusPill>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">
          Page {page} of {totalPages} · {ordersQuery.count} {ordersQuery.count === 1 ? "order" : "orders"}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1 || ordersQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages || ordersQuery.isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button>
        </div>
      </div>
    </>
  )
}
