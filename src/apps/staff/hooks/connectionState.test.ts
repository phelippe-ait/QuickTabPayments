import { describe, expect, it } from "vitest"
import { deriveConnectionState } from "./connectionState"

describe("deriveConnectionState", () => {
  it("moves to online when the channel subscribes", () => {
    expect(
      deriveConnectionState("connecting", {
        type: "realtime",
        status: "SUBSCRIBED",
      }),
    ).toBe("online")
    expect(
      deriveConnectionState("offline", {
        type: "realtime",
        status: "SUBSCRIBED",
      }),
    ).toBe("online")
  })

  it("moves to offline on channel errors, timeouts and closes", () => {
    for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
      expect(
        deriveConnectionState("online", { type: "realtime", status }),
      ).toBe("offline")
    }
  })

  it("keeps the current state for unknown realtime signals", () => {
    expect(
      deriveConnectionState("online", { type: "realtime", status: "JOINING" }),
    ).toBe("online")
    expect(
      deriveConnectionState("offline", { type: "realtime", status: "JOINING" }),
    ).toBe("offline")
  })

  it("drops to offline when the browser goes offline", () => {
    expect(
      deriveConnectionState("online", { type: "browser", online: false }),
    ).toBe("offline")
    expect(
      deriveConnectionState("connecting", { type: "browser", online: false }),
    ).toBe("offline")
  })

  it("treats the browser coming back as connecting until the channel rejoins", () => {
    expect(
      deriveConnectionState("offline", { type: "browser", online: true }),
    ).toBe("connecting")
    expect(
      deriveConnectionState("online", { type: "browser", online: true }),
    ).toBe("online")
  })
})
