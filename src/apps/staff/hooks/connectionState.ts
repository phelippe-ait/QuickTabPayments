/**
 * Realtime connection state used by the staff connection banner and the
 * polling fallback.
 *
 * `connecting` covers both the first join and the period after the browser or
 * socket starts reconnecting. `offline` means the channel is known to be down
 * (the socket will keep retrying in the background).
 */
export type ConnectionState = "online" | "connecting" | "offline"

export type ConnectionSignal =
  | { type: "realtime"; status: string }
  | { type: "browser"; online: boolean }

/**
 * Pure state reducer for connection signals.
 *
 * - A joined channel is online.
 * - Any channel error/timeout/close is offline until the channel rejoins.
 * - Browser `online` only moves us to `connecting`: the websocket still has to
 *   rejoin before we can promise fresh realtime data.
 * - Unknown signals leave the current state untouched.
 */
export function deriveConnectionState(
  current: ConnectionState,
  signal: ConnectionSignal,
): ConnectionState {
  if (signal.type === "browser") {
    if (!signal.online) return "offline"
    return current === "online" ? "online" : "connecting"
  }

  switch (signal.status) {
    case "SUBSCRIBED":
      return "online"
    case "CHANNEL_ERROR":
    case "TIMED_OUT":
    case "CLOSED":
      return "offline"
    default:
      return current
  }
}
