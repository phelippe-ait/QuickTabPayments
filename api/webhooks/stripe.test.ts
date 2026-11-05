// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./stripe";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  rpc: vi.fn(),
  retrieveCharge: vi.fn(),
}));

vi.mock("../_lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    charges: { retrieve: mocks.retrieveCharge },
  }),
}));

vi.mock("../_lib/supabaseAdmin", () => ({
  adminClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock("../_lib/env", () => ({
  serverEnv: () => ({ STRIPE_WEBHOOK_SECRET: "whsec_test" }),
}));

vi.mock("../_lib/http", () => ({
  readRawBody: async () => Buffer.from("{}"),
}));

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
    end() {
      return res;
    },
  };
  return res;
}

const req = {
  method: "POST",
  headers: { "stripe-signature": "sig" },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.retrieveCharge.mockResolvedValue({ receipt_url: "https://receipt" });
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects an invalid signature without writing anything", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = makeRes();
    await handler(req, res as never);

    expect(res.statusCode).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("confirms the order on payment_intent.succeeded", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          payment_method_types: ["card"],
          latest_charge: "ch_1",
        },
      },
    });
    const res = makeRes();
    await handler(req, res as never);

    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_succeeded", {
      p_stripe_payment_intent_id: "pi_1",
      p_receipt_url: "https://receipt",
      p_method: "card",
    });
    expect(res.statusCode).toBe(200);
  });

  it("cancels the pending order on payment_intent.payment_failed", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_2",
          last_payment_error: { message: "Declined" },
        },
      },
    });
    const res = makeRes();
    await handler(req, res as never);

    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_failed", {
      p_stripe_payment_intent_id: "pi_2",
      p_reason: "Declined",
    });
  });

  it("reconciles charge.refunded", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_3",
          amount: 4200,
          amount_refunded: 4200,
          refunds: { data: [{ id: "re_1" }] },
        },
      },
    });
    const res = makeRes();
    await handler(req, res as never);

    expect(mocks.rpc).toHaveBeenCalledWith("apply_refund_succeeded", {
      p_stripe_payment_intent_id: "pi_3",
      p_stripe_refund_id: "re_1",
      p_amount: 42,
      p_full: true,
    });
  });
});
