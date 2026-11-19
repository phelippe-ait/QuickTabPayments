import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { useDialogFocus } from "./useDialogFocus"

function Harness({ active, mounted }: { active: boolean; mounted: boolean }) {
  const ref = useDialogFocus<HTMLDivElement>(() => {}, active)
  return (
    <div>
      <button type="button">outside</button>
      {mounted && (
        <div ref={ref} role="dialog" aria-label="panel">
          <button type="button">first</button>
          <button type="button">last</button>
        </div>
      )}
    </div>
  )
}

function pressTab(shiftKey = false): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  document.dispatchEvent(event)
  return event.defaultPrevented
}

describe("useDialogFocus", () => {
  it("does not prevent Tab while inactive", () => {
    render(<Harness active={false} mounted />)

    expect(pressTab()).toBe(false)
  })

  it("does not prevent Tab when the panel is not mounted", () => {
    render(<Harness active mounted={false} />)

    expect(pressTab()).toBe(false)
  })

  it("moves focus into the panel when it becomes active", () => {
    const { rerender } = render(<Harness active={false} mounted={false} />)

    rerender(<Harness active mounted />)

    expect(screen.getByRole("button", { name: "first" })).toHaveFocus()
  })

  it("traps Tab inside a mounted panel", () => {
    render(<Harness active mounted />)

    const first = screen.getByRole("button", { name: "first" })
    const last = screen.getByRole("button", { name: "last" })
    expect(first).toHaveFocus()

    last.focus()
    expect(pressTab()).toBe(true)
    expect(first).toHaveFocus()

    expect(pressTab(true)).toBe(true)
    expect(last).toHaveFocus()
  })
})
