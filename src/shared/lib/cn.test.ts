import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names with a space", () => {
    expect(cn("flex", "gap-2")).toBe("flex gap-2");
  });

  it("drops falsy values", () => {
    expect(cn("base", false, null, undefined, "", "active")).toBe("base active");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
