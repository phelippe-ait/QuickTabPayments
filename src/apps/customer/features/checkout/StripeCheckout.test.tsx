import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TipSelection } from "@shared/lib/money";
import { StripeCheckout } from "./StripeCheckout";

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    submit: vi.fn(async () => {
      calls.push("submit");
      return { error: null as null | { message: string; code?: string } };
    }),
    update: vi.fn(async () => {}),
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
    useElements: () => ({ submit: mocks.submit, update: mocks.update }),
  };
});

vi.mock("../../data/payments", () => ({
  getStripePromise: () => Promise.resolve({}),
  createPaymentIntent: mocks.createPaymentIntent,
}));

const items = [
  { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 1 },
];

function setup(
  canPay = true,
  tip: TipSelection | null = null,
  disabledReason?: string,
) {
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
      tip={tip}
      disabledReason={disabledReason}
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

  it("charges the items total plus the tip and forwards the tip payload", async () => {
    setup(true, { type: "percent", value: 10 });
    expect(
      screen.getByRole("button", { name: /pay a\$5\.17/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pay a\$5\.17/i }));

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalledTimes(1));
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        tip: { type: "percent", value: 10 },
      }),
    );
  });

  it("sends a fixed custom tip", async () => {
    setup(true, { type: "fixed", value: 5 });
    expect(
      screen.getByRole("button", { name: /pay a\$9\.70/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pay a\$9\.70/i }));

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalledTimes(1));
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        tip: { type: "fixed", value: 5 },
      }),
    );
  });

  it("sends an explicit null tip when none is selected", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalledTimes(1));
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ tip: null }),
    );
  });

  it("explains why payment is disabled for an invalid tip", () => {
    setup(false, null, "Tip can't be more than $500.");
    expect(screen.getByText("Tip can't be more than $500.")).toBeInTheDocument();
  });

  it("mounts an empty polite status region before payment starts", () => {
    setup();

    const status = screen.getByTestId("payment-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });

  it("announces processing, confirmation and success", async () => {
    type IntentResult = Awaited<
      ReturnType<typeof mocks.createPaymentIntent>
    >;
    type ConfirmResult = Awaited<ReturnType<typeof mocks.confirmPayment>>;
    let resolveIntent!: (value: IntentResult) => void;
    let resolveConfirm!: (value: ConfirmResult) => void;

    mocks.createPaymentIntent.mockImplementationOnce(
      () =>
        new Promise<IntentResult>((resolve) => {
          resolveIntent = resolve;
        }),
    );
    mocks.confirmPayment.mockImplementationOnce(
      () =>
        new Promise<ConfirmResult>((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    const status = screen.getByTestId("payment-status");
    await waitFor(() =>
      expect(status).toHaveTextContent("Processing payment…"),
    );

    await act(async () => {
      resolveIntent({
        clientSecret: "pi_1_secret",
        orderId: "order-1",
        orderNumber: "QT-1",
        trackingToken: "tok",
        amount: 4.7,
        currency: "AUD",
        status: "pending",
      });
    });

    await waitFor(() =>
      expect(status).toHaveTextContent("Confirming your order…"),
    );

    await act(async () => {
      resolveConfirm({ error: null });
    });

    await waitFor(() =>
      expect(status).toHaveTextContent("Payment successful"),
    );
  });

  it("announces a failure assertively with its reason", async () => {
    mocks.confirmPayment.mockImplementationOnce(async () => {
      mocks.calls.push("confirm");
      return { error: { code: "card_declined", message: "Declined" } };
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /pay a\$4\.70/i }));

    const alert = screen.getByTestId("payment-error");
    await waitFor(() =>
      expect(alert).toHaveTextContent(
        "Payment failed — Your card was declined. Please try another payment method.",
      ),
    );
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByTestId("payment-status")).toBeEmptyDOMElement();
  });
});
