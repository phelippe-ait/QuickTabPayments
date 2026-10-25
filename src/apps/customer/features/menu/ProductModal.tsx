import { useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { formatMoney } from "@shared/lib/money"
import { HeaderButton } from "../../components/CustomerUi"
import { ProductPhoto } from "./ProductPhoto"
import type { MenuItem } from "../../types"

export function ProductModal({
  item,
  currency,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  currency: string;
  onClose: () => void;
  onAdd: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className={`${styles["modal-shade"]}`}>
      <section
        className={`${styles["product-modal"]}`}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
      >
        <div className={`${styles["modal-close"]}`}>
          <HeaderButton
            icon="close"
            label="Close product details"
            onClick={onClose}
          />
        </div>
        <ProductPhoto item={item} large />
        <h2>{item.name}</h2>
        <p>{item.description || "Ask our team about this item."}</p>
        <div className={`${styles["modal-price"]}`}>
          {formatMoney(item.price, currency)}
        </div>
        {item.allergens.length > 0 && (
          <p className={`${styles["modal-meta"]}`}>
            <strong>Allergens:</strong> {item.allergens.join(", ")}
          </p>
        )}
        <div className={`${styles["modal-footer"]}`}>
          <div className={`${styles["quantity"]}`}>
            <button
              aria-label="Decrease quantity"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span>{quantity}</span>
            <button
              aria-label="Increase quantity"
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[5px]"
            onClick={() => onAdd(quantity)}
          >
            Add to Order
          </Button>
        </div>
      </section>
    </div>
  );
}
