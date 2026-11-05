// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./create-payment-intent";

const mocks = vi.hoisted(() => ({
  userRpc: vi.fn(),
  adminRpc: vi.fn(),
  createIntent: vi.fn(),
  cancelIntent: vi.fn(),
}));

vi.mock("./_lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: {
      create: mocks.createIntent,
      cancel: mocks.cancelIntent,
    },
  }),
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  userClient: () => ({ rpc: mocks.userRpc }),
  adminClient: () => ({ rpc: mocks.adminRpc }),
}));

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

function makeReq(body: unknown, method = "POST") {
  return {
    method,
    body,
    headers: { authorization: "Bearer token" },
  } as never;
}

const placed = {
  order_id: "order-1",
  order_number: "QT-1",
  tracking_token: "tok",
  total: 42,
  currency: "AUD",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userRpc.mockResolvedValue({ data: placed, error: null });
  mocks.adminRpc.mockResolvedValue({ error: null });
  mocks.createIntent.mockResolvedValue({
    id: "pi_1",
    client_secret: "pi_1_secret",
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
    });
    expect(mocks.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4200, currency: "aud" }),
    );
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "record_payment_intent",
      expect.objectContaining({ p_stripe_payment_intent_id: "pi_1" }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clientSecret: "pi_1_secret",
      orderNumber: "QT-1",
      status: "pending",
    });
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
