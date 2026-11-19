import { useEffect, useMemo, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Skeleton } from "@shared/ui/shadcn/skeleton"
import { formatMoney, splitInclusiveTax } from "@shared/lib/money"
import { fetchOrderingMenu } from "@shared/data/orderingMenu"
import type {
  OrderingMenuCategory,
  OrderingMenuItem,
  OrderingModifierChoice,
} from "@shared/orders/orderingTypes"
import type { Table } from "../../types"
import {
  createStaffOrder,
  StaffOrderError,
  type StaffPlacedOrder,
} from "../../services/staffOrderCreation"
import {
  addStaffLine,
  removeStaffLine,
  setStaffLineQuantity,
  staffCartCount,
  staffCartTotal,
  toStaffOrderItems,
  type StaffOrderLine,
} from "./orderCart"
import { StaffProductDialog } from "./StaffProductDialog"

function tableLabel(table: Table): string {
  return table.tableNumber ?? String(table.id).padStart(2, "0")
}

function tableOptionLabel(table: Table): string {
  const label = `Table ${tableLabel(table)}`
  return table.locationLabel ? `${label} · ${table.locationLabel}` : label
}

export function NewOrderWorkspace({
  restaurantId,
  currency,
  taxRate,
  tables,
  onOrderCreated,
  onViewKitchen,
}: {
  restaurantId: string | null
  currency: string
  taxRate: number
  tables: Table[]
  onOrderCreated: () => void
  onViewKitchen: () => void
}) {
  const [menu, setMenu] = useState<OrderingMenuCategory[]>([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [lines, setLines] = useState<StaffOrderLine[]>([])
  const [dialogItem, setDialogItem] = useState<OrderingMenuItem | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [tableId, setTableId] = useState("")
  const [notes, setNotes] = useState("")
  const [paid, setPaid] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<StaffPlacedOrder | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!restaurantId) {
      setMenu([])
      setMenuError("No active staff restaurant found")
      setMenuLoading(false)
      return
    }

    setMenuLoading(true)
    setMenuError(null)
    fetchOrderingMenu(restaurantId)
      .then((categories) => {
        if (!cancelled) setMenu(categories)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        console.error("Could not load the ordering menu", cause)
        setMenuError(
          cause instanceof Error
            ? cause.message
            : "Could not load the menu. Please try again.",
        )
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [restaurantId, reloadToken])

  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase()
    return menu
      .filter(
        (category) =>
          categoryFilter === "all" || category.id === categoryFilter,
      )
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            !term ||
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term),
        ),
      }))
      .filter((category) => category.items.length > 0)
  }, [menu, search, categoryFilter])

  const itemTotal = staffCartTotal(lines)
  const breakdown = splitInclusiveTax(itemTotal, taxRate)
  const itemCount = staffCartCount(lines)

  function addItem(
    item: OrderingMenuItem,
    quantity: number,
    modifiers: OrderingModifierChoice[],
  ) {
    setLines((current) => addStaffLine(current, item, quantity, modifiers))
    setDialogItem(null)
    setSuccess(null)
  }

  async function submitOrder() {
    setError(null)
    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setError("Enter a name for the order.")
      return
    }
    if (lines.length === 0) {
      setError("Add at least one item before sending the order.")
      return
    }

    setSubmitting(true)
    try {
      const placed = await createStaffOrder({
        tableId: tableId || null,
        customerName: trimmedName,
        notes,
        items: toStaffOrderItems(lines),
        paid,
      })
      setSuccess(placed)
      setLines([])
      setCustomerName("")
      setTableId("")
      setNotes("")
      setPaid(false)
      onOrderCreated()
    } catch (cause) {
      if (cause instanceof StaffOrderError) {
        setError(cause.message)
      } else {
        console.error("Could not create the staff order", cause)
        setError("Could not create the order. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="rounded-[22px] border border-sage/40 bg-paper p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-soft text-sage-strong">
            <Icon name="check" size={26} />
          </span>
          <p className={`${styles["eyebrow"]} mt-5`}>Order sent</p>
          <h1 className="mt-2 font-serif text-4xl">
            {success.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-muted-2">
            {success.tableNumber
              ? `Table ${success.tableNumber}`
              : "Counter order"}{" "}
            · {success.customerName} ·{" "}
            {formatMoney(success.total, success.currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {success.paid
              ? "Payment recorded at the counter."
              : "No payment recorded — collect at the counter."}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-berry px-5 py-3 text-sm font-bold text-white transition hover:bg-berry-strong"
              onClick={() => setSuccess(null)}
            >
              <Icon name="plus" size={16} />
              Start another order
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-sm font-bold transition hover:bg-cream-2"
              onClick={onViewKitchen}
            >
              <Icon name="kitchen" size={16} />
              View kitchen
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="mb-8">
        <p className={`${styles["eyebrow"]}`}>Counter service</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
          New order
        </h1>
        <p className="mt-2 text-sm text-muted-2">
          Take an order in person. It goes straight to the kitchen as soon as
          you send it.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-line-strong bg-paper px-4 py-3 text-muted focus-within:border-berry focus-within:ring-2 focus-within:ring-berry/20">
              <Icon name="search" size={18} />
              <input
                aria-label="Search the menu"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-placeholder"
                placeholder="Search the menu"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-xs font-bold transition hover:bg-cream-2"
              onClick={() => setReloadToken((current) => current + 1)}
            >
              <Icon name="clock" size={15} />
              Refresh menu
            </button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={categoryFilter === "all"}
              className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${
                categoryFilter === "all"
                  ? "border-berry bg-berry text-white"
                  : "border-line bg-paper text-muted-2 hover:text-ink"
              }`}
              onClick={() => setCategoryFilter("all")}
            >
              All items
            </button>
            {menu.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={categoryFilter === category.id}
                className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${
                  categoryFilter === category.id
                    ? "border-berry bg-berry text-white"
                    : "border-line bg-paper text-muted-2 hover:text-ink"
                }`}
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {menuError ? (
            <div
              role="alert"
              className="rounded-[22px] border border-danger/40 bg-danger-soft p-6 text-sm text-danger"
            >
              {menuError}
            </div>
          ) : menuLoading ? (
            <div
              className="grid gap-3 sm:grid-cols-2"
              role="status"
              aria-label="Loading menu"
            >
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-line bg-cream-3 px-6 py-16 text-center">
              <h2 className="font-serif text-2xl">No matching items</h2>
              <p className="mt-1 text-sm text-muted">
                Try a different search or category.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {visibleCategories.map((category) => (
                <section key={category.id}>
                  <h2 className="mb-3 font-serif text-2xl">
                    {category.name}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={`Add ${item.name}`}
                        className="flex min-h-28 flex-col items-start rounded-2xl border border-line bg-paper p-4 text-left transition hover:-translate-y-0.5 hover:border-berry/40 hover:shadow-md"
                        onClick={() => setDialogItem(item)}
                      >
                        <span className="flex w-full items-start justify-between gap-3">
                          <strong className="text-sm">{item.name}</strong>
                          <span className="shrink-0 font-serif text-lg">
                            {formatMoney(item.price, currency)}
                          </span>
                        </span>
                        {item.description && (
                          <span className="mt-1 line-clamp-2 text-xs text-muted">
                            {item.description}
                          </span>
                        )}
                        <span className="mt-auto flex items-center gap-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-berry">
                          <Icon name="plus" size={13} />
                          Add to order
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[22px] border border-line bg-paper p-5 xl:sticky xl:top-[92px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Current order</h2>
            <span className="rounded-full bg-cream-2 px-3 py-1 text-xs font-bold">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>

          <label className="mt-5 block">
            <span className={`${styles["detail-label"]}`}>Guest name</span>
            <input
              aria-label="Guest name"
              className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-sm outline-none transition placeholder:text-placeholder focus:border-berry focus:ring-2 focus:ring-berry/10"
              placeholder="Name for the order"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </label>

          <label className="mt-4 block">
            <span className={`${styles["detail-label"]}`}>Table</span>
            <select
              aria-label="Table"
              className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-sm outline-none transition focus:border-berry focus:ring-2 focus:ring-berry/10"
              value={tableId}
              onChange={(event) => setTableId(event.target.value)}
            >
              <option value="">Counter / no table</option>
              {tables.map((table) => (
                <option key={table.id} value={String(table.id)}>
                  {tableOptionLabel(table)}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 border-t border-line-soft pt-4">
            {lines.length === 0 ? (
              <p className="rounded-xl bg-cream-2 p-4 text-center text-xs text-muted">
                Add items from the menu to start this order.
              </p>
            ) : (
              <ul className="space-y-3">
                {lines.map((line) => (
                  <li key={line.lineId} className="rounded-xl bg-cream-2 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{line.name}</p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                            {line.modifiers
                              .map((modifier) => modifier.name)
                              .join(", ")}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {formatMoney(line.unitPrice, currency)} each
                        </p>
                      </div>
                      <span className="shrink-0 font-serif text-lg">
                        {formatMoney(
                          line.unitPrice * line.quantity,
                          currency,
                        )}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div
                        className="flex items-center gap-1 rounded-lg border border-line bg-white"
                        role="group"
                        aria-label={`Quantity for ${line.name}`}
                      >
                        <button
                          type="button"
                          aria-label={`Decrease ${line.name}`}
                          className="grid h-9 w-9 place-items-center text-lg transition hover:bg-cream-2"
                          onClick={() =>
                            setLines((current) =>
                              setStaffLineQuantity(
                                current,
                                line.lineId,
                                line.quantity - 1,
                              ),
                            )
                          }
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${line.name}`}
                          className="grid h-9 w-9 place-items-center text-lg transition hover:bg-cream-2"
                          onClick={() =>
                            setLines((current) =>
                              setStaffLineQuantity(
                                current,
                                line.lineId,
                                line.quantity + 1,
                              ),
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-danger hover:underline"
                        onClick={() =>
                          setLines((current) =>
                            removeStaffLine(current, line.lineId),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-line-soft pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span>{formatMoney(breakdown.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>GST (included)</span>
              <span>{formatMoney(breakdown.tax, currency)}</span>
            </div>
            <div className="flex justify-between pt-1 font-serif text-2xl">
              <span>Total</span>
              <span>{formatMoney(itemTotal, currency)}</span>
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-cream-2 p-3 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={paid}
              onChange={(event) => setPaid(event.target.checked)}
            />
            <span>
              <strong className="block text-ink">Payment collected</strong>
              Cash or card terminal. Leave unchecked to collect at the
              counter later.
            </span>
          </label>

          <label className="mt-4 block">
            <span className={`${styles["detail-label"]}`}>Notes</span>
            <textarea
              aria-label="Order notes"
              className="mt-2 min-h-20 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-sm outline-none transition placeholder:text-placeholder focus:border-berry focus:ring-2 focus:ring-berry/10"
              placeholder="Allergies, table requests, etc."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-berry px-4 py-3 text-sm font-bold text-white transition hover:bg-berry-strong disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            onClick={() => void submitOrder()}
          >
            <Icon name="kitchen" size={16} />
            {submitting ? "Sending…" : "Send to kitchen"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            The order is marked confirmed and appears on the kitchen board.
          </p>
        </aside>
      </div>

      {dialogItem && (
        <StaffProductDialog
          currency={currency}
          item={dialogItem}
          onAdd={(quantity, modifiers) =>
            addItem(dialogItem, quantity, modifiers)
          }
          onClose={() => setDialogItem(null)}
        />
      )}
    </>
  )
}
