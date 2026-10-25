import { describe, expect, it } from "vitest"
import { buildTableQrUrl, parseQrParams } from "./qr"

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

describe("parseQrParams", () => {
  it("parses a complete QR contract", () => {
    expect(parseQrParams("?r=quicktab-demo-cafe&t=abc123")).toEqual({
      status: "ok",
      slug: "quicktab-demo-cafe",
      tableToken: "abc123",
    })
  })

  it("trims whitespace around values", () => {
    expect(parseQrParams("?r=%20cafe%20&t=%20token%20")).toEqual({
      status: "ok",
      slug: "cafe",
      tableToken: "token",
    })
  })

  it("returns none when no QR params are present", () => {
    expect(parseQrParams("")).toEqual({ status: "none" })
    expect(parseQrParams("?utm_source=poster")).toEqual({ status: "none" })
  })

  it("flags a missing table token (r alone)", () => {
    expect(parseQrParams("?r=quicktab-demo-cafe")).toEqual({
      status: "incomplete",
      missing: ["t"],
    })
  })

  it("flags a missing restaurant slug (t alone)", () => {
    expect(parseQrParams("?t=abc123")).toEqual({
      status: "incomplete",
      missing: ["r"],
    })
  })

  it("treats blank values as missing", () => {
    expect(parseQrParams("?r=&t=")).toEqual({
      status: "incomplete",
      missing: ["r", "t"],
    })
  })
})
