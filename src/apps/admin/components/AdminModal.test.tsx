import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminModal } from "./AdminModal";

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {open && (
        <AdminModal labelledBy="test-dialog-title" onClose={() => setOpen(false)}>
          <h2 id="test-dialog-title">Test dialog</h2>
          <button type="button">Confirm</button>
        </AdminModal>
      )}
    </>
  );
}

describe("AdminModal", () => {
  it("exposes dialog semantics and focuses the first control", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /open dialog/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "test-dialog-title");
    expect(screen.getByRole("button", { name: /close dialog/i })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", () => {
    render(<Harness />);

    const opener = screen.getByRole("button", { name: /open dialog/i });
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("cycles Tab focus inside the dialog", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /open dialog/i }));

    const close = screen.getByRole("button", { name: /close dialog/i });
    const confirm = screen.getByRole("button", { name: /^confirm$/i });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
  });
});
