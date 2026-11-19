// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./refunds.js";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refundsCreate: vi.fn(),
  state: {
    role: "owner" as string | null,
    active: true,
    intent: "pi_1" as string | null,
    paymentStatus: "succeeded",
    paymentAmount: 100,
    line: null as Row | null,
    existingRefunds: [] as Row[],
    inserted: null as unknown,
  },
}));

vi.mock("./_lib/stripe", () => ({
  getStripe: () => ({ refunds: { create: mocks.refundsCreate } }),
}));

vi.mock("./_lib/supabaseAdmin", () => {
  function tableResult(table: string): { data: unknown; error: unknown } {
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
              amount: mocks.state.paymentAmount,
              status: mocks.state.paymentStatus,
              stripe_payment_intent_id: mocks.state.intent,
            }
          : {
              id: "payment-1",
              order_id: "order-1",
              amount: mocks.state.paymentAmount,
              status: mocks.state.paymentStatus,
              stripe_payment_intent_id: null,
            },
        error: null,
      };
    }
    if (table === "order_items") {
      return { data: mocks.state.line, error: null };
    }
    if (table === "refunds") {
      return { data: mocks.state.existingRefunds, error: null };
    }
    return { data: null, error: null };
  }

  function readChain(table: string) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => tableResult(table),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(tableResult(table)).then(resolve),
    };
    return chain;
  }

  function builder(table: string) {
    const chain: Record<string, unknown> = {
      ...readChain(table),
      insert: (row: unknown) => {
        mocks.state.inserted = { ...(row as object), id: "refund-1" };
        return {
          select: () => ({
            single: async () => ({ data: mocks.state.inserted, error: null }),
          }),
        };
      },
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
  mocks.state.paymentStatus = "succeeded";
  mocks.state.paymentAmount = 100;
  mocks.state.line = null;
  mocks.state.existingRefunds = [];
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

  it("forbids an inactive manager", async () => {
    mocks.state.active = false;
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

  it("rejects a payment that is not succeeded", async () => {
    mocks.state.paymentStatus = "pending";
    const res = makeRes();
    await handler(
      makeReq({ orderId: "order-1", paymentId: "payment-1", amount: 4 }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "payment_not_refundable" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("rejects a line refund whose amount does not match the snapshot", async () => {
    mocks.state.line = {
      id: "line-1",
      order_id: "order-1",
      unit_price_snapshot: 4.5,
      quantity: 2,
    };
    const res = makeRes();
    await handler(
      makeReq({
        orderId: "order-1",
        paymentId: "payment-1",
        orderItemId: "line-1",
        quantity: 2,
        amount: 5,
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "amount_mismatch" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("rejects a line quantity above the ordered quantity", async () => {
    mocks.state.line = {
      id: "line-1",
      order_id: "order-1",
      unit_price_snapshot: 4.5,
      quantity: 2,
    };
    const res = makeRes();
    await handler(
      makeReq({
        orderId: "order-1",
        paymentId: "payment-1",
        orderItemId: "line-1",
        quantity: 3,
        amount: 13.5,
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "invalid_quantity" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("rejects a line item that belongs to another order", async () => {
    mocks.state.line = null;
    const res = makeRes();
    await handler(
      makeReq({
        orderId: "order-1",
        paymentId: "payment-1",
        orderItemId: "other-line",
        quantity: 1,
        amount: 4.5,
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "invalid_line_item" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("rejects a refund above the remaining payment balance", async () => {
    mocks.state.paymentAmount = 10;
    mocks.state.existingRefunds = [{ amount: 8 }];
    const res = makeRes();
    await handler(
      makeReq({ orderId: "order-1", paymentId: "payment-1", amount: 3 }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "refund_exceeds_balance" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
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
      amount: 4.7,
    });
    expect(res.statusCode).toBe(200);
  });

  it("prices a line refund from the snapshot", async () => {
    mocks.state.line = {
      id: "line-1",
      order_id: "order-1",
      unit_price_snapshot: 4.5,
      quantity: 2,
    };
    const res = makeRes();
    await handler(
      makeReq({
        orderId: "order-1",
        paymentId: "payment-1",
        orderItemId: "line-1",
        quantity: 1,
        amount: 4.5,
      }),
      res as never,
    );

    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 450 }),
    );
    expect(mocks.state.inserted).toMatchObject({
      order_item_id: "line-1",
      quantity: 1,
      amount: 4.5,
    });
    expect(res.statusCode).toBe(200);
  });
});
