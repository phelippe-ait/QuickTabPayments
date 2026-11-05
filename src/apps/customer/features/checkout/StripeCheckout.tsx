import { useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@shared/ui/Button";
import { formatMoney, roundMoney } from "@shared/lib/money";
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
  const { items, currency } = props;
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

  const options = useMemo(
    () => ({
      mode: "payment" as const,
      amount: Math.max(1, Math.round(total * 100)),
      currency: currency.toLowerCase(),
      paymentMethodCreation: "manual" as const,
      appearance: {
        theme: "stripe" as const,
        variables: { colorPrimary: "#ba4f60" },
      },
    }),
    [currency, total],
  );

  if (!stripePromise) {
    return <PaymentsNotConfigured />;
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm {...props} total={total} />
    </Elements>
  );
}

export function PaymentsNotConfigured() {
  return (
    <section
      className="mb-5 rounded-lg border border-line-2 bg-paper p-4"
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
  canPay,
  onRequestLocation,
  onPaid,
  onSetupError,
  total,
}: StripeCheckoutProps & { total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const pay = async () => {
    if (!stripe || !elements || !canPay || submitting) return;
    setError("");
    setSubmitting(true);

    try {
      const location = onRequestLocation ? await onRequestLocation() : undefined;
      // Deferred-intent PaymentElement: validate/collect the payment method
      // BEFORE any async work. Stripe requires elements.submit() first.
      const { error: submitError } = await elements.submit();
      if (submitError) {
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
      });

      const returnUrl = new URL(
        trackingUrl(intent.orderNumber, intent.trackingToken),
        window.location.origin,
      ).toString();

      const result = await stripe.confirmPayment({
        clientSecret: intent.clientSecret,
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (result.error) {
        setError(mapStripeError(result.error).message);
        return;
      }

      await onPaid(intent);
    } catch (caught) {
      onSetupError?.(caught);
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
      className="mb-5 rounded-lg border border-line-2 bg-paper p-4"
      aria-labelledby="payment-method-title"
    >
      <h2 id="payment-method-title" className="mb-1 text-[13px] font-bold text-berry">
        Payment
      </h2>
      <p className="mb-3 text-[11px] text-muted">
        Pay {formatMoney(total, currency)} securely with card, Apple Pay or
        Google Pay.
      </p>
      {onRequestLocation && (
        <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-[11px] leading-relaxed text-ink-mid">
          We’ll check that you’re within 500 m of the restaurant before creating
          your order. Your location isn’t saved with the order.
        </p>
      )}

      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs" }}
      />

      {error && (
        <p className="mt-3 text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}

      <Button
        className="mt-4"
        fullWidth
        type="button"
        onClick={() => void pay()}
        disabled={!canPay || !ready || submitting}
      >
        {submitting ? "Confirming payment…" : `Pay ${formatMoney(total, currency)}`}
      </Button>

      {!canPay && (
        <p className="mt-2 text-center text-[11px] text-muted" role="status">
          Enter a name for the order to enable payment.
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
