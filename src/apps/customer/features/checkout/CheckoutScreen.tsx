import { type FormEvent, useMemo, useState } from "react";
import styles from "../../App.module.css";
import { Button } from "@shared/ui/Button";
import {
  formatMoney,
  inclusiveTaxLabel,
  roundMoney,
  splitInclusiveTax,
} from "@shared/lib/money";
import { HeaderButton } from "../../components/CustomerUi";
import {
  PaymentsNotConfigured,
  StripeCheckout,
} from "./StripeCheckout";
import { stripePublishableKey, type PaymentIntentResponse } from "../../data/payments";
import type { CustomerLocation } from "../../data/geolocation";
import type { CartItem } from "../../types";

export type PlaceOrderInput = {
  customerName: string;
  notes: string;
  intent: PaymentIntentResponse;
};

/**
 * Checkout: customer details, order summary, and the Stripe PaymentElement.
 * The pending order is created by `/api/create-payment-intent` when Pay is
 * pressed; the webhook is the source of truth for confirmation.
 */
export function CheckoutScreen({
  items,
  currency,
  taxRate,
  restaurantName,
  restaurantSlug,
  tableToken,
  tableNumber,
  canCheckout,
  onClose,
  onPlaceOrder,
  defaultName = "",
  error = "",
  onRequestLocation,
  onSetupError,
}: {
  items: CartItem[];
  currency: string;
  taxRate: number;
  restaurantName: string;
  restaurantSlug: string;
  tableToken: string;
  tableNumber: string;
  canCheckout: boolean;
  onClose: () => void;
  onPlaceOrder: (input: PlaceOrderInput) => Promise<void>;
  onRequestLocation?: () => Promise<CustomerLocation>;
  defaultName?: string;
  error?: string;
  onSetupError?: (error: unknown) => void;
}) {
  const [customerName, setCustomerName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const hasCustomerName = customerName.trim().length > 0;

  const total = useMemo(
    () =>
      roundMoney(
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      ),
    [items],
  );
  const { subtotal, tax } = splitInclusiveTax(total, taxRate);
  const canPay = hasCustomerName && canCheckout;
  const hasStripe = Boolean(stripePublishableKey);

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
              <dt>{inclusiveTaxLabel(taxRate)}</dt>
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
        {hasStripe ? (
          <StripeCheckout
            items={items}
            currency={currency}
            taxRate={taxRate}
            restaurantName={restaurantName}
            tableNumber={tableNumber}
            restaurantSlug={restaurantSlug}
            tableToken={tableToken}
            customerName={customerName.trim()}
            notes={notes.trim()}
            canPay={canPay}
            onRequestLocation={onRequestLocation}
            onSetupError={onSetupError}
            onPaid={async (intent) =>
              onPlaceOrder({
                customerName: customerName.trim(),
                notes: notes.trim(),
                intent,
              })
            }
          />
        ) : (
          <PaymentsNotConfigured />
        )}


        <div className={`${styles["form-actions"]}`}>
          <Button variant="secondary" onClick={onClose}>
            Back to cart
          </Button>
        </div>
      </form>
    </main>
  );
}
