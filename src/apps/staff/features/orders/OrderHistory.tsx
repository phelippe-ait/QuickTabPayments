import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import type { Order } from "../../types"

export function OrderHistory({
  filteredOrders,
  totalOrders,
  query,
  setQuery,
  onSelect,
  isLoading,
  error,
}: {
  filteredOrders: Order[]
  totalOrders: number
  query: string
  setQuery: (value: string) => void
  onSelect: (order: Order) => void
  isLoading: boolean
  error: string | null
}) {
  return (
    <>
      <section className="mb-8">
        <p className={`${styles["eyebrow"]}`}>Activity</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
          Order history
        </h1>
        <p className="mt-2 text-sm text-muted-2">
          Latest orders for this restaurant.
        </p>
      </section>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row">
        <label className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-muted focus-within:border-berry">
          <Icon name="search" size={18} />
          <input
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-placeholder"
            placeholder="Search guest, table or order"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="rounded-xl border border-line bg-paper px-4 py-3 text-xs font-bold">Most recent</span>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <div className="hidden grid-cols-[0.7fr_0.8fr_1.4fr_1.2fr_0.8fr_32px] gap-4 border-b border-line-soft bg-cream-2 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted md:grid">
          <span>Order</span>
          <span>Table</span>
          <span>Guest</span>
          <span>Time</span>
          <span>Total</span>
          <span />
        </div>
        {error ? (
          <p role="alert" className="p-12 text-center text-sm text-muted">{error}</p>
        ) : isLoading ? (
          <p className="p-12 text-center text-sm text-muted">Loading recent orders…</p>
        ) : filteredOrders.map((order) => (
          <button
            aria-label={`View details for order ${order.id}`}
            className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-line-soft px-5 py-5 text-left transition last:border-0 hover:bg-cream-3 focus-visible:bg-cream-3 focus-visible:outline-2 focus-visible:outline-berry focus-visible:outline-offset-[-2px] md:grid-cols-[0.7fr_0.8fr_1.4fr_1.2fr_0.8fr_32px] md:px-6"
            key={order.id}
            onClick={() => onSelect(order)}
          >
            <span className="text-sm font-bold">{order.id}</span>
            <span className="row-start-2 text-xs text-muted-2 md:row-auto md:text-sm md:text-ink">
              {order.table}
            </span>
            <span className="text-sm font-bold md:font-normal">
              {order.guest}
            </span>
            <span className="hidden text-sm text-muted-2 md:block">
              {order.time}
            </span>
            <span className="row-span-2 row-start-1 text-right font-serif text-lg md:row-auto md:text-left">
              ${order.total.toFixed(2)}
            </span>
            <span className="hidden text-placeholder transition group-hover:translate-x-1 group-hover:text-berry md:block">
              <Icon name="chevron" size={18} />
            </span>
          </button>
        ))}
        {!isLoading && !error && filteredOrders.length === 0 && (
          <p className="p-12 text-center text-sm text-muted">
            {totalOrders === 0
              ? "No recent orders found. Confirm that your account has active staff access to this restaurant."
              : "No orders match your search."}
          </p>
        )}
      </div>
      <p className="pb-16 pt-4 text-xs text-muted lg:pb-0">
        Showing {filteredOrders.length} of {totalOrders} orders
      </p>
    </>
  )
}
export function HistoryOrderDrawer({
  order,
  onClose,
}: {
  order: Order
  onClose: () => void
}) {
  const subtotal = order.subtotal ?? order.total / 1.09
  const tax = order.tax ?? order.total - subtotal
  const completed = order.status === "Completed"

  return (
    <>
      <button
        aria-label="Close order details"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        aria-label={`Details for order ${order.id}`}
        className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[460px] sm:p-8`}
      >
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Order details</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="mt-8 flex items-start justify-between border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl">{order.id}</h2>
            <p className="mt-2 text-sm text-muted-2">
              {order.table} · {order.guest}
            </p>
          </div>
          <StatusPill tone={completed ? "success" : "primary"}>
            {order.status}
          </StatusPill>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-4">
          <div>
            <p className={`${styles["detail-label"]}`}>Time</p>
            <p className="mt-1.5 text-xs font-bold">
              {order.time.replace("Today, ", "")}
            </p>
          </div>
          <div>
            <p className={`${styles["detail-label"]}`}>Server</p>
            <p className="mt-1.5 text-xs font-bold">{order.server}</p>
          </div>
          <div>
            <p className={`${styles["detail-label"]}`}>Guests</p>
            <p className="mt-1.5 text-xs font-bold">{order.guests}</p>
          </div>
        </div>

        <div className="mt-9">
          <div className="mb-3 flex items-center justify-between">
            <p className={`${styles["detail-label"]}`}>Items</p>
            <p className="text-xs text-muted">
              {order.items.reduce((sum, item) => sum + item.qty, 0)} items
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line-soft">
            {order.items.map((item) => (
              <div
                className="flex items-center justify-between border-b border-line-soft px-4 py-4 last:border-0"
                key={item.name}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-sand text-xs font-bold">
                    {item.qty}
                  </span>
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                <span className="text-sm">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
          <div className="flex justify-between text-muted-2">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-2">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 font-serif text-2xl">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-7 rounded-2xl bg-cream-2 p-4">
          <p className={`${styles["detail-label"]}`}>
            {completed ? "Payment" : "Payment status"}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold">
            {completed && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-sage text-white">
                <Icon name="check" size={12} />
              </span>
            )}
            {order.payment}
          </div>
        </div>

        <button
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-3.5 text-sm font-bold transition hover:border-berry hover:text-berry-strong"
          onClick={onClose}
        >
          Close details
        </button>
      </aside>
    </>
  )
}
