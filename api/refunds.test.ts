// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./refunds";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refundsCreate: vi.fn(),
  state: {
    role: "owner" as string | null,
    active: true,
    intent: "pi_1" as string | null,
    inserted: null as unknown,
  },
}));

vi.mock("./_lib/stripe", () => ({
  getStripe: () => ({ refunds: { create: mocks.refundsCreate } }),
}));

vi.mock("./_lib/supabaseAdmin", () => {
  function builder(table: string) {
    const result = () => {
      if (table === "orders") {
        return { data: { id: "order-1", restaurant_id: "r1" }, error: null };
      }
      if (table === "restaurant_staff") {
        return {
          data:
            mocks.state.role === null
              ? null
              : { role: mocks.state.role, is_active: mocks.state.active },
          error: null,
        };
      }
      if (table === "payments") {
        return {
          data: mocks.state.intent
            ? {
                id: "payment-1",
                order_id: "order-1",
                stripe_payment_intent_id: mocks.state.intent,
              }
            : { id: "payment-1", order_id: "order-1", stripe_payment_intent_id: null },
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = async () => result();
    chain.insert = (row: unknown) => {
      mocks.state.inserted = { ...(row as object), id: "refund-1" };
      return {
        select: () => ({
          single: async () => ({ data: mocks.state.inserted, error: null }),
        }),
      };
    };
    return chain;
  }

  return {
    adminClient: () => ({
      auth: { getUser: mocks.getUser },
      from: (table: string) => builder(table),
    }),
  };
});

function makeRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function makeReq(body: unknown) {
  return {
    method: "POST",
    body,
    headers: { authorization: "Bearer token" },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.role = "owner";
  mocks.state.active = true;
  mocks.state.intent = "pi_1";
  mocks.state.inserted = null;
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mocks.refundsCreate.mockResolvedValue({ id: "re_1", status: "succeeded" });
});

describe("POST /api/refunds", () => {
  it("rejects a caller without a JWT", async () => {
    const res = makeRes();
    await handler(
      { method: "POST", body: {}, headers: {} } as never,
      res as never,
    );
    expect(res.statusCode).toBe(401);
  });

  it("forbids a non-manager", async () => {
    mocks.state.role = "kitchen";
    const res = makeRes();
    await handler(
      makeReq({ orderId: "order-1", paymentId: "payment-1", amount: 4 }),
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("rejects a payment with no Stripe intent", async () => {
    mocks.state.intent = null;
    const res = makeRes();
    await handler(
      makeReq({ orderId: "order-1", paymentId: "payment-1", amount: 4 }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "no_stripe_payment" });
  });

  it("creates a Stripe refund in minor units and stores the refund id", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        orderId: "order-1",
        paymentId: "payment-1",
        amount: 4.7,
        reason: "Line refund",
      }),
      res as never,
    );

    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_1", amount: 470 }),
    );
    expect(mocks.state.inserted).toMatchObject({
      stripe_refund_id: "re_1",
      status: "succeeded",
      created_by: "user-1",
    });
    expect(res.statusCode).toBe(200);
  });
});
