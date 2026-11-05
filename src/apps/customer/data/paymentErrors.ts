export type MappedPaymentError = {
  code: string;
  message: string;
};

/**
 * Translate Stripe error codes into plain English. Keep this pure so it can be
 * table-tested without the SDK.
 */
export function mapStripeError(error: unknown): MappedPaymentError {
  const source = (error ?? {}) as {
    code?: string;
    decline_code?: string;
    type?: string;
    message?: string;
  };
  const code = source.decline_code ?? source.code ?? source.type ?? "unknown";

  switch (code) {
    case "card_declined":
      return {
        code,
        message: "Your card was declined. Please try another payment method.",
      };
    case "insufficient_funds":
      return {
        code,
        message: "Your card has insufficient funds. Please try another card.",
      };
    case "amount_too_small":
      return {
        code,
        message: "This order total is too small to charge. Please add another item.",
      };
    case "expired_card":
      return {
        code,
        message: "Your card has expired. Please use a different card.",
      };
    case "incorrect_cvc":
      return {
        code,
        message: "The card security code is incorrect. Please check and retry.",
      };
    case "requires_action":
      return {
        code,
        message: "Your bank needs you to complete an extra verification step.",
      };
    case "authentication_failure":
      return {
        code,
        message: "We couldn't verify this payment. Please try again.",
      };
    case "network_error":
    case "api_connection_error":
      return {
        code,
        message: "We couldn't reach the payment service. Check your connection and retry.",
      };
    case "rate_limit":
      return {
        code,
        message: "Too many payment attempts. Please wait a moment and try again.",
      };
    default:
      return {
        code,
        message:
          source.message?.trim() ||
          "Payment could not be completed. Please try again.",
      };
  }
}
