import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TableModal } from "./TableDialog"

describe("TableModal", () => {
  it("rejects seat counts outside 1–12", () => {
    const onCreate = vi.fn(async () => true)
    render(
      <TableModal
        table={null}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/table number/i), {
      target: { value: "T07" },
    })
    fireEvent.change(screen.getByLabelText(/^seats$/i), {
      target: { value: "13" },
    })
    fireEvent.submit(
      screen.getByRole("button", { name: /add table/i }).closest("form")!,
    )

    expect(
      screen.getByText(/seats must be a whole number from 1 to 12/i),
    ).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("creates a free-text table number with seats", async () => {
    const onCreate = vi.fn(async () => true)
    const onClose = vi.fn()
    render(
      <TableModal
        table={null}
        onClose={onClose}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/table number/i), {
      target: { value: "T09" },
    })
    fireEvent.change(screen.getByLabelText(/^seats$/i), {
      target: { value: "4" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add table/i }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        table_number: "T09",
        location_label: "Indoors",
        seats: 4,
        is_active: true,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("sends null seats for Pick-up tables", async () => {
    const onCreate = vi.fn(async () => true)
    render(
      <TableModal
        table={null}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/table number/i), {
      target: { value: "Pick-up" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^pick-up$/i }))

    expect(screen.getByLabelText(/^seats$/i)).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /add table/i }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ seats: null, location_label: "Pick-up" }),
      ),
    )
  })
})
