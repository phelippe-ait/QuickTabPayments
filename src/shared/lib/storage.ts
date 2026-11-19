import { requireSupabase } from "@shared/data/client";

/**
 * Storage contract shared by restaurant branding and menu images.
 *
 * Buckets are public-read; writes are gated by RLS to active staff of the
 * restaurant id in the first path segment. Keep the paths here so the bucket
 * policies and the client can never drift:
 *
 *   restaurant-assets/{restaurant_id}/logo.{jpg|png|webp}
 *   restaurant-assets/{restaurant_id}/cover.{jpg|png|webp}
 *   menu-items/{restaurant_id}/{menu_item_id}.{jpg|png|webp}
 */
export const IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

/**
 * Source photos are cropped and downscaled before upload, so the picker can
 * accept a normal phone photo even though the stored asset stays under the
 * bucket's 5 MB cap.
 */
export const IMAGE_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

export const IMAGE_ACCEPT = IMAGE_LIMITS.mimeTypes.join(",");

export type RestaurantAssetKind = "logo" | "cover";

const extensions: Record<(typeof IMAGE_LIMITS.mimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionFor(file: File): string {
  return extensions[file.type as keyof typeof extensions] ?? "bin";
}

function assertImageType(file: File): void {
  if (!IMAGE_LIMITS.mimeTypes.includes(file.type as never)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size === 0) {
    throw new Error("That image is empty. Choose another file.");
  }
}

/** Final upload guard: the stored file must fit the bucket's 5 MB cap. */
export function validateImageFile(file: File): void {
  assertImageType(file);
  if (file.size > IMAGE_LIMITS.maxBytes) {
    throw new Error("Choose an image smaller than 5 MB.");
  }
}

/** Pre-crop guard: accepts large originals that will be resized on confirm. */
export function validateImageSourceFile(file: File): void {
  assertImageType(file);
  if (file.size > IMAGE_SOURCE_MAX_BYTES) {
    throw new Error("Choose a photo smaller than 20 MB.");
  }
}

export function restaurantAssetPath(
  restaurantId: string,
  kind: RestaurantAssetKind,
  file: File,
): string {
  return `${restaurantId}/${kind}.${extensionFor(file)}`;
}

export function menuItemImagePath(
  restaurantId: string,
  itemId: string,
  file: File,
): string {
  return `${restaurantId}/${itemId}.${extensionFor(file)}`;
}

async function uploadPublicObject(
  bucket: "restaurant-assets" | "menu-items",
  path: string,
  file: File,
): Promise<string> {
  validateImageFile(file);
  const client = requireSupabase();
  const { error } = await client.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadRestaurantAsset(
  restaurantId: string,
  kind: RestaurantAssetKind,
  file: File,
): Promise<string> {
  return uploadPublicObject(
    "restaurant-assets",
    restaurantAssetPath(restaurantId, kind, file),
    file,
  );
}

export async function uploadMenuItemImage(
  restaurantId: string,
  itemId: string,
  file: File,
): Promise<string> {
  return uploadPublicObject(
    "menu-items",
    menuItemImagePath(restaurantId, itemId, file),
    file,
  );
}
