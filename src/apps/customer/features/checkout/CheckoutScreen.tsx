import { type FormEvent, useMemo, useState } from "react";
import styles from "../../App.module.css";
import { Button } from "@shared/ui/Button";
import { Icon } from "@shared/ui/Icon";
import { formatMoney, roundMoney, splitInclusiveTax } from "@shared/lib/money";
import { HeaderButton } from "../../components/CustomerUi";
import type { CartItem } from "../../types";

export type PlaceOrderInput = {
  customerName: string;
  notes: string;
};

/**
 * Phase 5 order placement. Payment is intentionally absent: this screen only
 * collects the customer's name/notes and shows GST-inclusive totals. Phase 6
 * (Stripe) will add a payment step before submitOrder().
 */
export function CheckoutScreen({
  items,
  currency,
  taxRate,
  tableNumber,
  canCheckout,
  onClose,
  onPlaceOrder,
  defaultName = "",
  error = "",
}: {
  items: CartItem[];
  currency: string;
  taxRate: number;
  tableNumber: string;
  canCheckout: boolean;
  onClose: () => void;
  onPlaceOrder: (input: PlaceOrderInput) => Promise<void>;
  defaultName?: string;
  error?: string;
}) {
  const [customerName, setCustomerName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCustomerName = customerName.trim().length > 0;

  const total = useMemo(
    () => roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
    [items],
  );
  const { subtotal, tax } = splitInclusiveTax(total, taxRate);
  const taxPercent = Math.round(taxRate * 100);
  const canSubmit = hasCustomerName && canCheckout && !isSubmitting;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onPlaceOrder({
        customerName: customerName.trim(),
        notes: notes.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`${styles["page-screen"]}`}>
      <header
        className={`${styles["page-header"]} ${styles["checkout-header"]}`}
      >
        <h1>Review &amp; place order</h1>
        <HeaderButton icon="close" label="Close checkout" onClick={onClose} />
      </header>

      <p className={styles["table-number"]}>
        <span>Ordering for</span> <strong>Table {tableNumber}</strong>
      </p>

      <form onSubmit={submit}>
        <label className={`${styles["checkout-field"]}`}>
          <span>Name for the order</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Enter your name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            required
          />
        </label>

        <label className={`${styles["checkout-field"]}`}>
          <span>Notes for the kitchen (optional)</span>
          <textarea
            className={styles["checkout-notes"]}
            placeholder="Allergies, no sauce, extra hot…"
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <section
          className="mb-5 rounded-lg border border-line-2 bg-paper p-4"
          aria-labelledby="order-summary-title"
        >
          <h2
            id="order-summary-title"
            className="mb-3 text-[13px] font-bold text-berry"
          >
            Order summary
          </h2>
          <ul className="flex flex-col gap-2 text-[12px] text-ink-mid">
            {items.map((item) => (
              <li key={item.menuItemId} className="flex justify-between gap-3">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatMoney(item.unitPrice * item.quantity, currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-3 text-[12px]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between text-ink-soft">
              <dt>GST (included{taxPercent ? `, ${taxPercent}%` : ""})</dt>
              <dd>{formatMoney(tax, currency)}</dd>
            </div>
            <div className="flex justify-between text-[14px] font-bold text-ink">
              <dt>Total</dt>
              <dd>{formatMoney(total, currency)}</dd>
            </div>
          </dl>
        </section>

        {error && (
          <p className={styles["auth-error"]} role="alert">
            {error}
          </p>
        )}

        <div className="mb-5 flex items-start gap-2 rounded-lg bg-cream-2 p-3 text-[11px] leading-relaxed text-ink-mid">
          <Icon name="card" size={16} />
          <span>
            No payment is taken online yet. Pay at the counter when you collect
            your order.
          </span>
        </div>

        {/* Phase 6: payment step goes here (Stripe PaymentIntent) before submitOrder(). */}
        <div className={`${styles["form-actions"]}`}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Back to cart
          </Button>
          <Button variant="primary" type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Placing order…" : "Place order"}
          </Button>
        </div>
      </form>
    </main>
  );
}
