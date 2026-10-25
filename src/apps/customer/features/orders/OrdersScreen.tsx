import { useCallback, useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"
import { getCustomerOrderHistory, type CustomerOrder } from "../../data/orders"

export function OrdersScreen({ onClose, customerId }: { onClose: () => void; customerId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setOrders(await getCustomerOrderHistory(customerId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your order history.")
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  return (
    <main className={`${styles["page-screen"]}`}>
      <header className={`${styles["page-header"]}`}>
        <h1>Order history</h1>
        <HeaderButton
          icon="close"
          label="Close order history"
          onClick={onClose}
        />
      </header>
      {loading ? (
        <p className={styles["orders-message"]} role="status">Loading your orders…</p>
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
                  <small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</small>
                </div>
                <span className={styles["order-status-pill"]}>{order.status}</span>
              </div>
              <ul className={styles["history-order-items"]}>
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span>{item.quantity} × {item.name}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </li>
                ))}
                {order.items.length === 0 && <li>Items unavailable</li>}
              </ul>
              <div className={styles["history-order-total"]}>
                <span>Total</span>
                <strong>${order.total.toFixed(2)}</strong>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
