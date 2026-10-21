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

/** Throws a user-facing Error when the file is not an accepted image. */
export function validateImageFile(file: File): void {
  if (!IMAGE_LIMITS.mimeTypes.includes(file.type as never)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size === 0) {
    throw new Error("That image is empty. Choose another file.");
  }
  if (file.size > IMAGE_LIMITS.maxBytes) {
    throw new Error("Choose an image smaller than 5 MB.");
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
