import { describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useNewOrders } from "./useNewOrders"

const ids = (...orderIds: string[]) => orderIds.map((id) => ({ id }))

describe("useNewOrders", () => {
  it("treats the first fetch as the baseline, not as new orders", () => {
    const { result } = renderHook(() => useNewOrders())

    let additions: string[] = []
    act(() => {
      additions = result.current.observe(ids("A", "B"))
    })

    expect(additions).toEqual([])
    expect(result.current.unseenOrderIds.size).toBe(0)
    expect(result.current.isUnseen("A")).toBe(false)
  })

  it("flags only orders that arrive after hydration as unseen", () => {
    const { result } = renderHook(() => useNewOrders())

    act(() => {
      result.current.observe(ids("A"))
    })

    let additions: string[] = []
    act(() => {
      additions = result.current.observe(ids("A", "B", "C"))
    })

    expect(additions).toEqual(["B", "C"])
    expect([...result.current.unseenOrderIds]).toEqual(["B", "C"])
    expect(result.current.isUnseen("A")).toBe(false)
    expect(result.current.isUnseen("B")).toBe(true)
  })

  it("does not re-flag an unseen order on later polls", () => {
    const { result } = renderHook(() => useNewOrders())

    act(() => {
      result.current.observe(ids("A"))
    })
    act(() => {
      result.current.observe(ids("A", "B"))
    })
    act(() => {
      result.current.observe(ids("A", "B"))
    })

    expect(result.current.unseenOrderIds.size).toBe(1)
  })

  it("removes an order once it is marked seen", () => {
    const { result } = renderHook(() => useNewOrders())

    act(() => {
      result.current.observe(ids("A"))
    })
    act(() => {
      result.current.observe(ids("A", "B", "C"))
    })
    act(() => {
      result.current.markSeen("B")
    })

    expect(result.current.isUnseen("B")).toBe(false)
    expect([...result.current.unseenOrderIds]).toEqual(["C"])
  })

  it("register() flags a Realtime order once and ignores duplicates", () => {
    const { result } = renderHook(() => useNewOrders())

    act(() => {
      result.current.observe(ids("A"))
    })

    let first = false
    act(() => {
      first = result.current.register("B")
    })
    expect(first).toBe(true)
    expect(result.current.isUnseen("B")).toBe(true)

    let second = true
    act(() => {
      second = result.current.register("B")
    })
    expect(second).toBe(false)
    expect(result.current.unseenOrderIds.size).toBe(1)
  })

  it("register() ignores orders that arrive before the first fetch", () => {
    const { result } = renderHook(() => useNewOrders())

    let registered = true
    act(() => {
      registered = result.current.register("A")
    })

    expect(registered).toBe(false)
    expect(result.current.unseenOrderIds.size).toBe(0)
  })

  it("reset() clears the highlight and re-baselines on the next fetch", () => {
    const { result } = renderHook(() => useNewOrders())

    act(() => {
      result.current.observe(ids("A"))
    })
    act(() => {
      result.current.observe(ids("A", "B"))
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.unseenOrderIds.size).toBe(0)

    let additions: string[] = []
    act(() => {
      additions = result.current.observe(ids("A", "B"))
    })
    expect(additions).toEqual([])
  })
})
