import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@shared/ui/Button";
import {
  computeTipPreview,
  formatMoney,
  roundMoney,
  type TipSelection,
} from "@shared/lib/money";
import {
  paymentFlowLabel,
  type PaymentFlowStatus,
} from "@shared/orders/paymentLabels";
import { trackingUrl } from "../../data/tracking";
import {
  createPaymentIntent,
  getStripePromise,
  type PaymentIntentResponse,
} from "../../data/payments";
import { mapStripeError } from "../../data/paymentErrors";
import type { CustomerLocation } from "../../data/geolocation";
import type { CartItem } from "../../types";

export type StripeCheckoutProps = {
  items: CartItem[];
  currency: string;
  taxRate: number;
  restaurantName: string;
  tableNumber: string;
  restaurantSlug: string;
  tableToken: string;
  customerName: string;
  notes: string;
  /** Optional tip chosen on the checkout screen; the server recomputes it. */
  tip?: TipSelection | null;
  /** Explains why Pay is disabled when the tip input is invalid. */
  disabledReason?: string;
  canPay: boolean;
  onRequestLocation?: () => Promise<CustomerLocation>;
  onPaid: (intent: PaymentIntentResponse) => Promise<void> | void;
  onSetupError?: (error: unknown) => void;
};

/**
 * Real Stripe checkout. The PaymentElement mounts in deferred-intent mode; the
 * pending order + PaymentIntent are only created when the customer presses Pay,
 * so abandoning checkout never creates a phantom order.
 */
export function StripeCheckout(props: StripeCheckoutProps) {
  const { items, currency, tip } = props;
  const stripePromise = getStripePromise();
  const total = useMemo(
    () =>
      roundMoney(
        items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ),
      ),
    [items],
  );
  // Preview only — `/api/create-payment-intent` charges the server's
  // `amount_due`, and the webhook remains the source of truth.
  const amountDue = roundMoney(total + computeTipPreview(total, tip ?? null));

  const options = useMemo(
    () => ({
      mode: "payment" as const,
      amount: Math.max(1, Math.round(amountDue * 100)),
      currency: currency.toLowerCase(),
      paymentMethodCreation: "manual" as const,
      appearance: {
        theme: "stripe" as const,
        variables: { colorPrimary: "#ba4f60" },
      },
    }),
    [currency, amountDue],
  );

  if (!stripePromise) {
    return <PaymentsNotConfigured />;
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm {...props} amountDue={amountDue} />
    </Elements>
  );
}

export function PaymentsNotConfigured() {
  return (
    <section
      className="mb-5 min-w-0 rounded-lg border border-line-2 bg-paper p-4"
      aria-labelledby="payments-unavailable-title"
    >
      <h2 id="payments-unavailable-title" className="text-[13px] font-bold text-berry">
        Payments are not configured
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-mid">
        Card payments aren&apos;t available on this menu yet. Please ask a team
        member to take your order, or try again later.
      </p>
    </section>
  );
}

function PaymentForm({
  items,
  currency,
  taxRate,
  restaurantName,
  tableNumber,
  restaurantSlug,
  tableToken,
  customerName,
  notes,
  tip,
  disabledReason,
  canPay,
  onRequestLocation,
  onPaid,
  onSetupError,
  amountDue,
}: StripeCheckoutProps & { amountDue: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [flowStatus, setFlowStatus] = useState<"idle" | PaymentFlowStatus>(
    "idle",
  );
  const [ready, setReady] = useState(false);

  // The tip changes the charge after the PaymentElement has mounted; keep the
  // element's amount (used by wallet buttons) in sync with the amount due.
  useEffect(() => {
    if (!elements) return;
    void elements.update({
      amount: Math.max(1, Math.round(amountDue * 100)),
    });
  }, [elements, amountDue]);

  const pay = async () => {
    if (!stripe || !elements || !canPay || submitting) return;
    setError("");
    setFlowStatus("processing");
    setSubmitting(true);

    try {
      const location = onRequestLocation ? await onRequestLocation() : undefined;
      // Deferred-intent PaymentElement: validate/collect the payment method
      // BEFORE any async work. Stripe requires elements.submit() first.
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setFlowStatus("failed");
        setError(mapStripeError(submitError).message);
        return;
      }

      const intent = await createPaymentIntent({
        restaurantSlug,
        tableToken,
        customerName,
        notes,
        items,
        location,
        tip: tip ?? null,
      });

      const returnUrl = new URL(
        trackingUrl(intent.orderNumber, intent.trackingToken),
        window.location.origin,
      ).toString();

      setFlowStatus("confirming");
      const result = await stripe.confirmPayment({
        clientSecret: intent.clientSecret,
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (result.error) {
        setFlowStatus("failed");
        setError(mapStripeError(result.error).message);
        return;
      }

      // Announce success before handing off; the confirmation screen may mount
      // immediately afterwards.
      setFlowStatus("succeeded");
      await onPaid(intent);
    } catch (caught) {
      onSetupError?.(caught);
      setFlowStatus("failed");
      setError(
        caught instanceof Error && caught.message
          ? caught.message === "payment_setup_failed"
            ? "We couldn't start the payment. Please try again."
            : caught.message
          : "Payment could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="mb-5 min-w-0 rounded-lg border border-line-2 bg-paper p-4"
      aria-labelledby="payment-method-title"
    >
      <h2 id="payment-method-title" className="mb-1 text-[13px] font-bold text-berry">
        Payment
      </h2>
      <p className="mb-3 text-[11px] text-muted">
        Pay {formatMoney(amountDue, currency)} securely with card, Apple Pay or
        Google Pay.
      </p>
      {onRequestLocation && (
        <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-[11px] leading-relaxed text-ink-mid">
          We’ll check that you’re within 500 m of the restaurant before creating
          your order. Your location isn’t saved with the order.
        </p>
      )}

      <div className="min-w-0">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{ layout: "tabs" }}
        />
      </div>

      {/* Mounted from the first render so assistive tech announces the text
          changes instead of missing a newly inserted live region. */}
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="payment-status"
      >
        {flowStatus === "processing" ||
        flowStatus === "confirming" ||
        flowStatus === "succeeded"
          ? paymentFlowLabel(flowStatus)
          : ""}
      </p>
      <p
        role="alert"
        aria-live="assertive"
        data-testid="payment-error"
        className={error ? "mt-3 text-[12px] text-danger" : "sr-only"}
      >
        {error && (
          <>
            <span className="sr-only">{paymentFlowLabel("failed")} — </span>
            <span>{error}</span>
          </>
        )}
      </p>

      <Button
        className="mt-4"
        fullWidth
        type="button"
        onClick={() => void pay()}
        disabled={!canPay || !ready || submitting}
      >
        {submitting
          ? "Confirming payment…"
          : `Pay ${formatMoney(amountDue, currency)}`}
      </Button>

      {!canPay && (
        <p className="mt-2 text-center text-[11px] text-muted" role="status">
          {disabledReason ?? "Enter a name for the order to enable payment."}
        </p>
      )}

      <p className="mt-3 text-center text-[10px] text-muted">
        {taxRate > 0 ? "GST included. " : ""}
        {restaurantName || "QuickTab"}
        {tableNumber ? ` · Table ${tableNumber}` : ""}
      </p>
    </section>
  );
}
