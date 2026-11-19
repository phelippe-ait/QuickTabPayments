import { IMAGE_LIMITS } from "./storage"

export type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

export const OUTPUT_MIME_TYPES = ["image/webp", "image/jpeg", "image/png"] as const
export type OutputMimeType = (typeof OUTPUT_MIME_TYPES)[number]

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** Output dimensions never upscale the source; very small crops stay small. */
export function scaledSize(sourceWidth: number, sourceHeight: number, maxWidth: number) {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error("That crop is not a valid image area.")
  }

  const scale = Math.min(1, maxWidth / sourceWidth)
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? "png"
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("That image could not be read. Try another file."))
    image.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: OutputMimeType,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("That image could not be prepared. Try another file."))
      },
      mimeType,
      quality,
    )
  })
}

/**
 * Crop the natural-pixel area chosen in the editor, downscale it, and return a
 * fresh File ready for Supabase Storage. Browsers that cannot encode WebP
 * silently return PNG, so the extension follows the blob's real type.
 */
export async function cropImageToFile(
  file: File,
  crop: CropArea,
  {
    maxWidth = 1200,
    mimeType = "image/webp",
    quality = 0.82,
  }: { maxWidth?: number; mimeType?: OutputMimeType; quality?: number } = {},
): Promise<File> {
  const source = URL.createObjectURL(file)

  try {
    const image = await loadImage(source)
    const size = scaledSize(crop.width, crop.height, maxWidth)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("This browser cannot edit images.")

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(
      image,
      Math.max(0, Math.round(crop.x)),
      Math.max(0, Math.round(crop.y)),
      Math.max(1, Math.round(crop.width)),
      Math.max(1, Math.round(crop.height)),
      0,
      0,
      size.width,
      size.height,
    )

    const blob = await canvasToBlob(canvas, mimeType, quality)
    const type = blob.type && EXTENSIONS[blob.type] ? blob.type : mimeType

    if (blob.size > IMAGE_LIMITS.maxBytes) {
      throw new Error("That image is still too large. Try a smaller photo.")
    }

    return new File([blob], `image.${extensionFor(type)}`, { type })
  } finally {
    URL.revokeObjectURL(source)
  }
}
