import { useEffect, useRef } from "react"

type ConnectionPollingOptions = {
  /** Poll only while true (the socket is down). */
  enabled: boolean
  intervalMs: number
  onPoll: () => void
}

/**
 * REST polling fallback for when Realtime is offline.
 *
 * The interval lives only while `enabled` is true, so reconnecting cancels it
 * automatically and unmounting never leaves a timer behind. The latest
 * callback is kept in a ref so a re-render does not restart the timer.
 */
export function useConnectionPolling({
  enabled,
  intervalMs,
  onPoll,
}: ConnectionPollingOptions): void {
  const onPollRef = useRef(onPoll)

  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      onPollRef.current()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [enabled, intervalMs])
}
