import { describe, expect, it } from "vitest";
import { mapStripeError } from "./paymentErrors";

describe("mapStripeError", () => {
  it.each([
    ["card_declined", /declined/i],
    ["insufficient_funds", /insufficient funds/i],
    ["amount_too_small", /too small/i],
    ["expired_card", /expired/i],
    ["incorrect_cvc", /security code/i],
    ["requires_action", /verification/i],
    ["authentication_failure", /verify/i],
    ["network_error", /reach the payment service/i],
    ["rate_limit", /too many/i],
  ])("maps %s to a plain-English message", (code, pattern) => {
    const mapped = mapStripeError({ code });
    expect(mapped.code).toBe(code);
    expect(mapped.message).toMatch(pattern);
  });

  it("falls back to the Stripe message, then a safe default", () => {
    expect(mapStripeError({ code: "weird", message: "Try another card" })).toEqual(
      { code: "weird", message: "Try another card" },
    );
    expect(mapStripeError({}).message).toMatch(/could not be completed/i);
  });
});
