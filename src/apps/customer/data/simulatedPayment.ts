import type { SimulatedPaymentMethod } from "../types"

/** How long the fake authorization takes, so the UI can show progress. */
export const SIMULATED_PAYMENT_DELAY_MS = 800

/**
 * @deprecated Phase 5 simulation only. Checkout now uses Stripe Elements
 * (`features/checkout/StripeCheckout.tsx`). Kept for old "last order" records.
 */
export async function simulatePayment(
  method: SimulatedPaymentMethod,
): Promise<void> {
  // Keep the parameter for the Phase 6 seam and make the intent explicit.
  void method
  await new Promise((resolve) =>
    window.setTimeout(resolve, SIMULATED_PAYMENT_DELAY_MS),
  )
}
