import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useCreateRefund, useRefunds } from "./useRefunds"

const mocks = vi.hoisted(() => ({
  fetchRefundsForOrder: vi.fn(),
  requestStripeRefund: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
}))

vi.mock("@shared/data/refunds", () => ({
  refundKeys: { byOrder: (orderId: string) => ["refunds", orderId] },
  fetchRefundsForOrder: mocks.fetchRefundsForOrder,
  requestStripeRefund: mocks.requestStripeRefund,
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const refund = {
  id: "refund-1",
  order_id: "order-1",
  payment_id: "payment-1",
  order_item_id: "line-1",
  quantity: 1,
  amount: 4.7,
  reason: "One coffee remade",
  status: "succeeded" as const,
  stripe_refund_id: "re_123",
  created_by: "user-1",
  created_at: "2026-10-21T09:00:00Z",
}

describe("useRefunds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchRefundsForOrder.mockResolvedValue([refund])
    mocks.requestStripeRefund.mockResolvedValue(refund)
  })

  it("loads refund history for an order", async () => {
    const { result } = renderHook(() => useRefunds("order-1"), { wrapper })

    await waitFor(() => expect(result.current.refunds).toHaveLength(1))
    expect(result.current.refunds[0].amount).toBe(4.7)
    expect(mocks.fetchRefundsForOrder).toHaveBeenCalledWith("order-1")
  })

  it("sends a refund to Stripe and reports success", async () => {
    const { result } = renderHook(
      () =>
        useCreateRefund("order-1", { onSuccess: mocks.onSuccess }),
      { wrapper },
    )

    let ok = false
    await act(async () => {
      ok = await result.current.createRefund({
        orderId: "order-1",
        paymentId: "payment-1",
        amount: 4.7,
        reason: "Line refund",
      })
    })

    expect(ok).toBe(true)
    expect(mocks.requestStripeRefund).toHaveBeenCalledWith({
      orderId: "order-1",
      paymentId: "payment-1",
      amount: 4.7,
      reason: "Line refund",
    })
    expect(mocks.onSuccess).toHaveBeenCalledWith("Refund sent to Stripe")
  })

  it("returns false and surfaces trigger errors", async () => {
    mocks.requestStripeRefund.mockRejectedValueOnce(
      new Error("Refund amount exceeds the remaining payment balance"),
    )
    const { result } = renderHook(
      () => useCreateRefund("order-1", { onError: mocks.onError }),
      { wrapper },
    )

    let ok = true
    await act(async () => {
      ok = await result.current.createRefund({
        orderId: "order-1",
        paymentId: "payment-1",
        amount: 999,
      })
    })

    expect(ok).toBe(false)
    expect(mocks.onError).toHaveBeenCalledWith(
      "Refund amount exceeds the remaining payment balance",
    )
  })
})
