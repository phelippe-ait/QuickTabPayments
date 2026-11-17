import { useEffect, useMemo, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { cn } from "@shared/lib/cn"
import { StatusPill, type StatusTone } from "@shared/ui/StatusPill"
import { Badge } from "@shared/ui/shadcn/badge"
import { Stat } from "../../components/StaffUi"
import { Skeleton } from "@shared/ui/shadcn/skeleton"
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus"
import { nextKitchenActions } from "../../services/staffOrders"
import type { KitchenStatus, Order } from "../../types"
import type { OrderSoundControls } from "../../hooks/useOrderSound"
import { sortOrdersOldestFirst } from "./orderSort"
import {
  formatElapsedMinutes,
  getElapsedMinutes,
  getSlaLevel,
  slaBadgeClasses,
  slaCardClasses,
} from "./sla"

/** How often the elapsed-time labels re-render while the board is open. */
const CLOCK_TICK_MS = 30_000

type BumpStatus = "Preparing" | "Ready" | "Completed"

const bumpLabels: Record<BumpStatus, string> = {
  Preparing: "Prepare",
  Ready: "Ready",
  Completed: "Complete",
}

const bumpButtonClasses: Record<BumpStatus, string> = {
  Preparing:
    "border-amber/40 bg-amber-soft text-amber hover:bg-amber-soft/70",
  Ready: "border-sage/40 bg-paper text-sage-strong hover:bg-sage-soft",
  Completed: "border-sage bg-sage-soft text-sage-strong hover:bg-sage-soft/70",
}

export function KitchenWorkspace({
  orders,
  previousOrders,
  onStatusChange,
  ordersLoading,
  ordersError,
  sound,
  unseenOrderIds,
  onOrderSeen,
}: {
  orders: Order[]
  previousOrders: Order[]
  onStatusChange: (id: string, status: KitchenStatus) => void
  ordersLoading: boolean
  ordersError: string | null
  sound: OrderSoundControls
  unseenOrderIds: ReadonlySet<string>
  onOrderSeen: (orderId: string) => void
}) {
  const [pendingAction, setPendingAction] = useState<{
    order: Order
    status: KitchenStatus
  } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const activeOrders = useMemo(
    () => sortOrdersOldestFirst(orders),
    [orders],
  )
  const preparing = activeOrders.filter(
    (order) => order.kitchenStatus === "Preparing",
  ).length
  const ready = activeOrders.filter(
    (order) => order.kitchenStatus === "Ready",
  ).length
  const unseenCount = activeOrders.filter((order) =>
    unseenOrderIds.has(order.id),
  ).length
  const isUnseen = (order: Order) => unseenOrderIds.has(order.id)

  // Keep SLA labels current without a per-second render storm. Thirty seconds
  // is well inside the one-minute resolution shown on the cards.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  function confirmStatusChange() {
    if (!pendingAction) return
    onStatusChange(pendingAction.order.id, pendingAction.status)
    setPendingAction(null)
  }

  // Acknowledge is deliberately status-neutral: the board only receives paid,
  // already-confirmed orders (the query filters `pending`), so "seen" means
  // clearing the P15 highlight without advancing the kitchen workflow.
  // Opening an action confirmation also counts as acknowledging the order.
  function requestStatusChange(order: Order, status: KitchenStatus) {
    onOrderSeen(order.id)
    setPendingAction({ order, status })
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {activeOrders.length} active orders on the board, {preparing} preparing
        and {ready} ready.
      </p>
      <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className={`${styles["eyebrow"]}`}>Kitchen display</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
            Active orders
          </h1>
          <p className="mt-2 text-sm text-muted-2">
            Keep the kitchen moving and let the floor know what’s ready.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span aria-atomic="true" aria-live="polite" role="status">
            {unseenCount > 0 && (
              <Badge
                aria-label={
                  unseenCount === 1 ? "1 new order" : `${unseenCount} new orders`
                }
                className="animate-pulse motion-reduce:animate-none"
                variant="warning"
              >
                {unseenCount} new
              </Badge>
            )}
          </span>
          <button
            type="button"
            aria-label={
              sound.enabled
                ? "Mute new order sound"
                : "Unmute new order sound"
            }
            aria-pressed={sound.enabled}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry ${
              sound.enabled
                ? "bg-paper text-ink-soft hover:bg-cream-3"
                : "bg-cream-3 text-muted hover:bg-cream-2"
            }`}
            onClick={() => {
              if (!sound.unlocked) sound.prime()
              sound.toggle()
            }}
            title={
              sound.enabled
                ? "Sound on for new orders"
                : "Sound muted for new orders"
            }
          >
            <Icon name={sound.enabled ? "volume" : "volume-off"} size={18} />
          </button>
          <Stat value={preparing.toString().padStart(2, "0")} label="Preparing" tone="rose" />
          <Stat value={ready.toString().padStart(2, "0")} label="Ready" tone="green" />
        </div>
      </section>
     {ordersError && (
  <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    Unable to refresh orders: {ordersError}
  </div>
)}

{ordersLoading && orders.length === 0 ? (
  <div className="grid gap-5 lg:grid-cols-2" role="status" aria-label="Loading orders">
    <span className="sr-only">Loading orders...</span>
    {[0, 1, 2, 3].map((row) => (
      <Skeleton key={row} className="h-64 rounded-[22px]" />
    ))}
  </div>
) : ordersError && orders.length === 0 ? (
  <div className="rounded-[22px] border border-line bg-paper px-6 py-20 text-center">
    Orders are currently unavailable.
  </div>
) : orders.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {activeOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt, now)
            const sla = getSlaLevel(elapsed)
            const actions = nextKitchenActions(order.kitchenStatus)
            const bumpStatus = actions.find(
              (status): status is BumpStatus => status !== "Cancelled",
            )
            const canCancel = actions.includes("Cancelled")

            return (
              <article
                className={cn(
                  "overflow-hidden rounded-[22px] border bg-paper",
                  isUnseen(order)
                    ? "border-amber/60 ring-2 ring-amber/30"
                    : "border-line",
                  slaCardClasses[sla],
                )}
                key={order.id}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-5 sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-serif text-3xl">{order.id}</h2>
                      <KitchenStatusPill status={order.kitchenStatus} />
                      {isUnseen(order) && (
                        <Badge
                          aria-label="New order"
                          className="animate-pulse motion-reduce:animate-none"
                          variant="warning"
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-bold">{order.table}</p>
                    <p className="mt-1 text-xs text-muted">
                      {order.time} · {order.server}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-bold tabular-nums",
                        slaBadgeClasses[sla],
                      )}
                      title={`Waiting ${elapsed} minute${elapsed === 1 ? "" : "s"}`}
                    >
                      <span className="sr-only">Waiting </span>
                      {formatElapsedMinutes(elapsed)}
                    </span>
                    <span className="rounded-full bg-cream-2 px-3 py-1.5 text-xs font-bold text-muted-2">
                      {order.items.reduce((sum, item) => sum + item.qty, 0)}{" "}
                      items
                    </span>
                  </div>
                </div>

                <div className="px-5 py-2 sm:px-6">
                  {order.items.map((item) => (
                    <div
                      className="flex items-center gap-3 border-b border-sand py-3.5 last:border-0"
                      key={`${item.name}-${item.modifiers?.join(",") ?? ""}`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand text-sm font-bold">
                        {item.qty}
                      </span>
                      <span className="text-sm font-bold">
                        {item.name}
                        {(item.allergens?.length ?? 0) > 0 && (
                          <span
                            className="mt-1.5 flex w-fit items-start gap-1 rounded-md bg-danger-soft px-2 py-1 text-[10px] font-bold text-danger"
                            role="note"
                          >
                            <span aria-hidden="true">⚠</span>
                            <span>Contains {item.allergens?.join(", ")}</span>
                          </span>
                        )}
                        {(item.modifiers?.length ?? 0) > 0 && (
                          <small className="mt-0.5 block font-normal text-muted">
                            {item.modifiers?.join(", ")}
                          </small>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-line-soft bg-cream-3 p-4">
                  {isUnseen(order) && (
                    <button
                      className="min-w-32 flex-1 rounded-xl border border-amber/40 bg-paper px-3 py-3 text-xs font-bold text-amber transition hover:bg-amber-soft"
                      onClick={() => onOrderSeen(order.id)}
                    >
                      Acknowledge
                    </button>
                  )}

                  {bumpStatus && (
                    <button
                      className={cn(
                        "min-w-32 flex-1 rounded-xl border px-3 py-3 text-xs font-bold transition",
                        bumpButtonClasses[bumpStatus],
                      )}
                      onClick={() => requestStatusChange(order, bumpStatus)}
                      title={`Bump to ${bumpStatus}`}
                    >
                      {bumpLabels[bumpStatus]}
                    </button>
                  )}

                  {canCancel && (
                    <button
                      className="min-w-32 flex-1 rounded-xl border border-danger/40 bg-paper px-3 py-3 text-xs font-bold text-danger transition hover:bg-danger-soft"
                      onClick={() => requestStatusChange(order, "Cancelled")}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-line bg-cream-3 px-6 py-20 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sage-soft text-sage-strong">
            <Icon name="check" size={22} />
          </span>
          <h2 className="mt-4 font-serif text-2xl">Kitchen is all caught up</h2>
          <p className="mt-1 text-sm text-muted">
            New active orders will appear here.
          </p>
        </div>
      )}

      {previousOrders.length > 0 && (
        <section className="mt-10 border-t border-line pt-8">
          <div className="mb-4">
            <p className={`${styles["eyebrow"]}`}>Recently closed</p>
            <h2 className="mt-1 font-serif text-2xl">Previous orders</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {previousOrders.map((order) => (
              <article
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper px-5 py-4"
                key={order.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="font-serif text-xl">{order.id}</p>
                    <KitchenStatusPill status={order.kitchenStatus} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-2">
                    {order.table} · {order.time} ·{" "}
                    {order.items.reduce((sum, item) => sum + item.qty, 0)} items
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="h-16 lg:hidden" />

      {pendingAction && (
        <KitchenStatusConfirmation
          order={pendingAction.order}
          status={pendingAction.status}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmStatusChange}
        />
      )}
    </>
  )
}

function KitchenStatusConfirmation({
  order,
  status,
  onCancel,
  onConfirm,
}: {
  order: Order
  status: KitchenStatus
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelled = status === "Cancelled"
  const panelRef = useDialogFocus<HTMLDivElement>(onCancel)
  useBodyScrollLock()
  const actionLabel =
  status === "Preparing"
    ? "start preparing"
    : status === "Ready"
      ? "mark as ready"
      : status === "Completed"
        ? "complete"
        : "cancel"

  return (
    <div
      aria-labelledby="kitchen-confirmation-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-5 backdrop-blur-[2px]"
      role="dialog"
    >
      <button
        aria-label="Close confirmation"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-[22px] border border-line bg-paper p-6 shadow-2xl" ref={panelRef}>
        <div
          className={`grid h-11 w-11 place-items-center rounded-full ${
            cancelled
              ? "bg-berry-soft text-berry-strong"
              : "bg-sage-soft text-sage-strong"
          }`}
        >
          <Icon name={cancelled ? "close" : "check"} size={20} />
        </div>
        <p className={`${styles["eyebrow"]} mt-5`}>Double-check</p>
        <h2
          className="mt-2 font-serif text-3xl"
          id="kitchen-confirmation-title"
        >
          {cancelled ? "Cancel this order?" : `Set order to ${status}?`}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-2">
          You’re about to {actionLabel}{" "}
          <strong className="text-ink">{order.id}</strong> for{" "}
          <strong className="text-ink">{order.table}</strong>.
          {cancelled && " It will be removed from the active kitchen queue."}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            className="rounded-xl border border-line bg-white py-3 text-sm font-bold text-ink-soft transition hover:border-placeholder"
            onClick={onCancel}
          >
            Go back
          </button>
          <button
            className={`rounded-xl py-3 text-sm font-bold text-white transition ${
              cancelled
                ? "bg-berry-strong hover:bg-[#9f354b]"
                : "bg-sage-strong hover:bg-sage-strong"
            }`}
            onClick={onConfirm}
          >
            Yes, {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function KitchenStatusPill({ status }: { status: KitchenStatus }) {
  const tones: Record<KitchenStatus, StatusTone> = {
    New: "neutral",
    Preparing: "warning",
    Ready: "success",
    Completed: "info",
    Cancelled: "danger",
  }

  return <StatusPill tone={tones[status]}>{status}</StatusPill>
}
