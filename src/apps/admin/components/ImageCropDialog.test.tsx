import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ImageCropDialog } from "./ImageCropDialog"

const mocks = vi.hoisted(() => ({
  cropImageToFile: vi.fn(),
}))

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react")
  // Stable reference: the effect runs on every render, and a fresh object would
  // keep re-triggering the dialog's cropped-area state update.
  const area = { x: 10, y: 20, width: 400, height: 400 }

  function CropperMock({
    onCropComplete,
  }: {
    onCropComplete?: (area: unknown, pixels: unknown) => void
  }) {
    useEffect(() => {
      onCropComplete?.(area, area)
    })
    return <div data-testid="cropper" />
  }

  return { default: CropperMock }
})

vi.mock("@shared/lib/imageProcessing", () => ({
  cropImageToFile: mocks.cropImageToFile,
}))

const source = () => new File(["photo"], "photo.jpg", { type: "image/jpeg" })

function renderDialog(overrides: Partial<Parameters<typeof ImageCropDialog>[0]> = {}) {
  return render(
    <ImageCropDialog
      file={source()}
      title="Crop item image"
      aspect={1}
      outputWidth={1200}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:test"),
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn(),
  })
  mocks.cropImageToFile.mockResolvedValue(
    new File(["cropped"], "image.webp", { type: "image/webp" }),
  )
})

describe("ImageCropDialog", () => {
  it("crops, resizes and hands the new file back", async () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })

    const useImage = screen.getByRole("button", { name: /use image/i })
    await waitFor(() => expect(useImage).toBeEnabled())
    fireEvent.click(useImage)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(mocks.cropImageToFile).toHaveBeenCalledWith(
      expect.any(File),
      { x: 10, y: 20, width: 400, height: 400 },
      { maxWidth: 1200 },
    )
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ type: "image/webp" })
  })

  it("cancels without preparing an image", () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mocks.cropImageToFile).not.toHaveBeenCalled()
  })

  it("shows a readable error when the image cannot be prepared", async () => {
    mocks.cropImageToFile.mockRejectedValueOnce(
      new Error("That image could not be prepared."),
    )
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })

    const useImage = screen.getByRole("button", { name: /use image/i })
    await waitFor(() => expect(useImage).toBeEnabled())
    fireEvent.click(useImage)

    expect(
      await screen.findByText(/that image could not be prepared/i),
    ).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
