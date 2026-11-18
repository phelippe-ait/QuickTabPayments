import { type FormEvent, useMemo, useState } from "react";
import styles from "../../App.module.css";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
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
import {
  customTipError,
  initialTipState,
  selectCustom,
  selectPreset,
  TIP_PRESETS,
  tipLabel,
  tipPreviewAmount,
  tipSelectionPayload,
} from "./tipSelection";
import { stripePublishableKey, type PaymentIntentResponse } from "../../data/payments";
import type { CustomerLocation } from "../../data/geolocation";
import type { CartItem } from "../../types";
import { cartLineId } from "../../hooks/useCart";

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
  const [tip, setTip] = useState(initialTipState);
  const hasCustomerName = customerName.trim().length > 0;

  const total = useMemo(
    () =>
      roundMoney(
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      ),
    [items],
  );
  const { subtotal, tax } = splitInclusiveTax(total, taxRate);

  // The tip is optional and previewed with the shared helper; the server still
  // recomputes it from `tipSelectionPayload`.
  const tipError = customTipError(tip);
  const tipSelection = tipSelectionPayload(tip);
  const tipAmount = tipPreviewAmount(tip, total);
  const amountDue = roundMoney(total + tipAmount);

  const canPay = hasCustomerName && canCheckout && !tipError;
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
          aria-labelledby="tip-title"
        >
          <h2 id="tip-title" className="text-[13px] font-bold text-berry">
            Add a tip
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Optional. A tip goes to the team and carries no GST.
          </p>

          <div
            role="radiogroup"
            aria-labelledby="tip-title"
            className="mt-3 flex flex-col gap-2"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIP_PRESETS.map((percent) => {
                const checked = tip.mode === "preset" && tip.percent === percent;
                return (
                  <label
                    key={percent}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-[12px] font-bold transition focus-within:ring-2 focus-within:ring-berry/40",
                      checked
                        ? "border-berry bg-berry-soft text-berry-deep"
                        : "border-line-2 bg-white text-ink-mid hover:border-berry",
                    )}
                  >
                    <input
                      type="radio"
                      name="tip-choice"
                      value={percent}
                      checked={checked}
                      onChange={() =>
                        setTip((current) => selectPreset(current, percent))
                      }
                      className="sr-only"
                    />
                    {percent === 0 ? "0%" : `${percent}%`}
                  </label>
                );
              })}
            </div>

            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-[12px] font-bold transition focus-within:ring-2 focus-within:ring-berry/40",
                tip.mode === "custom"
                  ? "border-berry bg-berry-soft text-berry-deep"
                  : "border-line-2 bg-white text-ink-mid hover:border-berry",
              )}
            >
              <input
                type="radio"
                name="tip-choice"
                value="custom"
                checked={tip.mode === "custom"}
                onChange={() => setTip(selectCustom)}
                className="sr-only"
              />
              Custom amount
            </label>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="tip-custom-amount"
                className="text-[11px] font-semibold text-ink-mid"
              >
                Custom tip amount (AUD)
              </label>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-[13px] text-ink-mid">
                  $
                </span>
                <input
                  id="tip-custom-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={tip.custom}
                  disabled={tip.mode !== "custom"}
                  onChange={(event) => {
                    const custom = event.target.value;
                    setTip((current) => ({ ...selectCustom(current), custom }));
                  }}
                  aria-invalid={tipError ? true : undefined}
                  aria-describedby={
                    tipError ? "tip-custom-amount-error" : undefined
                  }
                  className="h-11 w-28 rounded-[7px] border border-line bg-white px-3 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry disabled:cursor-not-allowed disabled:bg-cream disabled:text-muted"
                />
              </div>
              {tipError && (
                <p
                  id="tip-custom-amount-error"
                  role="alert"
                  className="text-[11px] text-danger"
                >
                  {tipError}
                </p>
              )}
            </div>
          </div>

          <p className="mt-3 text-[12px] text-ink-mid" aria-live="polite">
            {tipLabel(tip)} — {formatMoney(tipAmount, currency)}
          </p>
        </section>

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
              <li key={item.lineId ?? cartLineId(item.menuItemId, item.modifiers)} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {item.quantity} × {item.name}
                  {(item.modifiers?.length ?? 0) > 0 && (
                    <small className="mt-1 block text-[10px] text-muted">
                      {item.modifiers?.map((modifier) => modifier.name).join(", ")}
                    </small>
                  )}
                </span>
                <span className="shrink-0">{formatMoney(item.unitPrice * item.quantity, currency)}</span>
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
            <div className="flex justify-between">
              <dt>Items total</dt>
              <dd>{formatMoney(total, currency)}</dd>
            </div>
            <div aria-live="polite" className="flex flex-col gap-2">
              <div className="flex justify-between">
                <dt>{tipLabel(tip)}</dt>
                <dd>{formatMoney(tipAmount, currency)}</dd>
              </div>
              <div className="flex justify-between text-[14px] font-bold text-ink">
                <dt>Amount due</dt>
                <dd>{formatMoney(amountDue, currency)}</dd>
              </div>
            </div>
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            GST is included in the items total. Tips are added on top and carry
            no GST.
          </p>
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
            tip={tipSelection}
            disabledReason={tipError || undefined}
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
