// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./create-payment-intent.js";

const mocks = vi.hoisted(() => ({
  userRpc: vi.fn(),
  adminRpc: vi.fn(),
  createIntent: vi.fn(),
  retrieveIntent: vi.fn(),
  cancelIntent: vi.fn(),
  userClient: vi.fn(),
  adminFrom: vi.fn(),
  existingPayments: [] as Record<string, unknown>[],
}));

vi.mock("./_lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: {
      create: mocks.createIntent,
      retrieve: mocks.retrieveIntent,
      cancel: mocks.cancelIntent,
    },
  }),
}));

vi.mock("./_lib/supabaseAdmin", () => {
  function paymentsChain() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: async () => ({ data: mocks.existingPayments, error: null }),
    };
    return chain;
  }

  return {
    userClient: (accessToken: string | null) => {
      mocks.userClient(accessToken);
      return { rpc: mocks.userRpc };
    },
    adminClient: () => ({
      rpc: mocks.adminRpc,
      from: (table: string) => {
        mocks.adminFrom(table);
        return paymentsChain();
      },
    }),
  };
});

type FakeRes = {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
};

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function makeReq(
  body: unknown,
  method = "POST",
  headers: Record<string, string> = { authorization: "Bearer token" },
) {
  return {
    method,
    body,
    headers,
  } as never;
}

const placed = {
  order_id: "order-1",
  order_number: "QT-1",
  tracking_token: "tok",
  total: 42,
  tip_amount: 0,
  amount_due: 42,
  currency: "AUD",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existingPayments = [];
  mocks.userRpc.mockResolvedValue({ data: placed, error: null });
  mocks.adminRpc.mockResolvedValue({ error: null });
  mocks.createIntent.mockResolvedValue({
    id: "pi_1",
    client_secret: "pi_1_secret",
  });
  mocks.retrieveIntent.mockResolvedValue({
    id: "pi_old",
    client_secret: "pi_old_secret",
    status: "succeeded",
  });
  mocks.cancelIntent.mockResolvedValue({});
});

describe("POST /api/create-payment-intent", () => {
  it("rejects non-POST methods", async () => {
    const res = makeRes();
    await handler(makeReq(null, "GET"), res as never);
    expect(res.statusCode).toBe(405);
  });

  it("rejects an incomplete body", async () => {
    const res = makeRes();
    await handler(makeReq({ restaurantSlug: "x" }), res as never);
    expect(res.statusCode).toBe(400);
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });

  it("creates a pending order + intent and returns the client secret", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: " Jane ",
        notes: " no sauce ",
        items: [{ menu_item_id: "item-1", quantity: 2.9 }],
      }),
      res as never,
    );

    expect(mocks.userRpc).toHaveBeenCalledWith("place_order", {
      p_restaurant_slug: "cafe",
      p_table_token: "table",
      p_customer_name: "Jane",
      p_notes: "no sauce",
      p_items: [{ menu_item_id: "item-1", quantity: 2 }],
      p_customer_latitude: null,
      p_customer_longitude: null,
    });
    expect(mocks.userClient).toHaveBeenCalledWith("token");
    expect(mocks.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4200, currency: "aud" }),
      { idempotencyKey: "order-intent-order-1" },
    );
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "record_payment_intent",
      expect.objectContaining({ p_stripe_payment_intent_id: "pi_1", p_amount: 42 }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clientSecret: "pi_1_secret",
      orderNumber: "QT-1",
      status: "pending",
    });
  });

  it("creates a guest order + intent when there is no Authorization header", async () => {
    const res = makeRes();
    await handler(
      makeReq(
        {
          restaurantSlug: "cafe",
          tableToken: "table",
          customerName: "Guest",
          items: [{ menu_item_id: "item-1", quantity: 1 }],
        },
        "POST",
        {},
      ),
      res as never,
    );

    // No Bearer token: the handler still calls place_order as anon, so
    // auth.uid() stays null and the order is a guest order.
    expect(mocks.userClient).toHaveBeenCalledWith(null);
    expect(mocks.userRpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_restaurant_slug: "cafe",
        p_table_token: "table",
        p_customer_name: "Guest",
      }),
    );
    expect(mocks.createIntent).toHaveBeenCalledTimes(1);
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "record_payment_intent",
      expect.objectContaining({ p_stripe_payment_intent_id: "pi_1" }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clientSecret: "pi_1_secret",
      orderNumber: "QT-1",
      trackingToken: "tok",
      status: "pending",
    });
  });

  it("charges amount_due and forwards a valid tip to the RPC", async () => {
    mocks.userRpc.mockResolvedValueOnce({
      data: { ...placed, tip_amount: 4.2, amount_due: 46.2 },
      error: null,
    });
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        tip: { type: "percent", value: 10 },
      }),
      res as never,
    );

    expect(mocks.userRpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_tip: { type: "percent", value: 10 },
      }),
    );
    expect(mocks.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4620,
        metadata: expect.objectContaining({ tipAmount: "4.2" }),
      }),
      { idempotencyKey: "order-intent-order-1" },
    );
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "record_payment_intent",
      expect.objectContaining({ p_amount: 46.2 }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      amount: 46.2,
      total: 42,
      tipAmount: 4.2,
      amountDue: 46.2,
    });
  });

  it("forwards whitelisted modifier ids to the RPC", async () => {
    const size = "11111111-1111-4111-8111-111111111111";
    const milk = "22222222-2222-4222-8222-222222222222";
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [
          { menu_item_id: "item-1", quantity: 2, modifiers: [size, milk] },
        ],
      }),
      res as never,
    );

    expect(mocks.userRpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_items: [
          { menu_item_id: "item-1", quantity: 2, modifiers: [size, milk] },
        ],
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("rejects a non-uuid modifier before calling the RPC", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [
          { menu_item_id: "item-1", quantity: 1, modifiers: ["not-a-uuid"] },
        ],
      }),
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });

  it("leaves items without modifiers byte-identical", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1, modifiers: undefined }],
      }),
      res as never,
    );

    expect(mocks.userRpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_items: [{ menu_item_id: "item-1", quantity: 1 }],
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("rejects a malformed tip before calling the RPC", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        tip: { type: "percent", value: "10" },
      }),
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });

  it("forwards the checkout idempotency key to place_order", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        idempotencyKey: "checkout-1",
      }),
      res as never,
    );

    expect(mocks.userRpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({ p_idempotency_key: "checkout-1" }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("rejects an overlong idempotency key before calling the RPC", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        idempotencyKey: "x".repeat(129),
      }),
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });

  it("reuses the existing PaymentIntent on a retried checkout", async () => {
    mocks.existingPayments = [
      { stripe_payment_intent_id: "pi_old", status: "succeeded" },
    ];
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        idempotencyKey: "checkout-1",
      }),
      res as never,
    );

    expect(mocks.retrieveIntent).toHaveBeenCalledWith("pi_old");
    expect(mocks.createIntent).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clientSecret: "pi_old_secret",
      paymentStatus: "succeeded",
      orderId: "order-1",
    });
  });

  it("treats a duplicate payment row as success", async () => {
    mocks.adminRpc.mockResolvedValueOnce({
      error: { code: "23505", message: "duplicate key value" },
    });
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
      }),
      res as never,
    );

    expect(mocks.cancelIntent).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("cancels the intent when the payment row cannot be recorded", async () => {
    mocks.adminRpc.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = makeRes();
    await handler(
      makeReq({
        restaurantSlug: "cafe",
        tableToken: "table",
        customerName: "Jane",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
      }),
      res as never,
    );

    expect(mocks.cancelIntent).toHaveBeenCalledWith("pi_1");
    expect(res.statusCode).toBe(500);
  });
});
