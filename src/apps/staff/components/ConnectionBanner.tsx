import { useEffect, useRef, useState } from "react"
import type { ConnectionState } from "../hooks/connectionState"

/** How long the "Reconnected" confirmation stays on screen. */
export const RECONNECTED_BANNER_MS = 4_000

const bannerBase =
  "sticky top-0 z-40 flex items-center justify-center gap-2 border-b px-4 py-2 text-[12px] font-bold"

/**
 * Sticky staff connection banner.
 *
 * Offline is announced assertively and stays visible until the channel
 * rejoins. Reconnecting is polite. The one-off "Reconnected" confirmation
 * auto-dismisses so it never becomes permanent chrome.
 */
export function ConnectionBanner({ state }: { state: ConnectionState }) {
  const [showReconnected, setShowReconnected] = useState(false)
  const [hasBeenOnline, setHasBeenOnline] = useState(state === "online")
  const previousState = useRef<ConnectionState>(state)

  useEffect(() => {
    const previous = previousState.current
    previousState.current = state

    if (state === "online") {
      setHasBeenOnline(true)

      // Only celebrate a genuine recovery, never the first join.
      if (previous === "offline") {
        setShowReconnected(true)
        const timer = window.setTimeout(
          () => setShowReconnected(false),
          RECONNECTED_BANNER_MS,
        )
        return () => window.clearTimeout(timer)
      }
      return
    }

    if (state === "offline") setShowReconnected(false)
  }, [state])

  if (state === "offline") {
    return (
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className={`${bannerBase} border-danger/30 bg-danger-soft text-danger`}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
        Connection lost — showing last known data
      </div>
    )
  }

  if (state === "connecting" && hasBeenOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${bannerBase} border-amber/30 bg-amber-soft text-amber`}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber" />
        Reconnecting…
      </div>
    )
  }

  if (state === "online" && showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${bannerBase} border-sage/30 bg-sage-soft text-sage-strong`}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sage" />
        Reconnected
      </div>
    )
  }

  return null
}
