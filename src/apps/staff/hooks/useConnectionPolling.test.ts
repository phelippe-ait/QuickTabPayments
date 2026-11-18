import { afterEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useConnectionPolling } from "./useConnectionPolling"

afterEach(() => {
  vi.useRealTimers()
})

describe("useConnectionPolling", () => {
  it("polls on the interval only while enabled", () => {
    vi.useFakeTimers()
    const onPoll = vi.fn()

    const { rerender } = renderHook(
      ({ enabled }) =>
        useConnectionPolling({ enabled, intervalMs: 10_000, onPoll }),
      { initialProps: { enabled: true } },
    )

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(onPoll).toHaveBeenCalledTimes(3)

    rerender({ enabled: false })
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(onPoll).toHaveBeenCalledTimes(3)
  })

  it("clears the interval on unmount", () => {
    vi.useFakeTimers()
    const onPoll = vi.fn()

    const { unmount } = renderHook(() =>
      useConnectionPolling({ enabled: true, intervalMs: 10_000, onPoll }),
    )

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onPoll).toHaveBeenCalledTimes(1)

    unmount()
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(onPoll).toHaveBeenCalledTimes(1)
  })

  it("uses the latest callback without restarting the timer", () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const second = vi.fn()

    const { rerender } = renderHook(
      ({ onPoll }) =>
        useConnectionPolling({ enabled: true, intervalMs: 10_000, onPoll }),
      { initialProps: { onPoll: first } },
    )

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(first).toHaveBeenCalledTimes(1)

    rerender({ onPoll: second })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })
})
