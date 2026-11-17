import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import {
  ConnectionBanner,
  RECONNECTED_BANNER_MS,
} from "./ConnectionBanner"

afterEach(() => {
  vi.useRealTimers()
})

describe("ConnectionBanner", () => {
  it("renders an assertive lost-connection message while offline", () => {
    render(<ConnectionBanner state="offline" />)

    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent(
      "Connection lost — showing last known data",
    )
    expect(banner).toHaveAttribute("aria-live", "assertive")
  })

  it("stays hidden during the initial connecting state", () => {
    const { container } = render(<ConnectionBanner state="connecting" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("stays hidden once online without a prior drop", () => {
    const { container } = render(<ConnectionBanner state="online" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("shows Reconnecting after a drop and before the channel rejoins", () => {
    const { rerender } = render(<ConnectionBanner state="online" />)

    rerender(<ConnectionBanner state="offline" />)
    rerender(<ConnectionBanner state="connecting" />)

    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting…")
  })

  it("briefly confirms a reconnect and then dismisses itself", () => {
    vi.useFakeTimers()
    const { rerender, container } = render(
      <ConnectionBanner state="online" />,
    )
    rerender(<ConnectionBanner state="offline" />)

    rerender(<ConnectionBanner state="online" />)
    expect(screen.getByRole("status")).toHaveTextContent("Reconnected")

    act(() => {
      vi.advanceTimersByTime(RECONNECTED_BANNER_MS)
    })
    expect(container).toBeEmptyDOMElement()
  })
})
