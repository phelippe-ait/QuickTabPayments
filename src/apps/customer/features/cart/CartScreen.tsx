import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"
import type { CartItem } from "../../types"

export function CartScreen({
  items,
  total,
  onClose,
  onRemove,
  onDecrease,
  onIncrease,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onRemove: (productName: string) => void;
  onDecrease: (productName: string) => void;
  onIncrease: (productName: string) => void;
  onCheckout: () => void;
}) {
  return (
    <main className={`${styles["page-screen"]} cart-screen`}>
      <header className={`${styles["page-header"]}`}>
        <h1>Review Your Order</h1>
        <HeaderButton icon="close" label="Close cart" onClick={onClose} />
      </header>
      {items.length > 0 ? (
        items.map(({ product, quantity }) => (
          <article className={`${styles["order-card"]}`} key={product.name}>
            <div>
              <span className={`${styles["item-name"]}`}>
                <span>{product.name}</span>
                <small>${product.price.toFixed(2)} each</small>
              </span>
              <span>${(product.price * quantity).toFixed(2)}</span>
            </div>
            <div>
              <span className={`${styles["qty-pill"]}`}>
                <button
                  aria-label={`Decrease ${product.name} quantity`}
                  onClick={() => onDecrease(product.name)}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  aria-label={`Increase ${product.name} quantity`}
                  onClick={() => onIncrease(product.name)}
                >
                  +
                </button>
              </span>
              <button onClick={() => onRemove(product.name)}>Remove</button>
            </div>
          </article>
        ))
      ) : (
        <div className={`${styles["empty-cart"]}`}>
          <span className={`${styles["large-cart"]}`}>
            <Icon name="cart" size={34} />
          </span>
          <h2>Your cart is empty</h2>
          <p>Add a drink from our hot beverage menu.</p>
          <Button variant="outline" className="w-auto px-6" onClick={onClose}>
            Browse menu
          </Button>
        </div>
      )}
      <div className={`${styles["checkout-dock"]}`}>
        <strong>Total: ${total.toFixed(2)}</strong>
        <button disabled={!items.length} onClick={onCheckout}>
          Checkout
        </button>
      </div>
    </main>
  );
}
