import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { formatMoney } from "@shared/lib/money"
import { HeaderButton } from "../../components/CustomerUi"
import { cartLineId } from "../../hooks/useCart"
import type { CartItem } from "../../types"

export function CartScreen({
  items,
  total,
  currency,
  onClose,
  onRemove,
  onDecrease,
  onIncrease,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  currency: string;
  onClose: () => void;
  onRemove: (menuItemId: string) => void;
  onDecrease: (menuItemId: string) => void;
  onIncrease: (menuItemId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <main className={`${styles["page-screen"]}`}>
      <header className={`${styles["page-header"]}`}>
        <h1>Review Your Order</h1>
        <HeaderButton icon="close" label="Close cart" onClick={onClose} />
      </header>
      {items.length > 0 ? (
        items.map((item) => (
          <article className={`${styles["order-card"]}`} key={item.lineId ?? cartLineId(item.menuItemId, item.modifiers)}>
            <div>
              <span className={`${styles["item-name"]}`}>
                <span>{item.name}</span>
                <small>{formatMoney(item.unitPrice, currency)} each</small>
                  {(item.modifiers?.length ?? 0) > 0 && (
                    <small>{item.modifiers?.map((modifier) => modifier.name).join(", ")}</small>
                  )}
              </span>
              <span>{formatMoney(item.unitPrice * item.quantity, currency)}</span>
            </div>
            <div>
              <span className={`${styles["qty-pill"]}`}>
                <button
                  type="button"
                  aria-label={`Decrease ${item.name} quantity`}
                  onClick={() => onDecrease(item.lineId ?? cartLineId(item.menuItemId, item.modifiers))}
                >
                  −
                </button>
                <span aria-live="polite">{item.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${item.name} quantity`}
                  onClick={() => onIncrease(item.lineId ?? cartLineId(item.menuItemId, item.modifiers))}
                >
                  +
                </button>
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name}${item.modifiers?.length ? ` with ${item.modifiers.map((modifier) => modifier.name).join(", ")}` : ""}`}
                onClick={() => onRemove(item.lineId ?? cartLineId(item.menuItemId, item.modifiers))}
              >
                Remove
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className={`${styles["empty-cart"]}`}>
          <span className={`${styles["large-cart"]}`}>
            <Icon name="cart" size={34} />
          </span>
          <h2>Your cart is empty</h2>
          <p>Add something from the menu to get started.</p>
          <Button variant="outline" className="w-auto px-6" onClick={onClose}>
            Browse menu
          </Button>
        </div>
      )}
      <div className={`${styles["checkout-dock"]}`}>
        <strong>Total: {formatMoney(total, currency)}</strong>
        <button
          type="button"
          disabled={!items.length}
          onClick={onCheckout}
        >
          Checkout
        </button>
      </div>
    </main>
  );
}
