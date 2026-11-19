import { describe, expect, it } from "vitest"
import { scaledSize } from "./imageProcessing"

describe("scaledSize", () => {
  it("downscales the long edge to the target width", () => {
    expect(scaledSize(2400, 1600, 1200)).toEqual({ width: 1200, height: 800 })
  })

  it("never upscales a small crop", () => {
    expect(scaledSize(400, 300, 1200)).toEqual({ width: 400, height: 300 })
  })

  it("rejects an invalid crop area", () => {
    expect(() => scaledSize(0, 100, 1200)).toThrow(/valid image area/i)
    expect(() => scaledSize(Number.NaN, 100, 1200)).toThrow(/valid image area/i)
  })
})
