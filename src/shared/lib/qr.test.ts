import { describe, expect, it } from "vitest"
import { buildTableQrUrl } from "./qr"

describe("buildTableQrUrl", () => {
  it("builds the canonical slug + token URL", () => {
    expect(
      buildTableQrUrl({
        origin: "https://quicktab.example",
        slug: "quicktab-demo-cafe",
        qrToken: "9f3ab12c7d44e0a8",
      }),
    ).toBe(
      "https://quicktab.example/?r=quicktab-demo-cafe&t=9f3ab12c7d44e0a8",
    )
  })

  it("encodes values safely", () => {
    const url = buildTableQrUrl({
      origin: "https://quicktab.example",
      slug: "café & co",
      qrToken: "a+b/c",
    })

    expect(url).toBe(
      "https://quicktab.example/?r=caf%C3%A9+%26+co&t=a%2Bb%2Fc",
    )
  })

  it("discards any path, query, or hash on the supplied origin", () => {
    expect(
      buildTableQrUrl({
        origin: "https://quicktab.example/old?table=3#x",
        slug: "cafe",
        qrToken: "abcd1234",
      }),
    ).toBe("https://quicktab.example/?r=cafe&t=abcd1234")
  })
})
