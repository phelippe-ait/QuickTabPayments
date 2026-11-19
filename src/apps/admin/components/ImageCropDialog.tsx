import { useEffect, useState } from "react"
import Cropper, { type Area, type Point } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import styles from "../App.module.css"
import { Button } from "@shared/ui/Button"
import { cropImageToFile } from "@shared/lib/imageProcessing"
import { AdminModal } from "./AdminModal"

export type ImageCropDialogProps = {
  file: File
  title: string
  /** Width divided by height, e.g. 1 for a square, 16 / 9 for a cover. */
  aspect: number
  /** Longest output edge in pixels; smaller crops are never upscaled. */
  outputWidth: number
  onCancel: () => void
  onConfirm: (cropped: File) => void
}

/**
 * Crop + downscale step before upload. The dialog edits in the browser so the
 * stored asset always has the aspect ratio the layout expects, and large phone
 * photos never reach Storage at full size.
 */
export function ImageCropDialog({
  file,
  title,
  aspect,
  outputWidth,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Create the object URL inside an effect and clear it before revoking, so a
  // StrictMode remount never hands the cropper an already-revoked URL.
  const [imageUrl, setImageUrl] = useState("")

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => {
      setImageUrl("")
      URL.revokeObjectURL(url)
    }
  }, [file])

  const confirm = async () => {
    if (!croppedArea || busy) return
    setBusy(true)
    setError("")

    try {
      const cropped = await cropImageToFile(file, croppedArea, {
        maxWidth: outputWidth,
      })
      onConfirm(cropped)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That image could not be prepared. Try another file.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminModal
      labelledBy="image-crop-title"
      describedBy="image-crop-help"
      onClose={onCancel}
    >
      <p className={`${styles["modal-kicker"]}`}>Image</p>
      <h2 id="image-crop-title">{title}</h2>
      <p className={`${styles["modal-description"]}`} id="image-crop-help">
        Drag the photo to reposition it, then use the slider to zoom. The image
        is resized automatically before upload.
      </p>

      <div
        className="relative h-[280px] w-full overflow-hidden rounded-xl bg-ink"
        role="group"
        aria-label="Image crop area"
      >
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
            objectFit="cover"
            showGrid
            restrictPosition
          />
        )}
      </div>

      <label className="mt-4 flex items-center gap-3 text-[11px] font-bold text-ink-mid">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-full accent-berry"
        />
      </label>

      {error && (
        <p className="mt-3 text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className={`${styles["modal-actions"]}`}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void confirm()} disabled={busy || !croppedArea}>
          {busy ? "Preparing…" : "Use image"}
        </Button>
      </div>
    </AdminModal>
  )
}
