import type { SimulatedPaymentMethod } from "../types"

/** How long the fake authorization takes, so the UI can show progress. */
export const SIMULATED_PAYMENT_DELAY_MS = 800

/**
 * Phase 5 simulation only. No Stripe SDK, network request, or payment row is
 * involved. Phase 6 replaces this function with PaymentIntent confirmation;
 * the rest of the checkout flow stays the same.
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
