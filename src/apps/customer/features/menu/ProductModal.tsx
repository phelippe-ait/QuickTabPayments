import { useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"
import { ProductPhoto } from "./ProductPhoto"
import type { Product } from "../../types"

export function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
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
        aria-label={product.name}
      >
        <div className={`${styles["modal-close"]}`}>
          <HeaderButton
            icon="close"
            label="Close product details"
            onClick={onClose}
          />
        </div>
        <ProductPhoto product={product} large />
        <h2>{product.name}</h2>
        <p>{product.description}</p>
        <div className={`${styles["modal-price"]}`}>
          ${product.price.toFixed(2)}
        </div>
        {product.category === "Hot Beverages" && (
          <>
            <label className={`${styles["option-row"]}`}>
              <span>Size</span>
              <select defaultValue="Regular">
                <option>Regular</option>
                <option>Large</option>
              </select>
            </label>
            <label className={`${styles["option-row"]}`}>
              <span>Choice of milk</span>
              <select defaultValue="Full Cream Milk">
                <option>Full Cream Milk</option>
                <option>Oat Milk</option>
                <option>Almond Milk</option>
              </select>
            </label>
          </>
        )}
        <label className={`${styles["instructions"]}`}>
          <span>Special Instructions:</span>
          <textarea placeholder="e.g., no ice, extra hot, etc." />
        </label>
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
