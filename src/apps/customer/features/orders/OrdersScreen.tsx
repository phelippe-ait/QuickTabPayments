import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import styles from "../../App.module.css";
import { Icon } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/shadcn/skeleton";
import { formatMoney } from "@shared/lib/money";
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus";
import { orderStatusLabels } from "@shared/orders/status";
import { paymentSummaryLabel } from "@shared/orders/paymentLabels";
import { HeaderButton } from "../../components/CustomerUi";
import {
  getCustomerOrderHistory,
  type CustomerOrder,
} from "../../data/orders";
import { fetchMenu } from "../../data/menuApi";
import { buildReorderCart, type SkippedItem } from "../../data/reorder";
import { trackingUrl } from "../../data/tracking";
import type { CartItem } from "../../types";

export function OrdersScreen({
  onClose,
  customerId,
  restaurantId,
  onAddToCart,
  onOpenCart,
}: {
  onClose: () => void;
  customerId: string;
  restaurantId: string;
  onAddToCart: (items: CartItem[]) => void;
  onOpenCart: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [reorderNotice, setReorderNotice] = useState("");
  const [skipped, setSkipped] = useState<SkippedItem[] | null>(null);
  const skippedPanelRef = useDialogFocus<HTMLDivElement>(() => setSkipped(null), Boolean(skipped));
  useBodyScrollLock(Boolean(skipped));

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders(await getCustomerOrderHistory(customerId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your order history.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const orderAgain = async (order: CustomerOrder) => {
    if (reorderingId) return;
    setReorderingId(order.id);
    setReorderError("");
    setReorderNotice("");

    try {
      // Prices and availability come from the live menu, never the snapshots.
      const menu = await fetchMenu(restaurantId);
      const result = buildReorderCart(
        order.items,
        menu.flatMap((category) => category.items),
      );

      if (result.items.length === 0) {
        setReorderNotice(
          "None of the items from this order are available right now, so your cart was left unchanged.",
        );
        return;
      }

      onAddToCart(result.items);
      if (result.skipped.length > 0) {
        setSkipped(result.skipped);
      } else {
        onOpenCart();
      }
    } catch (reorderFailure) {
      setReorderError(
        reorderFailure instanceof Error
          ? reorderFailure.message
          : "Could not rebuild this order. Please try again.",
      );
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <>
      <main className={`${styles["page-screen"]}`}>
        <header className={`${styles["page-header"]}`}>
          <h1>Order history</h1>
          <HeaderButton
            icon="close"
            label="Close order history"
            onClick={onClose}
          />
        </header>
        {reorderError && (
          <p
            className="mb-3 rounded-[7px] border border-line bg-paper px-3 py-2 text-[12px] text-berry"
            role="alert"
          >
            {reorderError}
          </p>
        )}
        {reorderNotice && (
          <p
            className="mb-3 rounded-[7px] border border-line bg-paper px-3 py-2 text-[12px] text-ink-mid"
            role="status"
          >
            {reorderNotice}
          </p>
        )}
        {loading ? (
          <section className="grid gap-3" role="status" aria-label="Loading your orders">
            <span className="sr-only">Loading your orders…</span>
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-40 rounded-[7px]" />
            ))}
          </section>
        ) : error ? (
          <div className={styles["empty-cart"]} role="alert">
            <h2>We couldn’t load your orders</h2>
            <p>{error}</p>
            <Button variant="outline" className="w-auto px-6" onClick={() => void loadOrders()}>
              Try again
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className={`${styles["empty-cart"]}`}>
            <span className={`${styles["large-cart"]}`}>
              <Icon name="receipt" size={34} />
            </span>
            <h2>No orders yet</h2>
            <p>Your past orders will show up here once you place one.</p>
            <Button variant="outline" className="w-auto px-6" onClick={onClose}>
              Browse menu
            </Button>
          </div>
        ) : (
          <section className={styles["order-history-list"]} aria-label="Your past orders">
            {orders.map((order) => (
              <article className={`${styles["order-card"]} ${styles["history-order-card"]}`} key={order.id}>
                  <div className={styles["history-order-heading"]}>
                    <div className={styles["item-name"]}>
                      <strong>Order {order.orderNumber}</strong>
                      <small>
                        {order.restaurantName ? `${order.restaurantName} · ` : ""}
                        {order.tableNumber ? `Table ${order.tableNumber} · ` : ""}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
                      </small>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={styles["order-status-pill"]}>
                        {orderStatusLabels[order.status]}
                      </span>
                      {order.paymentStatus && (
                        <span className={styles["order-status-pill"]}>
                          {paymentSummaryLabel(
                            order.paymentStatus,
                            order.refundedTotal,
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                <ul className={styles["history-order-items"]}>
                  {order.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <span>
                        {item.quantity} × {item.name}
                        {(item.modifiers?.length ?? 0) > 0 && (
                          <small className="mt-0.5 block text-[10px] text-muted">
                            {item.modifiers?.map((modifier) => modifier.name).join(", ")}
                          </small>
                        )}
                      </span>
                      <span>{formatMoney(item.subtotal, order.currency)}</span>
                    </li>
                  ))}
                  {order.items.length === 0 && <li>Items unavailable</li>}
                </ul>
                <div className={styles["history-order-total"]}>
                  <span>{order.amountPaid > 0 ? "Amount paid" : "Amount due"}</span>
                  <strong>
                    {formatMoney(
                      order.amountPaid > 0 ? order.amountPaid : order.amountDue,
                      order.currency,
                    )}
                  </strong>
                </div>
                {order.tipAmount > 0 && (
                  <p className="mt-1 text-right text-[10px] text-muted">
                    Includes {formatMoney(order.tipAmount, order.currency)} tip
                  </p>
                )}
                {order.refundedTotal > 0 && (
                  <p className="mt-2 text-[11px] text-muted">
                    Refunded to date: {formatMoney(order.refundedTotal, order.currency)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  {order.items.length > 0 && (
                    <button
                      type="button"
                      className={styles["history-reorder-button"]}
                      onClick={() => void orderAgain(order)}
                      disabled={reorderingId !== null}
                      aria-busy={reorderingId === order.id}
                    >
                      {reorderingId === order.id ? "Loading menu…" : "Order again"}
                    </button>
                  )}
                  {order.trackingToken && (
                    <Link
                      className={styles["history-track-link"]}
                      to={trackingUrl(order.orderNumber, order.trackingToken)}
                    >
                      Track order
                    </Link>
                  )}
                  {order.receiptUrl && (
                    <a
                      className={styles["history-track-link"]}
                      href={order.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
      {skipped && (
        <div
          className={`${styles["modal-shade"]}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSkipped(null);
          }}
        >
          <div
            ref={skippedPanelRef}
            className={`${styles["product-modal"]}`}
            role="dialog"
            aria-modal="true"
            aria-label="Items skipped when reordering"
          >
            <div className={`${styles["modal-close"]}`}>
              <HeaderButton icon="close" label="Close" onClick={() => setSkipped(null)} />
            </div>
            <h2>Some items were skipped</h2>
            <p>
              The available items were added to your cart. These changes were
              made because the menu has changed:
            </p>
            <ul className="m-0 grid list-none gap-2 p-0 text-[12px] text-ink-mid">
              {skipped.map((item, index) => (
                <li key={`${item.name}-${item.reason}-${index}`}>
                  <strong className="text-ink">{item.quantity} × {item.name}</strong>
                  <span className="mt-0.5 block text-[11px]">{item.reason}</span>
                </li>
              ))}
            </ul>
            <div className={`${styles["modal-footer"]}`}>
              <Button
                variant="secondary"
                onClick={() => {
                  setSkipped(null);
                  onClose();
                }}
              >
                Keep browsing
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setSkipped(null);
                  onOpenCart();
                }}
              >
                Review cart
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
