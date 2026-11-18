import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ReportPeriodSelector } from "./ReportPeriodSelector"

const now = new Date("2026-11-12T10:30:00Z")

describe("ReportPeriodSelector", () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderSelector() {
    return render(
      <ReportPeriodSelector timezone="UTC" now={now} onChange={onChange} />,
    )
  }

  it("defaults to the last 30 days", () => {
    renderSelector()

    expect(
      screen.getByRole("button", { name: "Last 30 days" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("emits the correct range for each preset", () => {
    renderSelector()

    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    expect(onChange).toHaveBeenLastCalledWith({
      preset: "today",
      from: "2026-11-12T00:00:00.000Z",
      to: now.toISOString(),
      fromDate: "2026-11-12",
      toDate: "2026-11-12",
    })

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }))
    expect(onChange).toHaveBeenLastCalledWith({
      preset: "7d",
      from: "2026-11-06T00:00:00.000Z",
      to: now.toISOString(),
      fromDate: "2026-11-06",
      toDate: "2026-11-12",
    })

    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }))
    expect(onChange).toHaveBeenLastCalledWith({
      preset: "30d",
      from: "2026-10-14T00:00:00.000Z",
      to: now.toISOString(),
      fromDate: "2026-10-14",
      toDate: "2026-11-12",
    })
  })

  it("disables Apply while the custom range is invalid", () => {
    renderSelector()

    fireEvent.click(screen.getByRole("button", { name: "Custom" }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-12-01" },
    })

    expect(screen.getByRole("alert")).toHaveTextContent(/before/i)
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()
  })

  it("applies a valid custom range", () => {
    renderSelector()

    fireEvent.click(screen.getByRole("button", { name: "Custom" }))
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-11-01" },
    })
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-11-10" },
    })

    const apply = screen.getByRole("button", { name: "Apply" })
    expect(apply).toBeEnabled()
    fireEvent.click(apply)

    expect(onChange).toHaveBeenCalledWith({
      preset: "custom",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-11T00:00:00.000Z",
      fromDate: "2026-11-01",
      toDate: "2026-11-10",
    })
  })
})
