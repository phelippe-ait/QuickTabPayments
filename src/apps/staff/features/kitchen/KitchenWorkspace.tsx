import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill, type StatusTone } from "@shared/ui/StatusPill"
import { Stat } from "../../components/StaffUi"
import type { KitchenStatus, Order } from "../../types"

export function KitchenWorkspace({
  orders,
  previousOrders,
  onStatusChange,
}: {
  orders: Order[]
  previousOrders: Order[]
  onStatusChange: (id: string, status: KitchenStatus) => void
}) {
  const [pendingAction, setPendingAction] = useState<{
    order: Order
    status: KitchenStatus
  } | null>(null)
  const preparing = orders.filter(
    (order) => order.kitchenStatus === "Preparing",
  ).length
  const ready = orders.filter((order) => order.kitchenStatus === "Ready").length

  function confirmStatusChange() {
    if (!pendingAction) return
    onStatusChange(pendingAction.order.id, pendingAction.status)
    setPendingAction(null)
  }

  return (
    <>
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
        <div className="flex gap-3">
          <Stat value={preparing.toString().padStart(2, "0")} label="Preparing" tone="rose" />
          <Stat value={ready.toString().padStart(2, "0")} label="Ready" tone="green" />
        </div>
      </section>

      {orders.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {orders.map((order) => (
            <article
              className="overflow-hidden rounded-[22px] border border-line bg-paper"
              key={order.id}
            >
              <div className="flex items-start justify-between border-b border-line-soft px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-3xl">{order.id}</h2>
                    <KitchenStatusPill status={order.kitchenStatus} />
                  </div>
                  <p className="mt-1.5 text-sm font-bold">{order.table}</p>
                  <p className="mt-1 text-xs text-muted">
                    {order.time.replace("Today, ", "")} · {order.server}
                  </p>
                </div>
                <span className="rounded-full bg-cream-2 px-3 py-1.5 text-xs font-bold text-muted-2">
                  {order.items.reduce((sum, item) => sum + item.qty, 0)} items
                </span>
              </div>

              <div className="px-5 py-2 sm:px-6">
                {order.items.map((item) => (
                  <div
                    className="flex items-center gap-3 border-b border-sand py-3.5 last:border-0"
                    key={item.name}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand text-sm font-bold">
                      {item.qty}
                    </span>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-line-soft bg-cream-3 p-4 sm:gap-3">
                <button
                  className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                    order.kitchenStatus === "Preparing"
                      ? "border-[#d59a52] bg-amber-soft text-amber"
                      : "border-[#e5c89f] bg-cream-3 text-amber hover:border-[#d59a52] hover:bg-amber-soft"
                  }`}
                  disabled={order.kitchenStatus === "Preparing"}
                  onClick={() =>
                    setPendingAction({ order, status: "Preparing" })
                  }
                >
                  Prepare
                </button>
                <button
                  className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                    order.kitchenStatus === "Ready"
                      ? "border-sage bg-sage-soft text-sage-strong"
                      : "border-[#bfd0bb] bg-paper text-sage-strong hover:border-sage hover:bg-sage-soft"
                  }`}
                  disabled={order.kitchenStatus === "Ready"}
                  onClick={() => setPendingAction({ order, status: "Ready" })}
                >
                  Ready
                </button>
                <button
                  className="rounded-xl border border-[#dfb9b9] bg-paper px-2 py-3 text-xs font-bold text-danger transition hover:border-berry-strong hover:bg-danger-soft"
                  onClick={() =>
                    setPendingAction({ order, status: "Cancelled" })
                  }
                >
                  Cancel
                </button>
              </div>
            </article>
          ))}
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
                    {order.table} · {order.time.replace("Today, ", "")} ·{" "}
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
  const actionLabel =
    status === "Preparing"
      ? "start preparing"
      : status === "Ready"
        ? "mark as ready"
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
      <div className="relative w-full max-w-sm rounded-[22px] border border-line bg-paper p-6 shadow-2xl">
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
