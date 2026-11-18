import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimGuestOrder } from "./orders";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("claimGuestOrder", () => {
  it("claims with the trimmed tracking token", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(claimGuestOrder(" token-1 ")).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_guest_order", {
      p_tracking_token: "token-1",
    });
  });

  it("does nothing for an empty token", async () => {
    await expect(claimGuestOrder("   ")).resolves.toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("is a safe no-op when the same order is claimed a second time", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    await expect(claimGuestOrder("token-1")).resolves.toBe(true);
    await expect(claimGuestOrder("token-1")).resolves.toBe(false);

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "claim_guest_order", {
      p_tracking_token: "token-1",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "claim_guest_order", {
      p_tracking_token: "token-1",
    });
  });

  it("rejects a token owned by someone else without throwing", async () => {
    // The RPC updates only rows with customer_id is null, so a foreign token
    // (or an unknown one) reports zero rows and returns false.
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(claimGuestOrder("foreign-token")).resolves.toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_guest_order", {
      p_tracking_token: "foreign-token",
    });
  });

  it("returns false when the RPC rejects the claim", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });

    await expect(claimGuestOrder("token-1")).resolves.toBe(false);
  });

  it("returns false (never throws) for an unauthenticated caller", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "not_authenticated", code: "P0001" },
    });

    await expect(claimGuestOrder("token-1")).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "claim_guest_order failed",
      expect.objectContaining({ message: "not_authenticated" }),
    );
  });
});
