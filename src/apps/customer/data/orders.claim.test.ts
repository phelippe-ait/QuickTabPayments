import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimGuestOrder } from "./orders";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
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

  it("returns false when the RPC rejects the claim", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });

    await expect(claimGuestOrder("token-1")).resolves.toBe(false);
  });
});
