import { describe, expect, it } from "vitest";
import {
  IMAGE_LIMITS,
  IMAGE_SOURCE_MAX_BYTES,
  menuItemImagePath,
  restaurantAssetPath,
  storageObjectFromPublicUrl,
  validateImageFile,
  validateImageSourceFile,
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

describe("validateImageSourceFile", () => {
  it("accepts a normal phone photo larger than the bucket limit", () => {
    expect(() =>
      validateImageSourceFile(
        file("photo.jpg", "image/jpeg", 10 * 1024 * 1024),
      ),
    ).not.toThrow();
  });

  it("rejects source photos over 20 MB", () => {
    expect(() =>
      validateImageSourceFile(
        file("huge.jpg", "image/jpeg", IMAGE_SOURCE_MAX_BYTES + 1),
      ),
    ).toThrow(/smaller than 20 MB/);
  });

  it("still rejects unsupported and empty files", () => {
    expect(() => validateImageSourceFile(file("logo.gif", "image/gif"))).toThrow(
      /JPG, PNG, or WebP/,
    );
    expect(() =>
      validateImageSourceFile(file("empty.png", "image/png", 0)),
    ).toThrow(/empty/);
  });
});

describe("storageObjectFromPublicUrl", () => {
  it("recovers the bucket and object path", () => {
    expect(
      storageObjectFromPublicUrl(
        "https://abc.supabase.co/storage/v1/object/public/menu-items/r1/item-1.webp",
      ),
    ).toEqual({ bucket: "menu-items", path: "r1/item-1.webp" })
    expect(
      storageObjectFromPublicUrl(
        "https://abc.supabase.co/storage/v1/object/public/restaurant-assets/r1/logo.png",
      ),
    ).toEqual({ bucket: "restaurant-assets", path: "r1/logo.png" })
  })

  it("ignores external and malformed URLs", () => {
    expect(storageObjectFromPublicUrl("https://cdn.example.com/logo.png")).toBeNull()
    expect(storageObjectFromPublicUrl("not a url")).toBeNull()
    expect(
      storageObjectFromPublicUrl(
        "https://abc.supabase.co/storage/v1/object/public/other-bucket/logo.png",
      ),
    ).toBeNull()
  })

  it("decodes URL-encoded object names", () => {
    expect(
      storageObjectFromPublicUrl(
        "https://abc.supabase.co/storage/v1/object/public/menu-items/r1/flat%20white.webp",
      ),
    ).toEqual({ bucket: "menu-items", path: "r1/flat white.webp" })
  })
})

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
