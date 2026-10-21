import { useEffect, useMemo, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill, type StatusTone } from "@shared/ui/StatusPill"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import { ConfirmDialog, EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { starterOrders } from "../../data/fixtures"
import { formatRunningTime, getOrderDate, getRefundStatus } from "./order.utils"

const orderTone: Record<string, StatusTone> = {
  Active: "info",
  Completed: "success",
  Canceled: "danger",
};

export function OrdersPage() {
  const { notify } = useAdminUi()
  const [orderList, setOrderList] = useState(starterOrders)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All orders")
  const [dateFrom, setDateFrom] = useState("")
  const [dateUntil, setDateUntil] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [refundMode, setRefundMode] = useState<"full" | "partial" | "custom" | null>(null)
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({})
  const [customRefundAmount, setCustomRefundAmount] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [confirmingRefund, setConfirmingRefund] = useState(false)
  const [confirmingCancellation, setConfirmingCancellation] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const selectedOrder = orderList.find((order) => order.id === selectedOrderId) ?? null
  const visible = useMemo(() => orderList.filter((order) => {
    const orderDate = getOrderDate(order.date)
    const orderDateKey = [
      orderDate.getFullYear(),
      String(orderDate.getMonth() + 1).padStart(2, "0"),
      String(orderDate.getDate()).padStart(2, "0"),
    ].join("-")
    const matchesDate = (!dateFrom || orderDateKey >= dateFrom) && (!dateUntil || orderDateKey <= dateUntil)
    const matchesStatus =
      status === "All orders" ||
      (status === "Refunded orders" ? order.refundedAmount > 0 : order.status === status)
    return matchesStatus &&
      matchesDate &&
      `${order.id} ${order.customer}`.toLowerCase().includes(query.toLowerCase())
  }), [dateFrom, dateUntil, orderList, query, status])
  const partialRefundAmount = selectedOrder?.lineItems.reduce((total, item) => total + (Number(item.price.replace("$", "")) / item.quantity) * (refundQuantities[item.name] ?? 0), 0) ?? 0
  const refundableBalance = selectedOrder ? Math.max(0, Number(selectedOrder.total.replace("$", "")) - selectedOrder.refundedAmount) : 0
  const refundAmount = refundMode === "full" ? refundableBalance : refundMode === "custom" ? Number(customRefundAmount) || 0 : partialRefundAmount
  useEffect(() => setSelected((current) => current.filter((id) => orderList.some((order) => order.id === id))), [orderList])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const openOrder = (id: string) => {
    setSelectedOrderId(id)
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
  }
  const closeOrder = () => {
    setSelectedOrderId(null)
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
  }
  const exportOrders = (orders: typeof orderList) => {
    const spreadsheetCell = (value: string) => {
      const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replaceAll('"', '""')}"`
    }
    const rows = [
      ["Order", "Table", "Customer", "Date", "Total", "Status", "Refund status"],
      ...orders.map((order) => [order.id, order.table, order.customer, order.date, order.total, order.status, getRefundStatus(order) ?? ""]),
    ]
    const csv = rows.map((row) => row.map((cell) => spreadsheetCell(String(cell))).join(",")).join("\n")
    const downloadUrl = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    notify(`${orders.length} ${orders.length === 1 ? "order" : "orders"} exported`)
  }
  const confirmRefund = () => {
    if (!selectedOrder) return
    const fullTotal = Number(selectedOrder.total.replace("$", ""))
    const amount = refundAmount
    if (amount <= 0) return
    const totalRefunded = Math.min(fullTotal, selectedOrder.refundedAmount + amount)
    setOrderList((current) => current.map((order) => order.id === selectedOrder.id ? {
      ...order,
      refundedAmount: totalRefunded,
    } : order))
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
    setConfirmingRefund(false)
    notify(`Refund completed for order ${selectedOrder.id}`)
  }
  const cancelOrder = () => {
    if (!selectedOrder || selectedOrder.status !== "Active") return
    setOrderList((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, status: "Canceled" } : order))
    setConfirmingCancellation(false)
    notify(`Order ${selectedOrder.id} canceled`)
  }
  return (
    <>
      <PageHeader eyebrow="Sales archive" title="Order history" description="Review active, completed, canceled, and refunded orders from your café." />
      <div className={`${styles["stats"]}`}>
        <div><span>Today’s orders</span><strong>24</strong><small>12% from yesterday</small></div>
        <div><span>Today’s revenue</span><strong>$286.40</strong><small>8% from yesterday</small></div>
        <div><span>Average order</span><strong>$11.93</strong><small>Across all orders</small></div>
      </div>
      <div className={`${styles["toolbar"]} ${styles["orders-toolbar"]}`}>
        <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" /></label>
        <div className={`${styles["order-filters"]}`}>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Order status</span>
            <div className={`${styles["filter-pills"]}`}>
              {["All orders", "Active", "Completed", "Canceled"].map((item) => <button key={item} className={status === item ? styles["active"] : ""} onClick={() => setStatus(item)}>{item}</button>)}
            </div>
          </div>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Refunds</span>
            <div className={`${styles["filter-pills"]}`}>
              <button className={status === "Refunded orders" ? styles["active"] : ""} onClick={() => setStatus("Refunded orders")}>Refunded</button>
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
            disabled={!query && status === "All orders" && !dateFrom && !dateUntil}
            onClick={() => {
              setQuery("")
              setStatus("All orders")
              setDateFrom("")
              setDateUntil("")
            }}
          >
            Reset filters
          </button>
          <button className={`${styles["export-table"]}`} type="button" disabled={visible.length === 0} onClick={() => exportOrders(visible)}>
            <Icon name="download" size={15} />
            Export table
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => exportOrders(orderList.filter((order) => selected.includes(order.id)))}><Icon name="download" size={14} />Export selected</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No orders found" description="Try changing your search, status, or date filters." />
      ) : <div className={`${styles["table-card"]} ${styles["order-table"]} selection-table`}>
        <div className={`${styles["table-heading"]}`}>
          <label className={`${styles["inline-select"]}`} aria-label="Select all visible orders"><input type="checkbox" checked={visible.every((order) => selected.includes(order.id))} onChange={() => setSelected(visible.every((order) => selected.includes(order.id)) ? selected.filter((id) => !visible.some((order) => order.id === id)) : [...new Set([...selected, ...visible.map((order) => order.id)])])} /></label>
          <span>Order</span><span>Customer</span><span>Date</span><span>Total</span><span>Status</span>
        </div>
        {visible.map((order) => (
          <div
            className={`${styles["table-row"]} ${styles["clickable-order"]}`}
            key={order.id}
            role="button"
            tabIndex={0}
            onClick={() => openOrder(order.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openOrder(order.id)
            }}
          >
            <label className={`${styles["inline-select"]}`} aria-label={`Select order ${order.id}`} onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" checked={selected.includes(order.id)} onChange={() => setSelected((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} />
            </label>
            <strong>{order.id}</strong>
            <div><strong>{order.customer}</strong><small>{order.items} · Table {order.table}</small></div>
            <div><span>{order.date}</span>{order.status === "Active" && <small className={`${styles["running-time"]}`}>Running {formatRunningTime(order.date, now)}</small>}</div>
            <strong>{order.total}</strong>
            <div className={`${styles["order-statuses"]}`}>
              <StatusPill tone={orderTone[order.status] ?? "neutral"}>{order.status}</StatusPill>
              {getRefundStatus(order) && <StatusPill tone={getRefundStatus(order) === "Refunded" ? "warning" : "neutral"} className="whitespace-nowrap">{getRefundStatus(order)}</StatusPill>}
            </div>
          </div>
        ))}
      </div>}
      {selectedOrder && (
        <AdminModal labelledBy="order-detail-title" onClose={closeOrder} panelClassName={styles["order-detail"]} backdropClassName={styles["order-backdrop"]}>
            <p className={`${styles["modal-kicker"]}`}>Order details</p>
            <div className={`${styles["order-detail-title"]}`}>
              <div><h2 id="order-detail-title">{selectedOrder.id}</h2><p>{selectedOrder.date} · Table {selectedOrder.table}{selectedOrder.status === "Active" && <strong className={`${styles["running-time"]}`}>Running {formatRunningTime(selectedOrder.date, now)}</strong>}</p></div>
              <StatusPill tone={orderTone[selectedOrder.status] ?? "neutral"}>{selectedOrder.status}</StatusPill>
            </div>
            <div className={`${styles["order-customer"]}`}>
              <span>{selectedOrder.customer.split(" ").map((part) => part[0]).join("")}</span>
              <div><small>Customer</small><strong>{selectedOrder.customer}</strong></div>
            </div>
            <h3>Items in this order</h3>
            <div className={`${styles["order-lines"]}`}>
              {selectedOrder.lineItems.map((item) => (
                <div className={`${styles["order-line"]}`} key={item.name}>
                  <img src={item.image} alt="" />
                  <div><strong>{item.name}</strong><small>Quantity {item.quantity}</small></div>
                  {refundMode === "partial" ? (
                    <div className={`${styles["refund-quantity"]}`}>
                      <button type="button" aria-label={`Remove one ${item.name} from refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [item.name]: Math.max(0, (refundQuantities[item.name] ?? 0) - 1) })}>−</button>
                      <strong>{refundQuantities[item.name] ?? 0}</strong>
                      <button type="button" aria-label={`Add one ${item.name} to refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [item.name]: Math.min(item.quantity, (refundQuantities[item.name] ?? 0) + 1) })}>+</button>
                    </div>
                  ) : <strong>{item.price}</strong>}
                </div>
              ))}
            </div>
            <div className={`${styles["order-summary"]}`}>
              <div><span>Subtotal</span><strong>{selectedOrder.total}</strong></div>
              <div><span>Tax</span><strong>Included</strong></div>
              <div className={`${styles["order-total"]}`}><span>Total</span><strong>{selectedOrder.total}</strong></div>
            </div>
            <div className={`${styles["payment-line"]}`}><span>Payment method</span><strong>{selectedOrder.payment}</strong></div>
            {selectedOrder.refundedAmount > 0 && (
              <div className={`${styles["refunded-line"]}`}><span>Refunded to date</span><strong>−${selectedOrder.refundedAmount.toFixed(2)}</strong></div>
            )}
            {selectedOrder.status === "Active" && (
              <button type="button" className={`${styles["cancel-order"]}`} onClick={() => setConfirmingCancellation(true)}>Cancel order</button>
            )}
            {selectedOrder.status !== "Canceled" && refundableBalance > 0 && !refundMode && (
              <div className={`${styles["refund-actions"]}`}>
                <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => setRefundMode("partial")}>Partial refund</button>
                <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => setRefundMode("custom")}>Other amount</button>
                <button type="button" className={`${styles["refund-button"]}`} onClick={() => setRefundMode("full")}>Refund full order</button>
              </div>
            )}
            {refundMode && (
              <div className={`${styles["refund-confirmation"]}`}>
                <div>
                  <span>{refundMode === "full" ? "Remaining balance" : refundMode === "custom" ? "Custom refund" : "Selected refund"}</span>
                  <strong>${refundAmount.toFixed(2)}</strong>
                </div>
                {refundMode === "custom" ? (
                  <label className={`${styles["custom-refund"]}`}>
                    Refund amount
                    <span><strong>$</strong><input autoFocus type="number" min="0.01" max={refundableBalance} step="0.01" value={customRefundAmount} onChange={(event) => setCustomRefundAmount(event.target.value)} /></span>
                    <small>Up to ${refundableBalance.toFixed(2)} can be refunded.</small>
                  </label>
                ) : <p>{refundMode === "full" ? `The remaining balance will be returned to ${selectedOrder.payment}.` : "Choose the quantity to refund beside each item."}</p>}
                <div>
                  <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => { setRefundMode(null); setRefundQuantities({}); setCustomRefundAmount("") }}>Cancel</button>
                  <button type="button" className={`${styles["refund-button"]}`} disabled={refundAmount <= 0 || refundAmount > refundableBalance} onClick={() => setConfirmingRefund(true)}>Confirm refund</button>
                </div>
              </div>
            )}
        </AdminModal>
      )}
      {confirmingRefund && selectedOrder && (
        <ConfirmDialog
          confirmation={{
            title: `Refund order ${selectedOrder.id}?`,
            description: `$${refundAmount.toFixed(2)} for Table ${selectedOrder.table} will be returned to ${selectedOrder.payment}. This action cannot be undone.`,
            actionLabel: "Issue refund",
            onConfirm: confirmRefund,
          }}
          onClose={() => setConfirmingRefund(false)}
        />
      )}
      {confirmingCancellation && selectedOrder && (
        <ConfirmDialog
          confirmation={{
            title: `Cancel order ${selectedOrder.id}?`,
            description: `The order for Table ${selectedOrder.table} will be marked as canceled and removed from the active queue. This action cannot be undone.`,
            actionLabel: "Cancel order",
            onConfirm: cancelOrder,
          }}
          onClose={() => setConfirmingCancellation(false)}
        />
      )}
    </>
  )
}
