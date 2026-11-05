import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StripeCheckout } from "./StripeCheckout";

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    submit: vi.fn(async () => {
      calls.push("submit");
      return { error: null as null | { message: string; code?: string } };
    }),
    createPaymentIntent: vi.fn(async () => {
      calls.push("intent");
      return {
        clientSecret: "pi_1_secret",
        orderId: "order-1",
        orderNumber: "QT-1",
        trackingToken: "tok",
        amount: 4.7,
        currency: "AUD",
        status: "pending" as const,
      };
    }),
    confirmPayment: vi.fn(async () => {
      calls.push("confirm");
      return { error: null as null | { message: string; code?: string } };
    }),
    onPaid: vi.fn(),
  };
});

vi.mock("@stripe/react-stripe-js", async () => {
  const { useEffect } = await import("react");
  return {
    Elements: ({ children }: { children: ReactNode }) => children,
    PaymentElement: ({ onReady }: { onReady?: () => void }) => {
      useEffect(() => {
        onReady?.();
      }, [onReady]);
      return <div data-testid="payment-element" />;
    },
    useStripe: () => ({ confirmPayment: mocks.confirmPayment }),
    useElements: () => ({ submit: mocks.submit }),
  };
});

vi.mock("../../data/payments", () => ({
  getStripePromise: () => Promise.resolve({}),
  createPaymentIntent: mocks.createPaymentIntent,
}));

const items = [
  { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 1 },
];

function setup(canPay = true) {
  render(
    <StripeCheckout
      items={items}
      currency="AUD"
      taxRate={0.1}
      restaurantName="QuickTab Demo Cafe"
      tableNumber="T05"
      restaurantSlug="cafe"
      tableToken="table"
      customerName="Olivia"
      notes=""
      canPay={canPay}
      onPaid={mocks.onPaid}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.submit.mockImplementation(async () => {
    mocks.calls.push("submit");
    return { error: null };
  });
  mocks.createPaymentIntent.mockImplementation(async () => {
    mocks.calls.push("intent");
    return {
      clientSecret: "pi_1_secret",
      orderId: "order-1",
      orderNumber: "QT-1",
      trackingToken: "tok",
      amount: 4.7,
      currency: "AUD",
      status: "pending" as const,
    };
  });
  mocks.confirmPayment.mockImplementation(async () => {
    mocks.calls.push("confirm");
    return { error: null };
  });
});

describe("StripeCheckout", () => {
  it("validates the PaymentElement before creating the intent", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalledTimes(1));
    expect(mocks.calls).toEqual(["submit", "intent", "confirm"]);
  });

  it("does not create an order when element validation fails", async () => {
    mocks.submit.mockImplementationOnce(async () => {
      mocks.calls.push("submit");
      return { error: { code: "incomplete_number", message: "Your card number is incomplete." } };
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    expect(
      await screen.findByText("Your card number is incomplete."),
    ).toBeInTheDocument();
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
    expect(mocks.onPaid).not.toHaveBeenCalled();
  });

  it("surfaces a declined payment and leaves the order unconfirmed", async () => {
    mocks.confirmPayment.mockImplementationOnce(async () => {
      mocks.calls.push("confirm");
      return { error: { code: "card_declined", message: "Declined" } };
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    expect(
      await screen.findByText(/your card was declined/i),
    ).toBeInTheDocument();
    expect(mocks.onPaid).not.toHaveBeenCalled();
  });

  it("disables payment until the form is valid", () => {
    setup(false);
    expect(
      screen.getByRole("button", { name: /pay a\$4\.70/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/enter a name for the order/i),
    ).toBeInTheDocument();
  });
});
