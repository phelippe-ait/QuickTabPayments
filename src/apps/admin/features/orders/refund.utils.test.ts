import { describe, expect, it } from "vitest"
import type { OrderLineVM, PaymentVM } from "../../viewModels"
import {
  partialRefundAmount,
  refundableBalance,
  validateRefundAmount,
} from "./refund.utils"

const payments: PaymentVM[] = [
  {
    id: "payment-1",
    status: "succeeded",
    amount: 20,
    currency: "AUD",
    method: "Card",
    paidAt: null,
    receiptUrl: null,
    failureReason: null,
  },
  {
    id: "payment-2",
    status: "failed",
    amount: 5,
    currency: "AUD",
    method: "Card",
    paidAt: null,
    receiptUrl: null,
    failureReason: "declined",
  },
]

const lines: OrderLineVM[] = [
  {
    id: "line-1",
    name: "Flat White",
    quantity: 2,
    unitPrice: 4.7,
    subtotal: 9.4,
    imageUrl: null,
    notes: null,
  },
  {
    id: "line-2",
    name: "Flat White",
    quantity: 1,
    unitPrice: 4.7,
    subtotal: 4.7,
    imageUrl: null,
    notes: null,
  },
]

describe("refund helpers", () => {
  it("only counts succeeded payments", () => {
    expect(refundableBalance(payments, 5)).toBe(15)
    expect(refundableBalance(payments, 25)).toBe(0)
  })

  it("keys partial refunds by line id (duplicate names stay independent)", () => {
    expect(partialRefundAmount(lines, { "line-1": 2 })).toBe(9.4)
    expect(partialRefundAmount(lines, { "line-1": 1, "line-2": 1 })).toBe(9.4)
  })

  it("validates custom amounts numerically", () => {
    expect(validateRefundAmount(0, 10)).toMatch(/greater than zero/)
    expect(validateRefundAmount(11, 10)).toMatch(/remaining balance/)
    expect(validateRefundAmount(10, 10)).toBeNull()
  })
})
