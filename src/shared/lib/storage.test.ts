import { describe, expect, it } from "vitest";
import {
  IMAGE_LIMITS,
  menuItemImagePath,
  restaurantAssetPath,
  validateImageFile,
} from "./storage";

function file(name: string, type: string, size?: number): File {
  const image = new File(["x"], name, { type });
  if (size !== undefined) {
    Object.defineProperty(image, "size", { value: size });
  }
  return image;
}

describe("validateImageFile", () => {
  it("accepts the supported image types", () => {
    expect(() => validateImageFile(file("logo.jpg", "image/jpeg"))).not.toThrow();
    expect(() => validateImageFile(file("logo.png", "image/png"))).not.toThrow();
    expect(() => validateImageFile(file("logo.webp", "image/webp"))).not.toThrow();
  });

  it("rejects unsupported types with a user-facing message", () => {
    expect(() => validateImageFile(file("logo.gif", "image/gif"))).toThrow(
      /JPG, PNG, or WebP/,
    );
  });

  it("rejects files over 5 MB", () => {
    expect(() =>
      validateImageFile(
        file("huge.png", "image/png", IMAGE_LIMITS.maxBytes + 1),
      ),
    ).toThrow(/smaller than 5 MB/);
  });

  it("rejects empty files", () => {
    expect(() => validateImageFile(file("empty.png", "image/png", 0))).toThrow(
      /empty/,
    );
  });
});

describe("storage paths", () => {
  it("derives the extension from the MIME type", () => {
    expect(restaurantAssetPath("r1", "logo", file("a.jpeg", "image/jpeg"))).toBe(
      "r1/logo.jpg",
    );
    expect(restaurantAssetPath("r1", "cover", file("a.png", "image/png"))).toBe(
      "r1/cover.png",
    );
    expect(
      menuItemImagePath("r1", "item-1", file("a.webp", "image/webp")),
    ).toBe("r1/item-1.webp");
  });
});
