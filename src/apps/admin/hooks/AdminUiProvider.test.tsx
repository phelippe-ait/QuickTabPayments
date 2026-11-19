import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminUiProvider, useAdminUi } from "./AdminUiProvider";

function Trigger() {
  const { notify, notifyError } = useAdminUi();
  return (
    <>
      <button type="button" onClick={() => notify("Saved")}>
        success
      </button>
      <button type="button" onClick={() => notifyError("Could not save")}>
        error
      </button>
    </>
  );
}

function renderHost() {
  render(
    <AdminUiProvider>
      <Trigger />
    </AdminUiProvider>,
  );
}

describe("AdminUiProvider toasts", () => {
  it("announces success with role=status", () => {
    renderHost();
    fireEvent.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("announces errors with role=alert", () => {
    renderHost();
    fireEvent.click(screen.getByRole("button", { name: "error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });
});
