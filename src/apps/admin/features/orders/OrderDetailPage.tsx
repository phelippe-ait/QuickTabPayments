import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { Button, buttonVariants } from "@shared/ui/Button"
import { EmptyState, PageHeader } from "../../components/AdminUi"
import { useAuth } from "@shared/auth/AuthContext"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { formatMoney } from "@shared/lib/money"
import {
  ORDER_STATUSES,
  isOpenOrderStatus,
  orderStatusLabels,
  orderStatusTones,
  nextStatuses,
} from "@shared/orders/status"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useOrder, useOrderMutations } from "../../hooks/useOrders"
import { useCreateRefund, useRefunds } from "../../hooks/useRefunds"
import { REFUNDS_ENABLED } from "../../flags"
import { formatRunningTime } from "./order.utils"
import {
  partialRefundAmount,
  refundableBalance,
  roundMoney,
  validateRefundAmount,
} from "./refund.utils"

const flow = ["pending", "confirmed", "preparing", "ready", "completed"] as const

function formatTimestamp(iso: string | null, timezone: string): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date)
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { restaurant, role } = useRestaurant()
  const { user } = useAuth()
  const { notify, confirm } = useAdminUi()
  const display = {
    currency: restaurant?.currency ?? "AUD",
    timezone: restaurant?.timezone ?? "UTC",
  }
  const { order, isLoading, error, refetch } = useOrder(restaurant?.id ?? "", id, display)
  const refundsQuery = useRefunds(order?.id ?? "")
  const refundMutation = useCreateRefund(order?.id ?? "", {
    onSuccess: notify,
    onError: notify,
  })
  const [now, setNow] = useState(() => Date.now())
  const [refundMode, setRefundMode] = useState<"full" | "partial" | "custom" | null>(null)
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({})
  const [customAmount, setCustomAmount] = useState("")

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const mutations = useOrderMutations(restaurant?.id ?? "", {
    onSuccess: notify,
    onError: notify,
  })
  const canManage = role === "owner" || role === "manager"

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Order details" title="Order" description="We couldn't load this order." />
        <EmptyState title="Order unavailable" description={error.message} />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={refetch}>Try again</Button>
        </div>
      </>
    )
  }

  if (isLoading || !order) {
    return (
      <div className="py-16 text-center text-sm text-muted-2" role="status">
        Loading order…
      </div>
    )
  }

  const currentIndex = flow.indexOf(order.status as (typeof flow)[number])
  const transitions = nextStatuses(order.status).filter((status) => status !== "cancelled")

  const succeededPayments = order.payments.filter((payment) => payment.status === "succeeded")
  const refundedToDate = refundsQuery.isLoading
    ? order.refundedTotal
    : refundsQuery.refunds
        .filter((refund) => refund.status === "succeeded")
        .reduce((total, refund) => total + refund.amount, 0)
  const refundable = refundableBalance(order.payments, refundedToDate)
  const partialAmount = partialRefundAmount(order.lineItems, refundQuantities)
  const refundAmount =
    refundMode === "full"
      ? refundable
      : refundMode === "custom"
        ? Number(customAmount) || 0
        : partialAmount
  const customError =
    refundMode === "custom" ? validateRefundAmount(refundAmount, refundable) : null
  const canRecordRefund =
    REFUNDS_ENABLED && canManage && succeededPayments.length > 0 && refundable > 0
  const showRefundSection =
    REFUNDS_ENABLED && (canRecordRefund || refundsQuery.refunds.length > 0)

  const resetRefundForm = () => {
    setRefundMode(null)
    setRefundQuantities({})
    setCustomAmount("")
  }

  const submitRefund = async () => {
    const payment = succeededPayments[0]
    if (!payment || !refundMode) return

    if (refundMode === "partial") {
      for (const line of order.lineItems) {
        const quantity = refundQuantities[line.id] ?? 0
        if (quantity <= 0) continue
        const ok = await refundMutation.createRefund({
          order_id: order.id,
          payment_id: payment.id,
          order_item_id: line.id,
          quantity,
          amount: roundMoney(line.unitPrice * quantity),
          reason: "Line refund",
          status: "succeeded",
          created_by: user?.id ?? null,
        })
        if (!ok) return
      }
    } else {
      const amount = roundMoney(refundMode === "full" ? refundable : refundAmount)
      const ok = await refundMutation.createRefund({
        order_id: order.id,
        payment_id: payment.id,
        amount,
        reason: refundMode === "full" ? "Full refund" : "Custom refund",
        status: "succeeded",
        created_by: user?.id ?? null,
      })
      if (!ok) return
    }

    resetRefundForm()
  }

  const requestRefundConfirmation = () => {
    if (!refundMode || refundAmount <= 0 || refundAmount > refundable) return
    if (refundMode === "custom" && customError) return

    const warning = isOpenOrderStatus(order.status)
      ? "This order is still active. "
      : ""

    confirm({
      title: `Record a ${refundMode === "full" ? "full" : refundMode} refund?`,
      description: `${warning}${formatMoney(refundAmount, order.currency)} will be recorded against ${succeededPayments[0]?.method ?? "the payment"}. Stripe is not called yet — the refund is recorded in QuickTab only.`,
      actionLabel: "Record refund",
      onConfirm: () => {
        void submitRefund()
      },
    })
  }

  const requestCancel = () => {
    const unrefunded = Math.max(0, roundMoney(
      succeededPayments.reduce((total, payment) => total + payment.amount, 0) - refundedToDate,
    ))
    confirm({
      title: `Cancel order #${order.orderNumber}?`,
      description:
        unrefunded > 0
          ? `${formatMoney(unrefunded, order.currency)} has been paid and will NOT be refunded automatically. Cancelling only closes the order.`
          : "The order will be marked cancelled. Cancelling never issues a refund automatically.",
      actionLabel: "Cancel order",
      onConfirm: () => {
        void mutations.cancel(order.id, order.status)
      },
    })
  }

  return (
    <>
      <Link to="/admin/orders" className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-berry">
        <Icon name="back" size={15} /> Back to orders
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow={order.tableNumber ? `Table ${order.tableNumber}` : "Pick-up order"}
          title={`#${order.orderNumber}`}
          description={`${order.createdAtLabel} · ${order.customerName}`}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="grid gap-5">
          <section className="rounded-card border border-line bg-paper p-7 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusPill tone={orderStatusTones[order.status]}>{orderStatusLabels[order.status]}</StatusPill>
                {isOpenOrderStatus(order.status) && (
                  <small className={`${styles["running-time"]}`}>Running {formatRunningTime(order.createdAt, now)}</small>
                )}
              </div>
              {canManage && transitions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {transitions.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      disabled={mutations.isMutating}
                      onClick={() => void mutations.setStatus(order.id, order.status, status)}
                    >
                      Mark {orderStatusLabels[status].toLowerCase()}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {order.status === "cancelled" ? (
              <p className="mt-5 rounded-[9px] bg-danger-soft px-4 py-3 text-xs font-bold text-danger">
                This order was cancelled. Cancelling does not issue a refund automatically.
              </p>
            ) : (
              <ol className="mt-6 flex flex-wrap gap-2" aria-label="Order progress">
                {flow.map((status, index) => {
                  const reached = currentIndex >= index
                  return (
                    <li
                      key={status}
                      className={`rounded-pill border px-3 py-1.5 text-[10px] font-bold ${
                        reached
                          ? "border-berry bg-berry-soft text-berry-strong"
                          : "border-line bg-white text-muted"
                      }`}
                      aria-current={order.status === status ? "step" : undefined}
                    >
                      {orderStatusLabels[status]}
                    </li>
                  )
                })}
              </ol>
            )}

            {canManage && order.status !== "cancelled" && order.status !== "completed" && (
              <button type="button" className={`${styles["cancel-order"]}`} onClick={requestCancel} disabled={mutations.isMutating}>
                Cancel order
              </button>
            )}
            {!canManage && (
              <p className="mt-5 text-xs text-muted">
                Kitchen accounts can view order details but cannot change status or issue refunds.
              </p>
            )}
          </section>

          <section className="rounded-card border border-line bg-paper p-7 shadow-card">
            <h2 className="font-serif text-2xl text-ink">Items</h2>
            <div className={`${styles["order-lines"]} mt-4`}>
              {order.lineItems.map((item) => (
                <div className={`${styles["order-line"]}`} key={item.id}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} />
                  ) : (
                    <span className="grid h-12 w-[52px] place-items-center rounded-[7px] bg-sand text-[9px] font-bold text-muted" aria-hidden="true">—</span>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <small>Quantity {item.quantity} · {formatMoney(item.unitPrice, order.currency)} each</small>
                    {item.notes && <small>{item.notes}</small>}
                  </div>
                  <strong>{formatMoney(item.subtotal, order.currency)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-5">
          <section className="rounded-card border border-line bg-paper p-7 shadow-card">
            <h2 className="font-serif text-2xl text-ink">Customer</h2>
            <div className={`${styles["order-customer"]}`}>
              <span>{order.customerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div><small>Name</small><strong>{order.customerName}</strong></div>
            </div>
            <div className={`${styles["order-summary"]}`}>
              <div><span>Subtotal</span><strong>{formatMoney(order.subtotal, order.currency)}</strong></div>
              <div><span>Tax</span><strong>{formatMoney(order.tax, order.currency)}</strong></div>
              <div className={`${styles["order-total"]}`}><span>Total</span><strong>{formatMoney(order.total, order.currency)}</strong></div>
            </div>
            {refundedToDate > 0 && (
              <div className={`${styles["refunded-line"]}`}><span>Refunded to date</span><strong>−{formatMoney(refundedToDate, order.currency)}</strong></div>
            )}
          </section>

          <section className="rounded-card border border-line bg-paper p-7 shadow-card">
            <h2 className="font-serif text-2xl text-ink">Payments</h2>
            {order.payments.length === 0 ? (
              <p className="mt-3 text-xs text-muted">No payment rows for this order.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="rounded-[9px] border border-line bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[12px] text-ink-soft">{payment.method}</strong>
                      <StatusPill tone={payment.status === "succeeded" ? "success" : payment.status === "failed" ? "danger" : payment.status === "refunded" ? "warning" : "neutral"} withDot={false}>
                        {payment.status}
                      </StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {formatMoney(payment.amount, payment.currency)} · paid {formatTimestamp(payment.paidAt, display.timezone)}
                    </p>
                    {payment.failureReason && <p className="mt-1 text-[11px] text-danger">{payment.failureReason}</p>}
                    {payment.receiptUrl && (
                      <a className="mt-2 inline-block text-[11px] font-bold text-berry underline" href={payment.receiptUrl} target="_blank" rel="noreferrer">
                        View receipt
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[10px] leading-relaxed text-muted">
              Payment rows are written by the payment provider and read-only here.
            </p>
          </section>

          {showRefundSection && (
            <section className="rounded-card border border-line bg-paper p-7 shadow-card">
              <h2 className="font-serif text-2xl text-ink">Refunds</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                Stripe refund not yet processed — this records the refund in QuickTab.
              </p>

              {refundsQuery.error && (
                <p className="mt-3 text-[12px] text-danger" role="alert">{refundsQuery.error.message}</p>
              )}

              {refundsQuery.refunds.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {refundsQuery.refunds.map((refund) => {
                    const line = order.lineItems.find((item) => item.id === refund.order_item_id)
                    return (
                      <div key={refund.id} className="rounded-[9px] border border-line bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-[12px] text-ink-soft">
                            {formatMoney(refund.amount, order.currency)}
                          </strong>
                          <StatusPill tone={refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "warning"} withDot={false}>
                            {refund.status}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {line ? `${line.name} × ${refund.quantity ?? 1}` : "Order-level refund"}
                          {refund.reason ? ` · ${refund.reason}` : ""}
                        </p>
                        <p className="mt-1 text-[10px] text-muted">{formatTimestamp(refund.created_at, display.timezone)}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {canRecordRefund && (
                <>
                  {!refundMode && (
                    <div className={`${styles["refund-actions"]}`}>
                      <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => setRefundMode("partial")}>Partial refund</button>
                      <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => setRefundMode("custom")}>Other amount</button>
                      <button type="button" className={`${styles["refund-button"]}`} onClick={() => setRefundMode("full")}>Refund full order</button>
                    </div>
                  )}

                  {refundMode === "partial" && (
                    <div className="mt-4 grid gap-2">
                      {order.lineItems.map((line) => {
                        const quantity = refundQuantities[line.id] ?? 0
                        return (
                          <div key={line.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-line bg-white px-3 py-2">
                            <div>
                              <strong className="block text-[12px] text-ink-soft">{line.name}</strong>
                              <small className="text-[10px] text-muted">
                                {formatMoney(line.unitPrice, order.currency)} · ordered {line.quantity}
                              </small>
                            </div>
                            <div className={`${styles["refund-quantity"]}`}>
                              <button type="button" aria-label={`Remove one ${line.name} from refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [line.id]: Math.max(0, quantity - 1) })}>−</button>
                              <strong>{quantity}</strong>
                              <button type="button" aria-label={`Add one ${line.name} to refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [line.id]: Math.min(line.quantity, quantity + 1) })}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {refundMode && (
                    <div className={`${styles["refund-confirmation"]}`}>
                      <div>
                        <span>{refundMode === "full" ? "Remaining balance" : refundMode === "custom" ? "Custom refund" : "Selected refund"}</span>
                        <strong>{formatMoney(refundAmount, order.currency)}</strong>
                      </div>
                      {refundMode === "custom" ? (
                        <label className={`${styles["custom-refund"]}`}>
                          Refund amount
                          <span>
                            <strong>$</strong>
                            <input autoFocus type="number" min="0.01" max={refundable} step="0.01" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} />
                          </span>
                          <small>{customError ?? `Up to ${formatMoney(refundable, order.currency)} can be refunded.`}</small>
                        </label>
                      ) : (
                        <p>{refundMode === "partial" ? "Choose quantities above; each line is recorded against its own order item id." : "The remaining balance will be recorded as a refund."}</p>
                      )}
                      <div>
                        <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={resetRefundForm}>Cancel</button>
                        <button
                          type="button"
                          className={`${styles["refund-button"]}`}
                          disabled={refundAmount <= 0 || refundAmount > refundable || Boolean(customError) || refundMutation.isMutating}
                          onClick={requestRefundConfirmation}
                        >
                          Confirm refund
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <p className="mt-6 text-[10px] text-muted">
        Status order: {ORDER_STATUSES.map((status) => orderStatusLabels[status]).join(" → ")}
      </p>
    </>
  )
}
