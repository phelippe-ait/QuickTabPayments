import { type FormEvent, useMemo, useState } from "react";
import styles from "../../App.module.css";
import { Button } from "@shared/ui/Button";
import { Icon } from "@shared/ui/Icon";
import { formatMoney, roundMoney, splitInclusiveTax } from "@shared/lib/money";
import { HeaderButton } from "../../components/CustomerUi";
import { simulatePayment } from "../../data/simulatedPayment";
import {
  simulatedPaymentLabels,
  type CartItem,
  type SimulatedPaymentMethod,
} from "../../types";

export type PlaceOrderInput = {
  customerName: string;
  notes: string;
  paymentMethod: SimulatedPaymentMethod;
};

/**
 * Checkout with simulated payment methods. Selecting a method runs a short
 * fake authorization and then places the order through the existing RPC.
 * Phase 6 replaces `simulatePayment` with Stripe; no payment data is stored.
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
  const [processingMethod, setProcessingMethod] =
    useState<SimulatedPaymentMethod | null>(null);
  const hasCustomerName = customerName.trim().length > 0;

  const total = useMemo(
    () => roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
    [items],
  );
  const { subtotal, tax } = splitInclusiveTax(total, taxRate);
  const taxPercent = Math.round(taxRate * 100);
  const canPay = hasCustomerName && canCheckout && !processingMethod;

  const pay = async (method: SimulatedPaymentMethod) => {
    if (!canPay) return;
    setProcessingMethod(method);
    try {
      await simulatePayment(method);
      await onPlaceOrder({
        customerName: customerName.trim(),
        notes: notes.trim(),
        paymentMethod: method,
      });
    } finally {
      setProcessingMethod(null);
    }
  };

  const preventSubmit = (event: FormEvent) => {
    event.preventDefault();
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

      <form onSubmit={preventSubmit}>
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

        <section
          className={`${styles["express-checkout"]}`}
          aria-labelledby="payment-method-title"
        >
          <h2 id="payment-method-title">Choose how you&apos;d like to pay</h2>
          <p className={styles["payment-test-note"]}>
            <Icon name="card" size={15} />
            <span>
              Test mode — payment is simulated. No money moves and no card
              details are required.
            </span>
          </p>
          <div className={`${styles["express-options"]}`}>
            <button
              type="button"
              className={`${styles["express-button"]}`}
              onClick={() => void pay("card")}
              disabled={!canPay}
            >
              <Icon name="card" size={17} />
              Credit / Debit Card
            </button>
            <button
              type="button"
              className={`${styles["express-button"]} ${styles["apple-pay"]}`}
              onClick={() => void pay("apple_pay")}
              disabled={!canPay}
            >
              <Icon name="apple" size={17} />
              Apple Pay
            </button>
            <button
              type="button"
              className={`${styles["express-button"]} google-pay`}
              onClick={() => void pay("google_pay")}
              disabled={!canPay}
            >
              <Icon name="google" size={18} />
              Google Pay
            </button>
            <button
              type="button"
              className={`${styles["express-button"]} ${styles["link-pay"]}`}
              onClick={() => void pay("link")}
              disabled={!canPay}
            >
              Link
            </button>
          </div>
          <p
            className={styles["payment-hint"]}
            role="status"
            aria-live="polite"
          >
            {processingMethod
              ? `Processing ${simulatedPaymentLabels[processingMethod]}…`
              : "Selecting a payment method will place your order."}
          </p>
        </section>

        <div className={`${styles["form-actions"]}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={Boolean(processingMethod)}
          >
            Back to cart
          </Button>
        </div>
      </form>
    </main>
  );
}
