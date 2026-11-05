import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentIntent, PaymentSetupError } from "./payments";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@shared/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

const input = {
  restaurantSlug: "cafe",
  tableToken: "table",
  customerName: "Jane",
  notes: "No sauce",
  items: [
    { menuItemId: "item-1", name: "Flat White", unitPrice: 4.7, quantity: 2 },
  ],
};

const response = {
  clientSecret: "pi_1_secret",
  orderId: "order-1",
  orderNumber: "QT-1",
  trackingToken: "tok",
  amount: 9.4,
  currency: "AUD",
  status: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => response,
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("createPaymentIntent", () => {
  it("sends no Authorization header for guests", async () => {
    await createPaymentIntent(input);

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/create-payment-intent",
      expect.anything(),
    );
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(init.body))).toMatchObject({
      restaurantSlug: "cafe",
      tableToken: "table",
      customerName: "Jane",
      items: [{ menu_item_id: "item-1", quantity: 2 }],
    });
  });

  it("forwards the access token for signed-in customers", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "jwt-123" } },
    });

    await createPaymentIntent(input);

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer jwt-123",
    );
  });

  it("maps API errors onto checkout codes", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "menu_item_unavailable" }),
    });

    await expect(createPaymentIntent(input)).rejects.toMatchObject({
      name: "PaymentSetupError",
      code: "menu_item_unavailable",
    });
    await expect(createPaymentIntent(input)).rejects.toBeInstanceOf(
      PaymentSetupError,
    );
  });
});
